---
title: "EIP費用0円！AWS LambdaとCloudflare DDNSで構築したオンデマンド・マルチリージョンVPN"
description: "固定IP(EIP)の待機課金を回避し、Telegram BotとCloudflare無料DNS API、AWS Lambdaを組み合わせて月額0円で運用する個人向けマルチリージョンOpenVPN自動化の全記録"
date: 2026-10-07
tags: [AWS, EC2, OpenVPN, Cloudflare, DDNS, Lambda, Serverless, Telegram, Troubleshooting]
---

# EIP費用0円！AWS LambdaとCloudflare DDNSで構築したオンデマンド・マルチリージョンVPN

::: tip 1行要約
24時間常時稼働コストとAWS Elastic IP (EIP) のアイドル課金を完全に回避するため、**AWS Lambda + Telegram Bot + Cloudflare無料DNS API**を連携し、ボタン1つで東京・バージニアのEC2を起動しDNSレコードを1秒で自動更新する**月額0円オンデマンドVPNシステム**の構築記。
:::

## 1. プロジェクトの背景：なぜオンデマンドVPNなのか？

海外ネットワーク経由のアクセステストやリージョンごとの遅延検証のため、東京（`ap-northeast-1`）とバージニア北部（`us-east-1`）リージョンにOpenVPNサーバーを構築して運用してきた。しかし、個人用VPNは必要な時だけ一時的に利用する性質上、24時間起動し続けることはリソースと費用の大きな浪費だった：

1. **EC2無料利用枠（Free Tier）の超過リスク**：AWS無料枠では月間750時間のインスタンス稼働が提供されるが、2つのリージョンで24時間起動すると1ヶ月で約1,440時間に達し、即座に課金が発生する。
2. **パブリックIPv4アドレスの課金**：2024年2月より、稼働中・停止中を問わずすべてのパブリックIPv4アドレスに時間あたり$0.005が課金される。
3. **Elastic IP (EIP) のアイドル待機課金**：再起動時のIP変更を防ぐためにEIPを割り当てると、EC2が停止している間に**未接続EIP待機料金（$0.005/h）**が請求されてしまう。

> **解決戦略**：EIPを使用せず、通常時はEC2を停止（Stop）させておく。必要な時だけTelegramボタンで起動し、新しく動的発行されたパブリックIPを無料のCloudflare DNS APIで即座にAレコードへ反映させ、**クライアント側は単一の固定 `.ovpn` プロファイルで永久接続**できるように構築する！

---

## 2. 全体システムアーキテクチャ

常時起動する中継サーバーを持たず、**100% サーバーレス（AWS Lambda Function URL）**で構築することで維持費0円を実現した。

```
[サーバーレス オンデマンド VPN アーキテクチャ]

ユーザー (Telegram)
      │  /start またはインラインボタン押下
      ▼
[Telegram Bot API] ──(Webhook HTTPS POST)──> [AWS Lambda Function URL] (Python 3.12)
                                                         │
                 ┌───────────────────────────────────────┴───────────────────────────────────────┐
                 ▼                                                                               ▼
     [AWS EC2 (東京 / バージニア)]                                                  [Cloudflare DNS REST API (無料)]
      1. ec2.start_instances()                                                       3. PATCH /dns_records
      2. 新規パブリックIPの割り当て待機                                              4. vpn-tokyo.uoosnn.com Aレコード更新
                 │                                                                               │
                 └───────────────────────────────────────┬───────────────────────────────────────┘
                                                         ▼
                                            [Telegram 完了通知送信]
                                            "✅ 東京VPNの準備が完了しました！アプリで接続をONにしてください"
```

### アーキテクチャの重要ポイント
* **永久固定 `.ovpn` プロファイル**：設定ファイルにIPではなく `remote vpn-tokyo.uoosnn.com 1194` を一度だけ記述しておけば、IPが変わってもプロファイルを再インポートする必要がない。
* **超軽量デプロイパッケージ (0.77 MB)**：重いTelegram SDKの代わりに軽量な `requests` を採用し、`manylinux2014_x86_64` バイナリでパッケージングしてコールドスタート遅延を100ms以内に抑えた。

---

## 3. 実戦トラブルシューティング 3大課題

### 課題 1. Lambdaの200 OK応答とTelegramの無応答（エラー隠蔽の罠）
* **現象**：Telegram Botにコマンドを送信しても応答が返ってこないが、AWS Lambdaの監視コンソールには「実行成功（200 OK）」と記録されていた。
* **原因**：Telegram Webhookの仕様上、未処理例外による再送ループを防ぐために `except Exception` ブロックで一律 `200 OK` を返していたため、初期化処理中に発生したエラーが隠蔽されていた。
* **解決策**：
  1. ブラウザから関数URLをGETで呼び出すと環境変数の設定状態をリアルタイム診断できる `config_check` エンドポイントを実装。
  2. 診断結果で `CLOUDFLARE_API_TOKEN_SET: false` を特定し、欠落していた環境変数を即座に追加して解決。

```json
// ブラウザヘルスチェック診断結果
{
  "service": "aws-vpn-telegram-bot",
  "status": "online",
  "config_check": {
    "ALLOWED_CHAT_ID": 8771073288,
    "TELEGRAM_BOT_TOKEN_SET": true,
    "CLOUDFLARE_API_TOKEN_SET": false, // <-- 原因を即座に特定！
    "AWS_TOKYO_INSTANCE_ID_SET": true
  }
}
```

### 課題 2. Cloudflare DDNS連携時のプロキシ設定（UDP 1194通信の制限）
* **現象**：DNSレコード更新直後、OpenVPNの接続が即座にタイムアウトする。
* **原因**：Cloudflareの無料CDNプロキシ（オレンジ色の雲）はHTTP/HTTPS（80/443）Webトラフィックのみを中継し、UDP 1194ポートのOpenVPNトラフィックは遮断される。
* **解決策**：API呼び出し時のペイロードで `"proxied": False` を指定し、強制的に **DNS Only（灰色の雲）** モードで登録されるよう実装した。

```python
# Cloudflare DNS Aレコード更新ペイロード
payload = {
    "type": "A",
    "name": "vpn-tokyo.uoosnn.com",
    "content": new_public_ip,
    "ttl": 60,         # 1分間の超高速DNS伝播
    "proxied": False   # OpenVPN (UDP 1194) 直接通信に必須！
}
```

### 課題 3. 不正利用防止のためのChat IDホワイトリスト検証
* **セキュリティ懸念**：Botのユーザー名が外部に露見した場合、第三者が勝手にインスタンスを起動して不正課金を引き起こすリスクがある。
* **解決策**：Lambdaハンドラーのエントリポイントで `chat_id` が管理者のID（`ALLOWED_CHAT_ID`）と一致するかを厳格に照合し、不一致の場合は即座に遮断し警告を返す構造とした。

---

## 4. 運用費用の総括

| サービス項目 | スペックおよび利用条件 | 月額コスト |
| :--- | :--- | :--- |
| **AWS EC2 (東京 / バージニア)** | オンデマンド一時稼働（月10〜20時間程度） | **$0.00**（無料枠） |
| **AWS Lambda** | Function URL Webhook（月1,000回未満） | **$0.00**（月100万回無料） |
| **Cloudflare DNS API** | ドメイン管理およびREST API更新 | **$0.00**（永久無料） |
| **AWS Public IPv4** | EC2稼働時間のみ従量課金（$0.005/h） | **約 $0.05〜$0.10（10〜15円程度）** |
| **合計** | | **実質 0円（Always Free）** |

---

## 5. まとめと振り返り

固定IP（EIP）を契約しなくても、**Cloudflareの超高速DNS伝播（TTL 60秒）と無料REST APIを活用すれば、恒久的なドメインベースのオンデマンドインフラを容易に実現できる**ことが実証された。

スマートフォンTelegramからボタン1つで20秒以内にVPNが起動し、作業後は `[🛑 今すぐ終了]` ボタンで即座にシャットダウンして課金を完璧に防御できる体制が完成した。
