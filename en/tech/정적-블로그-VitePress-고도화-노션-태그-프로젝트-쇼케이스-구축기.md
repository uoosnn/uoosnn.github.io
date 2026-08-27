---
title: "Upgrading VitePress: Notion-Style Tagging System and Interactive Project Showcase"
description: "How we transformed a static VitePress documentation site into an engineering portfolio using Notion-style pastel pill badges, build-time content loaders, and interactive showcases"
date: 2026-08-23
tags: [Tech, VitePress, Frontend, Architecture, UI/UX, Showcase, Automation, DevOps]
---

# Upgrading VitePress: Notion-Style Tagging System and Interactive Project Showcase

::: tip 1-Line Summary
Coupled VitePress SSG with **Vue 3 custom components and build-time content loaders (`createContentLoader`)** to implement a Notion-style categorized tag filtering system and an interactive engineering project showcase (`/projects`).
:::

## 1. Notion-Style Tag Architecture

### Automatic Domain-to-Color CSS Mapping
* 🔵 **Blue**: `AWS`, `Cloud`, `Network`, `Linux`, `RDS` (Infrastructure & Cloud)
* 🟢 **Green**: `Troubleshooting`, `Performance`, `Automation` (Reliability & SRE)
* 🔴 **Red**: `Security`, `CVE`, `Incident`, `Forensic` (Security & IR)
* 🟣 **Purple**: `Serverless`, `Lambda`, `AI`, `Gemini`, `Architecture` (Serverless & AI)
* 🟡 **Yellow**: `Windows`, `WSL`, `MySQL`, `Database` (OS & Storage)

```css
.notion-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.15s ease-in-out;
}
.notion-tag:hover {
  transform: translateY(-1px);
  filter: brightness(0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}
```

---

## 2. Build-Time Content Loading (`createContentLoader`)

Compiled frontmatter metadata into pre-rendered JSON data at SSG build time to eliminate client runtime parsing overhead:

```javascript
// posts.data.mjs
import { createContentLoader } from 'vitepress';

export default createContentLoader(['tech/*.md', 'blog/*.md'], {
  transform(raw) {
    return raw
      .filter(({ url }) => !url.endsWith('/'))
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title,
        url,
        date: frontmatter.date,
        tags: frontmatter.tags || []
      }));
  }
});
```

---

## 3. Gotchas & Engineering Checkpoints

1. **Locale-Aware Tag Filtering**: Filter data sources based on active locale prefix (`/ja/`, `/en/`) to prevent cross-language post leakage in tag filter views.

---
*Published: 2026-08-23 14:00:00*
*Updated: 2026-08-23 14:00:00*
