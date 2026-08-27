---
title: "VitePress i18nによる多言語(KO/JA/EN)ブログアーキテクチャ構築記"
description: "VitePress locales多言語ルーティング、Frontmatter動的サイドバー生成、言語別テーマカスタマイズおよびGitHub Pages自動デプロイパイプライン構築実録"
date: 2026-05-16
tags: [VitePress, i18n, Frontend, SSG, Architecture, GitHubPages, WebDev]
---

# VitePress i18nによる多言語(KO/JA/EN)ブログアーキテクチャ構築記

::: tip 1行要約
VitePressの標準機能である`locales`設定を活用し、韓国語(Root)、日本語(`/ja/`)、英語(`/en/`)の完全独立した多言語ルーティングを構築。Markdown Frontmatterに基づく動的サイドバーと高速言語スイッチャーを実装した静的ブログアーキテクチャ。
:::

## 1. 多言語ディレクトリ構造とURLルーティング設計

VitePressはルートディレクトリのファイル構造をそのままURLパスにマッピングする直感的なi18nルーティングを提供する。

```
uoosnn.github.io/
├── .vitepress/
│   ├── config.mts          # 統合多言語およびテーマ設定
│   └── theme/              # Vue 3 カスタムレイアウト
├── tech/                   # [KO] 韓国語 技術ログ (Root: /tech/...)
├── blog/                   # [KO] 韓国語 コラム
├── ja/                     # [JA] 日本語 翻訳ドキュメント (/ja/tech/..., /ja/blog/...)
│   ├── tech/
│   └── blog/
├── en/                     # [EN] 英語 翻訳ドキュメント (/en/tech/..., /en/blog/...)
│   ├── tech/
│   └── blog/
└── index.md                # メインランディングページ
```

---

## 2. `.vitepress/config.mts` の `locales` 設定

言語ごとに独立したナビゲーションバー、サイドバー、検索ローカライズ文字列を定義する。

```typescript
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: "uoosnn's Tech Log",
  locales: {
    root: {
      label: '한국어',
      lang: 'ko-KR',
      themeConfig: {
        nav: [
          { text: '기술 로그', link: '/tech/' },
          { text: '칼럼', link: '/blog/' },
          { text: '쇼케이스', link: '/projects' }
        ]
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: '技術ログ', link: '/ja/tech/' },
          { text: 'ブログ', link: '/ja/blog/' },
          { text: 'プロジェクト', link: '/ja/projects' }
        ]
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Tech Notes', link: '/en/tech/' },
          { text: 'Blog', link: '/en/blog/' },
          { text: 'Projects', link: '/en/projects' }
        ]
      }
    }
  }
});
```

---

## 3. コアチェックポイント (Gotchas)

1. **相対リンクのロケールパス整合性**: 多言語ドキュメント内の内部リンクは、現在のロケールプレフィックス(`/ja/tech/...`, `/en/tech/...`)を明示するかベースヘルパー関数を経由してリンク切れを防止する。
2. **検索インデックスのローカライズ**: VitePress内蔵Local Searchを使用する場合、`locales`ごとにUI文字列(`placeholder`, `resetButtonTitle`)を設定することで多言語ユーザー体験を統一する。

---
*投稿日: 2026-05-16 12:00:00*
*更新日: 2026-08-15 13:57:00*
