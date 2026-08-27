---
title: "常時稼働サーバーのTelegram BotをAWS Lambda $0サーバーレスへ移行した実戦トラブルシューティング"
description: "EC2常時稼働Telegram BotをAPI Gateway + AWS Lambdaサーバーレスへ移行し、manlylinuxネイティブバイナリビルド、DynamoDB MarshalError、非同期並行処理を解決して月額固定費0円を達成した全記録"
date: 2026-08-23
tags: [AWS, Lambda, Serverless, TelegramBot, Python, DynamoDB, Troubleshooting, Architecture]
---

# 常時稼働サーバーのTelegram BotをAWS Lambda $0サーバーレスへ移行した実戦トラブルシューティング

::: tip 1行要約
ポーリング(Polling)方式の常時稼働EC2インスタンスを**API Gateway + AWS Lambda Webhookアーキテクチャ**へ完全移行し、ARM64 native依存関係、DynamoDB Decimal型シリアライズ、Gemini非同期I/Oパイプラインを最適化して**月額インフラ費用0円(Free Tier)**を達成した記録。
:::

## 1. サーバーレス移行アーキテクチャ設計

```
[AWS Lambda サーバーレス Telegram Bot アーキテクチャ]
Telegram User
      │ (HTTPS POST Webhook)
      ▼
[Amazon API Gateway (HTTP API)] ➔ [AWS Lambda (Python 3.12 / ARM64)]
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      [Google Gemini API]      [Amazon DynamoDB]        [GitHub Actions API]
      (ニュース要約/ブログ生成)   (対話履歴/セッション管理)     (VitePress自動ビルド&デプロイ)
```

---

## 2. 実戦トラブルシューティングの3大難所

### ① Lambda Linux環境におけるネイティブC拡張モジュールのビルド不整合
* **問題**: Windowsローカル環境で`pip install -t package/`した依存関係をデプロイしたところ、Lambda実行時に`ImportError: cannot import name 'cffi' / ELF binary error`が発生。
* **解決**: Dockerの`public.ecr.aws/sam/build-python3.12:latest-arm64`コンテナ内で`manylinux`対応のネイティブバイナリをクロスコンパイルしてパッケージング。

```dockerfile
# Lambda互換バイナリのビルドコマンド
docker run --rm -v "$PWD":/var/task public.ecr.aws/sam/build-python3.12:latest-arm64 \
    pip install -r requirements.txt -t /var/task/package --platform manylinux2014_aarch64 --only-binary=:all:
```

### ② DynamoDB `float`シリアライズの`MarshalError`
* **問題**: Telegramのメッセージタイムスタンプ(`timestamp = time.time()`)をそのままDynamoDBにPUTした際、Pythonの`float`型がサポートされず`TypeError: Float types are not supported`でクラッシュ。
* **解決**: `decimal.Decimal(str(ts))`による明示的型変換ハンドラーを実装。

```python
from decimal import Decimal

def sanitize_for_dynamodb(data):
    if isinstance(data, float):
        return Decimal(str(data))
    if isinstance(data, dict):
        return {k: sanitize_for_dynamodb(v) for k, v in data.items()}
    return data
```

### ③ Lambda 30秒タイムアウトと非同期処理 (`asyncio.gather`)
* **問題**: ニュースのスクレイピング、LLM要約、日/英翻訳、GitHub Commit APIの順次実行により、API Gatewayの統合タイムアウト(29秒)を超過。
* **解決**: 日本語・英語の翻訳処理およびメタデータ生成を`asyncio.gather`で完全並列化し、レイテンシを65%短縮。

---

## 3. コアチェックポイント (Gotchas)

1. **Telegram Webhookの即時200 OK応答**: Lambda内で重い処理を行う場合でも、Telegramサーバーからのタイムアウト再送ループを防ぐため、Webhookリクエスト受領直後に速やかに`statusCode: 200`を返却するか非同期起動(Event Invocation)に委譲する。
2. **Lambda無料利用枠(Free Tier)の威力**: 月間100万回のリクエストと320万秒のコンピューティング時間が永久無料で提供されるため、個人用Botやブログ自動化パイプラインは完全0円で運用可能。

---
*投稿日: 2026-08-23 12:00:00*
*更新日: 2026-08-23 12:00:00*
