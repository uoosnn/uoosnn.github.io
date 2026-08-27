---
title: "静的ブログ(VitePress)の高度化：Notion風タグシステムとインタラクティブプロジェクトショーケース構築記"
description: "VitePress静的ブログを単なる記録からエンジニアリングブランディングプラットフォームへと進化させたNotion風タグ/ラベルシステム、クライアントサイドフィルタリング、プロジェクトショーケース構築実録"
date: 2026-08-23
tags: [Tech, VitePress, Frontend, Architecture, UI/UX, Showcase, Automation, DevOps]
---

# 静的ブログ(VitePress)の高度化：Notion風タグシステムとインタラクティブプロジェクトショーケース構築記

::: tip 1行要約
VitePress静的サイト生成(SSG)環境に**Vue 3カスタムコンポーネントとビルドタイムデータローダー(`createContentLoader`)**を統合し、Notionスタイルのドメイン別カラータグシステムと定量実績中心のインタラクティブプロジェクトショーケース(`/projects`)を構築した記録。
:::

## 1. Notion風タグ＆ラベリングシステムの設計

### ドメイン別自動カラーマッピング
* 🔵 **Blue**: `AWS`, `Cloud`, `Network`, `Linux`, `RDS` (インフラ/クラウド)
* 🟢 **Green**: `Troubleshooting`, `Performance`, `Automation` (性能/トラブルシューティング)
* 🔴 **Red**: `Security`, `CVE`, `Incident`, `Forensic` (セキュリティ/侵害対応)
* 🟣 **Purple**: `Serverless`, `Lambda`, `AI`, `Gemini`, `Architecture` (サーバーレス/AI)
* 🟡 **Yellow**: `Windows`, `WSL`, `MySQL`, `Database` (データベース/OS)

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

## 2. ビルドタイムデータローダー (`createContentLoader`)

SSGビルド時に全Markdownメタデータを静的JSONとしてコンパイルすることで、クライアント側のTBTオーバーヘッドを0msに維持。

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

## 3. コアチェックポイント (Gotchas)

1. **クライアントサイドルーティング整合性**: 多言語環境(`/ja/`, `/en/`)でのタグフィルタリング時は、`useData()`のロケールパスを監視して言語別の記事データのみをフィルタリングする。

---
*投稿日: 2026-08-23 14:00:00*
*更新日: 2026-08-23 14:00:00*
