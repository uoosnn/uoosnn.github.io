---
title: "ブログ概要 — 技術スタックとアーキテクチャ"
date: 2026-05-09
tags: [ブログ, VitePress, 技術スタック, 自動化]
---

# ブログ概要 — 技術スタックとアーキテクチャ

このブログは**完全自動化された多言語技術ブログ**です。
Telegramボットと会話したり、ニュースにコメントを残したりすると、AIがブログ記事を作成・翻訳し、自動でデプロイします。

---

## 🏗️ 全体アーキテクチャ

```
[Telegram ボット] → [Gemini AI] → [Markdown 生成]
                                    ↓
                            [自動翻訳 (EN/JA)]
                                    ↓
                          [Git Commit & Push]
                                    ↓
                     [GitHub Actions → GitHub Pages]
                                    ↓
                        [VitePress 静的サイト]
```

---

## 📦 フロントエンド (ブログ)

| 技術 | バージョン | 用途 |
|------|------------|------|
| **VitePress** | v1.6.4 | 静的サイトジェネレーター (SSG) |
| **Vue.js** | v3.4 | VitePress内部フレームワーク、カスタムコンポーネント |
| **Markdown** | — | ブログコンテンツ作成フォーマット |

### なぜVitePressなのか？

1. **優れたパフォーマンス** — クライアント側のJavaScriptを最小限に抑え、高速ロード
2. **高いセキュリティ** — 純粋な静的ファイルのみを提供し、サーバー側の脆弱性を根本から遮断
3. **開発者フレンドリー** — ドキュメントスタイルのレイアウトでコンテンツに集中

---

## 🌍 多言語対応

| 言語 | パス | 自動翻訳 |
|:----:|:----:|:--------:|
| 🇰🇷 韓国語 | `/blog/` | オリジナル |
| 🇺🇸 英語 | `/en/blog/` | ✅ Gemini AI |
| 🇯🇵 日本語 | `/ja/blog/` | ✅ Gemini AI |

- VitePressの `locales` 設定により、言語ごとに独立したサイドバーとナビゲーションを構成
- Telegramボットの `/post` または `/sync` コマンドで自動翻訳をトリガー

---

## 🎨 デザインシステム

**6:3:1 配色比率** を適用:

| 比率 | 役割 | カラー |
|:----:|------|--------|
| 60% | Base | `#ffffff` (ライト) / `#0f172a` (ダーク) |
| 30% | Secondary | `#2563eb` (Blue) |
| 10% | Point | `#f97316` (Orange) |

- ライト/ダークモード切り替えに対応
- CSS Custom Propertiesでテーマ管理

---

## 🤖 バックエンド (Telegram ボット)

| 技術 | 用途 |
|------|------|
| **Python 3.9+** | ボットのメインランタイム |
| **python-telegram-bot** | Telegram Bot API 連携 |
| **Google Gemini API** | AI会話、ブログ作成、翻訳 |
| **feedparser** | Google News RSS ニューススクレイピング |
| **schedule** | ニュース配信スケジューラー (毎日 09:00 KST) |
| **GitPython** | ブログリポジトリへの自動コミット/プッシュ |

### ボットの主要コマンド

| コマンド | 機能 |
|----------|------|
| `/post [タイトル]` | 会話ベースのブログ自動作成 + 翻訳 + デプロイ |
| `/write` | Markdown直接入力での投稿 |
| `/sync` | 未翻訳の記事を一括翻訳 |
| `/usage` | APIトークンの使用量確認 |
| `/reset` | 会話セッションの初期化 |

### AIモデルの分離

| モデル | Temperature | 用途 |
|--------|:-----------:|------|
| `chat_model` | 0.7 | 自然な会話 |
| `post_model` | 0.2 | 事実に基づくブログ作成 (ハルシネーションを最小化) |

---

## 🔗 サードパーティ連携

| サービス | 用途 |
|----------|------|
| **Giscus** | GitHub Discussionsベースのサーバーレスコメントシステム |
| **Google Analytics 4** | 訪問者のトラフィックおよび国/言語別の統計追跡 |
| **RSS Feed** | 3言語の購読フィードを自動生成 (`feed.xml`) |
| **Sitemap** | 検索エンジン最適化用のサイトマップ自動生成 |
| **Google Search Console** | 検索露出管理とインデックス作成 |

---

## 🚀 CI/CD パイプライン

```
コード Push (main ブランチ)
     ↓
GitHub Actions トリガー
     ↓
npm ci → vitepress build
     ↓
sitemap.xml + feed.xml 自動生成
     ↓
GitHub Pages 自動デプロイ
```

- **ビルド時間**: ~4秒
- **デプロイ方式**: GitHub Pages (静的ホスティング)
- **ブランチ戦略**: `main` ブランチに push すると自動デプロイ

---

## 🛡️ セキュリティ

| 項目 | 方式 |
|------|------|
| APIキー管理 | `.env` + `.gitignore` (Gitから除外) |
| ボットソースの自動バックアップ | 1時間間隔の自動コミット/プッシュ (`auto_push.py`) |
| 静的サイト | サーバーサイドのコードなし → 攻撃対象領域を最小化 |
| コメントシステム | GitHub OAuthベースの認証 (Giscus) |

---

## 📁 プロジェクト構造

```
uoosnn.github.io/          ← ブログ (VitePress)
├── .vitepress/
│   ├── config.mjs          ← サイト設定、サイドバー、RSS、Sitemap
│   └── theme/
│       ├── custom.css       ← 6:3:1 配色テーマ
│       ├── index.mjs        ← Giscus レイアウト拡張
│       └── components/
│           └── GiscusComment.vue  ← コメントコンポーネント
├── blog/                   ← 韓国語のオリジナル記事
├── en/blog/                ← 英語翻訳版
├── ja/blog/                ← 日本語翻訳版
├── resume.md               ← 履歴書 (多言語)
└── .github/workflows/
    └── deploy.yml           ← CI/CD パイプライン

telegram_bot/               ← Telegram ボット
├── bot_main.py             ← メインエントリーポイント
├── ai_processor.py         ← Gemini AI 処理
├── github_uploader.py      ← Git アップロード
├── news_scraper.py         ← ニュース収集
└── auto_push.py            ← 自動コミット/プッシュ
```

---

*このブログはサーバーなしで運営される完全自動化システムです。Telegramで会話するとブログ記事になり、AIが翻訳し、GitHub Actionsがデプロイします。*
