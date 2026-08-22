---
title: "技術アーカイブ＆システムアーキテクチャ"
description: "クラウドインフラ運用、実践的な障害トラブルシューティング、セキュリティインシデント対応、およびAWS 0円サーバーレス自動化のシステムエンジニアリング知識ベース"
date: 2026-08-23
tags: [Tech, Architecture, Infrastructure, Troubleshooting, Security, Serverless, AWS, Linux]
---

# 🛠️ 技術アーカイブ＆システムアーキテクチャ

システムエンジニアとして実務の中で直面した**クラウド（AWS）インフラアーキテクチャ**、**実践的な障害トラブルシューティング**、**セキュリティインシデント対応**、そして**完全自動化された0円サーバーレスパイプライン**の技術記録とノウハウを集約したエンジニアリングナレッジハブです。

単なるチュートリアルにとどまらず、現場でシステムコール（`strace`）を逆追跡し、無停止マイグレーションを設計し、永久無料（Always Free）のサーバーレスパイプラインを構築した実務エンジニアリングのプロセスを共有します。

---

## 🧭 主な技術カテゴリー（Category Map）

<div class="tip custom-block" style="padding-top: 8px">
各カテゴリーの表内のリンクをクリックすると、詳細な技術ドキュメントへ直接アクセスできます。
</div>

### 1. ☁️ クラウドインフラ＆マイグレーション（Cloud & Infrastructure）
クラウドおよびオンプレミス環境においてダウンタイムを最小化し、システムの安定性を最大化するためのアーキテクチャ設計とマイグレーションの実務記録です。

| 記事タイトル | 主要テーマ | 投稿日 |
|:---|:---|:---:|
| [EBSスナップショットとAMI：AWSバックアップ戦略策定のための技術的比較分析](./AWS%20백업,%20스냅샷과%20AMI의%20차이와%20선택%20기준.md) | AWS EBS/AMIスナップショットのメカニズム、Data Lifecycle Manager（DLM）を活用したRPO/RTO最適化 | 2026-08-05 |
| [ダウンタイムを最小限に抑えるRDSブルー/グリーンデプロイメント](./다운타임을%20최소화하는%20RDS%20블루그린%20마이그레이션.md) | Aurora MySQLバージョンアップグレード、レプリケーション遅延制御および数十秒以内の無停止切り替え | 2026-07-28 |
| [削除されたAWS SNSトピック復旧におけるARNの重要性](./삭제된%20AWS%20SNS%20주제%20복구%20시%20ARN의%20중요성.md) | 誤削除されたSNSトピックとCloudWatch Alarm連携切断時、同一ARN再作成による無停止復旧 | 2026-07-08 |
| [レガシーサーバーの段階的マイグレーションプロセス](./레거시%20서버의%20단계별%20마이그레이션%20과정.md) | 旧式PHP/MySQL環境から最新OSおよびMariaDBへの段階的移行、データ整合性検証プロセス | 2026-05-17 |
| [サーバーディスクの交換、単純な作業ではない理由](./서버%20디스크%20교체,%20간단한%20작업이%20아닌%20이유.md) | ファイルシステムアンマウント、`rsync`差分同期、`fstab` UUID検証などディスク交換エンジニアリング | 2026-05-17 |

---

### 2. 🛡️ 実践トラブルシューティング＆セキュリティ対応（Troubleshooting & Security）
原因不明のデーモンクラッシュ、ハードウェア通信断絶、そして実際のWebサーバー侵入インシデント現場において、ログ・パケット・システムコールを精密に分析して問題を解決した実践記録です。

| 記事タイトル | 主要テーマ | 投稿日 |
|:---|:---|:---:|
| [実践トラブルシューティング：「React2Shell (CVE-2025-55182)」侵害インシデントの分析と対応レビュー](./실전%20트러블슈팅%20-%20React2Shell%20(CVE-2025-55182)%20침해%20사고%20분석%20및%20대응%20후기.md) | リモートコード実行（RCE）侵入経路の逆追跡、Webシェル隔離およびファイアウォール遮断の緊急対応 | 2026-05-17 |
| [ログなしApache SSLエラー、straceで分析したトラブルシューティング](./로그%20없는%20아파치%20SSL%20오류,%20strace로%20분석.md) | エラーログのないApacheクラッシュ現象を`strace`システムコール追跡で証明書およびエントロピー問題と特定 | 2026-05-21 |
| [MSSQL構成マネージャーのエラー、共有機能の復旧で解決する](./MSSQL%20구성%20관리자%20오류,%20공유%20기능%20복구로%20해결하기.md) | WMIプロバイダーエラーによるSQL Server構成マネージャー実行不可時、MOF再コンパイルによる復旧 | 2026-07-20 |
| [MRTGトラフィックグラフでサーバー速度が分からない理由](./MRTG%20트래픽%20그래프로%20서버%20속도를%20알%20수%20없는%20이유.md) | 平均帯域幅指標の限界分析、パケット損失・ジッター・TCPウィンドウサイズに基づくボトルネック診断法 | 2026-07-10 |
| [Fortiファイアウォールを活用したネットワークセキュリティの構成](./Forti%20방화벽을%20활용한%20네트워크%20보안%20구성.md) | FortiGateベースのDMZネットワーク分離、Virtual IP（VIP）転送およびゾーンベースのセキュリティポリシー策定 | 2026-05-17 |
| [IDC移転後LenovoサーバーXCCアクセス不可問題のトラブルシューティングログ](./PM과의%20협업%20갈등,%20IDC%20이전%20프로젝트%20회고.md) | 物理的IDC移転後に発生したXCC（BMC）管理ポート通信断絶の原因分析およびBIOS/ネットワーク再設定 | 2026-06-26 |

---

### 3. ⚙️ サーバーレス自動化＆ブログアーキテクチャ（Architecture & Automation）
当ブログおよびTelegramボットシステムを支える完全自動化されたサーバーレスパイプラインと多言語静的サイトの構造です。

| 記事タイトル | 主要テーマ | 投稿日 |
|:---|:---|:---:|
| [VitePress多言語ブログ構築記](./VitePress-다국어-블로그-구축기.md) | VitePressベースの3言語（KO/EN/JA）ルーティング、カスタムダークテーマおよびコンポーネント設計 | 2026-05-16 |
| [AWS Lambda 0円サーバーレスTelegramボットアーキテクチャ](#-最新システムアーキテクチャ-aws-0円サーバーレスパイプライン) | 常時稼働サーバーなしでLambda + DynamoDB + Function URLにより運用費0円を達成したNo-Opsパイプライン | 2026-08-23 |

---

### 4. 🌐 Webパフォーマンス、アクセシビリティ＆サプライチェーンセキュリティ（Web Performance & DevOps）
検索エンジン最適化（SEO）、Webアクセシビリティ（A11y）、レンダリングブロックリソースの排除によるGoogle Lighthouse満点達成およびnpm依存関係のセキュリティ強化記録です。

| 記事タイトル | 主要テーマ | 投稿日 |
|:---|:---|:---:|
| [Search Consoleに基づいたモバイルパフォーマンスとアクセシビリティの最適化](./서치%20콘솔%20기반%20모바일%20성능%20및%20접근성%20최적화.md) | Google Search Consoleデータに基づくCSS非同期読み込み、GA4遅延ロードおよびLighthouse 100点達成 | 2026-08-15 |
| [VitePressベースの静的ブログにおけるnpm依存関係の脆弱性分析と解決記録](./정적%20블로그%20npm%20취약점%20점검%20및%20대응%20후기.md) | `npm audit`によるサプライチェーン脆弱性分析、ビルドパイプラインのセキュリティ強化およびパッケージオーバーライド | 2026-08-09 |

---

## 🏗️ 最新システムアーキテクチャ（AWS 0円サーバーレスパイプライン）

当ブログ（`uoosnn.com`）は、**AWS Always Free Tier**と**GitHub Pages**を組み合わせ、**常時稼働サーバー費用0円（月額0円）**および**運用管理コストゼロ（Zero-Ops）**を達成したイベント駆動型サーバーレスアーキテクチャで稼働しています。

```mermaid
flowchart TD
    subgraph Client_Layer [ユーザー＆Telegramクライアント]
        User[管理者 / ユーザー] -->|メッセージ / 写真 / /post コマンド| TG[Telegram Bot API]
    end

    subgraph AWS_Serverless [AWS Always Free サーバーレス層（費用0円）]
        TG -->|HTTPS POST Webhook| FURL[Lambda Function URL\n(API Gateway不要、費用0円)]
        FURL --> LAMBDA[AWS Lambda\n(Python 3.12 / x86_64, 256MB)]
        
        CRON[Amazon EventBridge\n(毎日09:00 JST ニュース収集)] -->|Scheduled Trigger| LAMBDA
        
        LAMBDA <--> DYNAMO[(Amazon DynamoDB\ntelegram_bot_state / 25GB永久無料)]
    end

    subgraph AI_External [AI＆外部サービス連携]
        LAMBDA -->|対話処理＆ブログMarkdown生成＆多言語翻訳| GEMINI[Google Gemini API\n(Flash 2.5 / 3.0)]
        LAMBDA -->|PyGithub REST API直接コミット| GH_API[GitHub REST API\nuoosnn/uoosnn.github.io]
    end

    subgraph CI_CD_Hosting [デプロイ＆ホスティングパイプライン]
        GH_API -->|mainブランチPushトリガー| ACTIONS[GitHub Actions\n(npm ci -> vitepress build)]
        ACTIONS -->|sitemap.xml + feed.xml 自動生成| PAGES[GitHub Pages\n(グローバルCDN静的ホスティング)]
    end

    PAGES -->|高速ロード / Lighthouse 100点| READER[閲覧者（Webブラウザ）]
```

### 💡 0円（Always Free）インフラ設計 5大原則

1. **AWS Lambda（月間100万回無料）**:
   - 常時起動のVM/EC2を排除し、イベント発生時のみ100ms以内に起動して実行されます。個人のボット利用量では無料枠の0.01%未満を消費します。
2. **Lambda Function URL（HTTPSエンドポイント0円）**:
   - 従量課金リスクのあるAPI Gatewayを使わず、Lambda自体のFunction URLでTelegram Webhookを直接接続し、エンドポイント費用を完全0円に保ちます。
3. **Amazon DynamoDB（25GBストレージ永久無料）**:
   - セッション状態、会話履歴、日次ニュース送信履歴、API使用量カウンターを単一テーブル（`telegram_bot_state`）で一元管理し、TTL（7日間自動削除）で容量を常に最適化します。
4. **PyGithub REST APIコミット（ディスクレスI/O）**:
   - LambdaローカルディスクにGitバイナリやリポジトリをクローンすることなく、GitHub REST API経由でMarkdownや画像を直接リモートコミットします。
5. **VitePress + GitHub Pages（超高速静的配信）**:
   - ビルドされた純粋なHTML/CSS/JSのみをグローバルCDNで配信し、サーバーサイドの脆弱性を根本から遮断しつつ最高水準のページ表示速度を実現します。

---

## 📊 技術スタック構成（Tech Stack）

| 領域 | 使用技術 | バージョン/スペック | 役割と特徴 |
|:---|:---|:---:|:---|
| **フロントエンド (SSG)** | **VitePress** | v1.6.4 | Vue 3.4ベースの超高速静的サイトジェネレーター |
| **デザインシステム** | **Custom CSS** | 6:3:1 配色比率 | ダーク/ライトテーマ切り替え、Glassmorphism、レスポンシブ対応 |
| **サーバーレスバックエンド** | **AWS Lambda** | Python 3.12 | Webhook受信、非同期ディスパッチ、AIブログ自動生成 |
| **永続状態ストレージ** | **Amazon DynamoDB** | On-Demand | 25GB永久無料、セッション管理、ニュース重複防止、TTL適用 |
| **スケジューラー** | **Amazon EventBridge** | Cron (09:00 JST) | 毎朝のIT・セキュリティ主要ニュース自動収集トリガー |
| **AIモデル** | **Google Gemini API** | Flash Models | 対話型ブログ作成、3言語（KO/EN/JA）リアルタイム相互翻訳 |
| **CI/CD＆デプロイ** | **GitHub Actions / Pages** | Ubuntu Latest | 自動ビルド、3言語RSS（`feed.xml`）および`sitemap.xml`生成 |
| **コメント機能** | **Giscus** | GitHub Discussions | サーバーレスコメントシステム（GitHub OAuth認証） |
| **モニタリング＆分析** | **Google Analytics 4** | gtag.js（遅延ロード） | TBT 0msを保証する非同期トラフィック分析、Search Console連携 |

---

## 🌍 多言語対応システム（Multilingual Engine）

VitePressの`locales`機能とGemini AIの翻訳パイプラインを統合し、韓国語の原本作成と同時に3言語へ同期デプロイされます。

```
[韓国語オリジナル記事]  --->  /blog/ または /tech/
       │
       ├─── [Gemini AI 翻訳] ───> /en/blog/ または /en/tech/  (🇺🇸 English)
       └─── [Gemini AI 翻訳] ───> /ja/blog/ または /ja/tech/  (🇯🇵 日本語)
```

- **クリーンURL構造**: `ko`（ルート）、`en`（`/en/`）、`ja`（`/ja/`）
- **SEO最適化**: 各ページに`hreflang`タグ、`canonical` URL、および`TechArticle` / `BlogPosting` Schema.org構造化データを自動注入します。

---

## 🚀 今後の技術記録ロードマップ

- 📌 **AWS ECS / EKS ベースのコンテナオーケストレーションとモニタリング構築記**
- 📌 **IaC（Terraform / AWS CDK）を活用したサーバーレスインフラのコード管理**
- 📌 **Linuxカーネルチューニングとネットワークソケットレベルの性能最適化**
- 📌 **Prometheus / Grafana によるエンタープライズ統合オブザーバビリティ（Observability）**

---

*現場で培った技術的な知見とトラブルシューティングの記録は継続的に更新されます。ご意見やご質問はコメントやGitHubを通してお気軽にお寄せください。*
