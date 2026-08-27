---
title: "Building a Multilingual (KO/JA/EN) Tech Blog with VitePress i18n"
description: "Architecting a high-performance multilingual blog using VitePress locales routing, frontmatter-driven dynamic sidebars, and automated GitHub Pages CI/CD"
date: 2026-05-16
tags: [VitePress, i18n, Frontend, SSG, Architecture, GitHubPages, WebDev]
---

# Building a Multilingual (KO/JA/EN) Tech Blog with VitePress i18n

::: tip 1-Line Summary
Leveraging VitePress native `locales` to implement isolated multilingual routing across Korean (Root), Japanese (`/ja/`), and English (`/en/`), coupled with frontmatter-driven dynamic sidebars and zero-runtime translation switching.
:::

## 1. Directory Topology & Routing Architecture

VitePress maps directory trees directly into URL path hierarchies:

```
uoosnn.github.io/
├── .vitepress/
│   ├── config.mts          # Central i18n & theme configuration
│   └── theme/              # Custom Vue 3 components
├── tech/                   # [KO] Tech notes (Root: /tech/...)
├── blog/                   # [KO] Essays & columns
├── ja/                     # [JA] Japanese translations (/ja/tech/..., /ja/blog/...)
│   ├── tech/
│   └── blog/
├── en/                     # [EN] English translations (/en/tech/..., /en/blog/...)
│   ├── tech/
│   └── blog/
└── index.md                # Root landing page
```

---

## 2. `.vitepress/config.mts` Locales Declaration

Define locale-specific navigations, sidebars, and localized search placeholders:

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

## 3. Gotchas & Engineering Checkpoints

1. **Locale-Aware Relative Routing**: Internal markdown cross-links must respect the active locale path (`/ja/tech/post-slug`) to prevent inadvertent fallback to root Korean pages.
2. **Search Index Localization**: Configure distinct `translations` objects inside `localSearch` for each locale to provide native search placeholders.

---
*Published: 2026-05-16 12:00:00*
*Updated: 2026-08-15 13:57:00*
