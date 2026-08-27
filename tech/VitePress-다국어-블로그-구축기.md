---
title: "VitePress i18n 기반 다국어(KO/JA/EN) 블로그 아키텍처 구축기"
description: "VitePress locales 다국어 라우팅, 프론트매터 동적 사이드바 생성, 언어별 테마 커스터마이징 및 GitHub Pages 배포 파이프라인 구축 실전기"
date: 2026-05-16
tags: [VitePress, i18n, Frontend, SSG, Architecture, GitHubPages, WebDev]
---

# VitePress i18n 기반 다국어(KO/JA/EN) 블로그 아키텍처 구축기

::: tip 1줄 요약
VitePress의 내장 `locales` 설정을 활용하여 한국어(Root), 일본어(`/ja/`), 영어(`/en/`)의 독립된 다국어 라우팅을 구축하고, 마크다운 프론트매터 기반 동적 사이드바 및 언어 스위처를 연동한 정적 블로그 아키텍처 실전 가이드.
:::

## 1. 다국어 디렉토리 구조 및 라우팅 설계

VitePress는 루트 디렉토리 구조를 그대로 URL 패스에 매핑하는 강력한 i18n 라우팅을 지원한다.

```
uoosnn.github.io/
├── .vitepress/
│   ├── config.mts          # 통합 다국어 및 테마 설정
│   └── theme/              # Vue 3 커스텀 레이아웃
├── tech/                   # [KO] 기술 트러블슈팅 (Root: /tech/...)
├── blog/                   # [KO] 개발 에세이/칼럼
├── ja/                     # [JA] 일본어 번역 문서 (/ja/tech/..., /ja/blog/...)
│   ├── tech/
│   └── blog/
├── en/                     # [EN] 영어 번역 문서 (/en/tech/..., /en/blog/...)
│   ├── tech/
│   └── blog/
└── index.md                # 메인 랜딩 페이지
```

---

## 2. `.vitepress/config.mts` 다국어 `locales` 설정

각 언어별 네비게이션 바, 사이드바, 검색 인덱스 및 메타데이터를 독립적으로 선언한다.

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

## 3. 동적 프론트매터 사이드바 생성 (`sidebar.ts`)

정적 파일명이 한글이거나 언어별로 다를 때 사이드바 타이틀이 깨지는 현상을 방어하기 위해, `gray-matter`로 각 마크다운의 `title` 프론트매터를 추출하여 사이드바 트리를 동적 생성한다.

```typescript
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function getAutoSidebar(dirRelativePath: string) {
  const targetDir = path.resolve(__dirname, '..', dirRelativePath);
  if (!fs.existsSync(targetDir)) return [];

  return fs.readdirSync(targetDir)
    .filter(file => file.endsWith('.md') && file !== 'index.md')
    .map(file => {
      const fullPath = path.join(targetDir, file);
      const { data } = matter(fs.readFileSync(fullPath, 'utf-8'));
      return {
        text: data.title || file.replace('.md', ''),
        link: `/${dirRelativePath}/${file.replace('.md', '')}`
      };
    });
}
```

---

## 4. 핵심 체크포인트 (Gotchas)

1. **상대 링크 정합성**: 다국어 문서 내에서 내부 링크를 작성할 때 `/tech/post1`이 아닌 현재 로케일 경로(`/ja/tech/post1`, `/en/tech/post1`)를 명시하거나 베이스 URL 헬퍼를 사용해야 깨짐을 방지할 수 있다.
2. **검색 인덱스 분리**: 내장 Local Search 사용 시 `locales`별로 독립된 번역 스트링(`placeholder`, `resetButtonTitle`)을 등록해야 사용자 언어에 맞게 검색 UI가 렌더링된다.

---
*게시된 시간: 2026-05-16 12:00:00*
*수정한 시간: 2026-08-15 13:57:00*
