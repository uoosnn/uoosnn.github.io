---
title: "블로그 개요 — 기술 스택 및 아키텍처"
date: 2026-05-09
tags: [블로그, VitePress, 기술스택, 자동화]
---

# 블로그 개요 — 기술 스택 및 아키텍처

이 블로그는 **완전 자동화된 다국어 기술 블로그**입니다.
텔레그램 봇으로 대화하거나 뉴스에 코멘트를 남기면, AI가 블로그 글을 작성하고 번역하여 자동으로 배포합니다.

---

## 🏗️ 전체 아키텍처

```
[텔레그램 봇] → [Gemini AI] → [마크다운 생성]
                                    ↓
                            [자동 번역 (EN/JA)]
                                    ↓
                          [Git Commit & Push]
                                    ↓
                     [GitHub Actions → GitHub Pages]
                                    ↓
                        [VitePress 정적 사이트]
```

---

## 📦 프론트엔드 (블로그)

| 기술 | 버전 | 용도 |
|------|------|------|
| **VitePress** | v1.6.4 | 정적 사이트 생성기 (SSG) |
| **Vue.js** | v3.4 | VitePress 내부 프레임워크, 커스텀 컴포넌트 |
| **Markdown** | — | 블로그 콘텐츠 작성 포맷 |

### 왜 VitePress인가?

1. **뛰어난 성능** — 클라이언트 측 자바스크립트를 최소화하여 빠르게 로드
2. **높은 보안성** — 순수 정적 파일만 제공, 서버 측 취약점 원천 차단
3. **개발자 친화적** — Docs 스타일 레이아웃으로 글에 집중

---

## 🌍 다국어 지원

| 언어 | 경로 | 자동 번역 |
|:----:|:----:|:---------:|
| 🇰🇷 한국어 | `/blog/` | 원본 |
| 🇺🇸 영어 | `/en/blog/` | ✅ Gemini AI |
| 🇯🇵 일본어 | `/ja/blog/` | ✅ Gemini AI |

- VitePress의 `locales` 설정으로 언어별 독립적인 사이드바 및 네비게이션 구성
- 텔레그램 봇의 `/post` 또는 `/sync` 명령어로 자동 번역 트리거

---

## 🎨 디자인 시스템

**6:3:1 배색 비율** 적용:

| 비율 | 역할 | 색상 |
|:----:|------|------|
| 60% | Base | `#ffffff` (라이트) / `#0f172a` (다크) |
| 30% | Secondary | `#2563eb` (Blue) |
| 10% | Point | `#f97316` (Orange) |

- 라이트/다크 모드 전환 지원
- CSS Custom Properties로 테마 관리

---

## 🤖 백엔드 (텔레그램 봇)

| 기술 | 용도 |
|------|------|
| **Python 3.9+** | 봇 메인 런타임 |
| **python-telegram-bot** | 텔레그램 Bot API 연동 |
| **Google Gemini API** | AI 대화, 블로그 작성, 번역 |
| **feedparser** | Google News RSS 뉴스 스크래핑 |
| **schedule** | 뉴스 발송 스케줄러 (매일 09:00 KST) |
| **GitPython** | 블로그 레포 자동 커밋/푸시 |

### 봇 주요 명령어

| 명령어 | 기능 |
|--------|------|
| `/post [제목]` | 대화 기반 블로그 자동 작성 + 번역 + 배포 |
| `/write` | 마크다운 직접 입력 포스팅 |
| `/sync` | 미번역 포스트 일괄 번역 |
| `/usage` | API 토큰 사용량 확인 |
| `/reset` | 대화 세션 초기화 |

### AI 모델 분리

| 모델 | Temperature | 용도 |
|------|:-----------:|------|
| `chat_model` | 0.7 | 자연스러운 대화 |
| `post_model` | 0.2 | 사실 기반 블로그 작성 (할루시네이션 최소화) |

---

## 🔗 서드파티 연동

| 서비스 | 용도 |
|--------|------|
| **Giscus** | GitHub Discussions 기반 서버리스 댓글 시스템 |
| **Google Analytics 4** | 방문자 트래픽 및 국가/언어별 통계 추적 |
| **RSS Feed** | 3개 언어별 구독 피드 자동 생성 (`feed.xml`) |
| **Sitemap** | 검색 엔진 최적화용 사이트맵 자동 생성 |
| **Google Search Console** | 검색 노출 관리 및 인덱싱 |

---

## 🚀 CI/CD 파이프라인

```
코드 Push (main 브랜치)
     ↓
GitHub Actions 트리거
     ↓
npm ci → vitepress build
     ↓
sitemap.xml + feed.xml 자동 생성
     ↓
GitHub Pages 자동 배포
```

- **빌드 시간**: ~4초
- **배포 방식**: GitHub Pages (정적 호스팅)
- **브랜치 전략**: `main` 브랜치 push 시 자동 배포

---

## 🛡️ 보안

| 항목 | 방식 |
|------|------|
| API 키 관리 | `.env` + `.gitignore` (Git 미포함) |
| 봇 소스 자동 백업 | 1시간 주기 자동 커밋/푸시 (`auto_push.py`) |
| 정적 사이트 | 서버 사이드 코드 없음 → 공격 표면 최소화 |
| 댓글 시스템 | GitHub OAuth 기반 인증 (Giscus) |

---

## 📁 프로젝트 구조

```
uoosnn.github.io/          ← 블로그 (VitePress)
├── .vitepress/
│   ├── config.mjs          ← 사이트 설정, 사이드바, RSS, Sitemap
│   └── theme/
│       ├── custom.css       ← 6:3:1 배색 테마
│       ├── index.mjs        ← Giscus 레이아웃 확장
│       └── components/
│           └── GiscusComment.vue  ← 댓글 컴포넌트
├── blog/                   ← 한국어 원본 포스트
├── en/blog/                ← 영문 번역본
├── ja/blog/                ← 일문 번역본
├── resume.md               ← 이력서 (다국어)
└── .github/workflows/
    └── deploy.yml           ← CI/CD 파이프라인

telegram_bot/               ← 텔레그램 봇
├── bot_main.py             ← 메인 엔트리포인트
├── ai_processor.py         ← Gemini AI 처리
├── github_uploader.py      ← Git 업로드
├── news_scraper.py         ← 뉴스 수집
└── auto_push.py            ← 자동 커밋/푸시
```

---

*이 블로그는 서버 없이 운영되는 완전 자동화 시스템입니다. 텔레그램에서 대화하면 블로그 글이 되고, AI가 번역하고, GitHub Actions가 배포합니다.*
