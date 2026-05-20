---
title: "Blog Overview — Tech Stack & Architecture"
date: 2026-05-09
tags: [Blog, VitePress, Tech Stack, Automation]
---

# Blog Overview — Tech Stack & Architecture

This blog is a **fully automated multilingual tech blog**.
When you chat with a Telegram bot or leave a comment on news, the AI writes a blog post, translates it, and deploys it automatically.

---

## 🏗️ Overall Architecture

```
[Telegram Bot] → [Gemini AI] → [Markdown Generation]
                                    ↓
                            [Auto Translation (EN/JA)]
                                    ↓
                          [Git Commit & Push]
                                    ↓
                     [GitHub Actions → GitHub Pages]
                                    ↓
                        [VitePress Static Site]
```

---

## 📦 Frontend (Blog)

| Tech | Version | Purpose |
|------|---------|---------|
| **VitePress** | v1.6.4 | Static Site Generator (SSG) |
| **Vue.js** | v3.4 | Internal framework for VitePress, Custom components |
| **Markdown** | — | Blog content format |

### Why VitePress?

1. **Excellent Performance** — Minimal client-side JavaScript for fast loading
2. **High Security** — Serves purely static files, eliminating server-side vulnerabilities
3. **Developer Friendly** — Docs-style layout to focus on content

---

## 🌍 Multilingual Support

| Language | Path | Auto Translation |
|:--------:|:----:|:----------------:|
| 🇰🇷 Korean | `/blog/` | Original |
| 🇺🇸 English | `/en/blog/` | ✅ Gemini AI |
| 🇯🇵 Japanese| `/ja/blog/` | ✅ Gemini AI |

- Independent sidebars and navigation per language using VitePress `locales` configuration
- Trigger auto translation via `/post` or `/sync` commands in the Telegram bot

---

## 🎨 Design System

Applied **6:3:1 Color Ratio**:

| Ratio | Role | Color |
|:-----:|------|-------|
| 60% | Base | `#ffffff` (Light) / `#0f172a` (Dark) |
| 30% | Secondary | `#2563eb` (Blue) |
| 10% | Point | `#f97316` (Orange) |

- Supports Light/Dark mode switching
- Theme management via CSS Custom Properties

---

## 🤖 Backend (Telegram Bot)

| Tech | Purpose |
|------|---------|
| **Python 3.9+** | Bot main runtime |
| **python-telegram-bot** | Telegram Bot API integration |
| **Google Gemini API** | AI chat, Blog writing, Translation |
| **feedparser** | Google News RSS scraping |
| **schedule** | News broadcasting scheduler (Daily 09:00 KST) |
| **GitPython** | Auto commit/push to blog repository |

### Key Bot Commands

| Command | Function |
|---------|----------|
| `/post [Title]` | Conversation-based auto blog writing + Translation + Deployment |
| `/write` | Direct markdown input posting |
| `/sync` | Batch translate untranslated posts |
| `/usage` | Check API token usage |
| `/reset` | Reset conversation session |

### AI Model Separation

| Model | Temperature | Purpose |
|-------|:-----------:|---------|
| `chat_model` | 0.7 | Natural conversation |
| `post_model` | 0.2 | Fact-based blog writing (Minimize hallucination) |

---

## 🔗 Third-party Integrations

| Service | Purpose |
|---------|---------|
| **Giscus** | Serverless comment system based on GitHub Discussions |
| **Google Analytics 4** | Visitor traffic and country/language statistics tracking |
| **RSS Feed** | Auto-generate subscription feeds for 3 languages (`feed.xml`) |
| **Sitemap** | Auto-generate sitemap for SEO |
| **Google Search Console** | Search visibility management and indexing |

---

## 🚀 CI/CD Pipeline

```
Code Push (main branch)
     ↓
Trigger GitHub Actions
     ↓
npm ci → vitepress build
     ↓
Auto-generate sitemap.xml + feed.xml
     ↓
Auto deploy to GitHub Pages
```

- **Build Time**: ~4 seconds
- **Deployment**: GitHub Pages (Static Hosting)
- **Branch Strategy**: Auto deploy on `main` branch push

---

## 🛡️ Security

| Item | Method |
|------|--------|
| API Key Management | `.env` + `.gitignore` (Excluded from Git) |
| Bot Source Auto Backup | Auto commit/push every 1 hour (`auto_push.py`) |
| Static Site | No server-side code → Minimized attack surface |
| Comment System | GitHub OAuth-based authentication (Giscus) |

---

## 📁 Project Structure

```
uoosnn.github.io/          ← Blog (VitePress)
├── .vitepress/
│   ├── config.mjs          ← Site config, Sidebar, RSS, Sitemap
│   └── theme/
│       ├── custom.css       ← 6:3:1 Theme
│       ├── index.mjs        ← Giscus layout extension
│       └── components/
│           └── GiscusComment.vue  ← Comment component
├── blog/                   ← Korean original posts
├── en/blog/                ← English translations
├── ja/blog/                ← Japanese translations
├── resume.md               ← Resume (Multilingual)
└── .github/workflows/
    └── deploy.yml           ← CI/CD pipeline

telegram_bot/               ← Telegram Bot
├── bot_main.py             ← Main entrypoint
├── ai_processor.py         ← Gemini AI processing
├── github_uploader.py      ← Git upload
├── news_scraper.py         ← News scraping
└── auto_push.py            ← Auto commit/push
```

---

*This blog is a fully automated system running without a backend server. Chat on Telegram to write a post, the AI translates it, and GitHub Actions deploys it.*
