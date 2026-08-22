---
title: "Enhancing VitePress Blog: Notion-Style Tags and Interactive Project Showcase"
description: "How we evolved a static VitePress blog into an engineering branding platform using Notion-style tags, client-side filtering, and metric-driven project showcase components."
date: 2026-08-23
tags: [Tech, VitePress, Frontend, Architecture, UI/UX, Showcase, Automation, DevOps]
---

# 🚀 Enhancing VitePress Blog: Notion-Style Tags and Interactive Project Showcase

As our blog (`uoosnn.com`) accumulated nearly 20 in-depth technical articles covering infrastructure troubleshooting, security incident responses, and $0 serverless architectures, we encountered a fundamental structural UX challenge:

> *"How can visitors and hiring managers pinpoint specific topics among dozens of technical posts in a split second?"*  
> *"Beyond a plain text resume, how can we demonstrate system architectures and quantifiable engineering impact at a glance?"*

To solve this, we integrated **Vue 3 custom components and VitePress SSG build-time data loaders** to build a **Notion-style tagging system** and an **interactive project showcase (`/en/projects`)**. Here is the engineering design and implementation breakdown.

---

## 1. Designing Notion-Style Tag Pills & Labels

### ① Problem & UX Goal
Although frontmatter `tags: [AWS, Security, Troubleshooting]` were specified, an intuitive and interactive UI to browse by tags was missing. We benchmarked the familiar pastel-tone pill badges from Notion databases.

### ② Domain-Aware Color Mapping
Each tag automatically receives a tailored pastel theme:
- 🔵 **Blue**: `AWS`, `Cloud`, `Network`, `Linux`, `RDS` (Infrastructure & Cloud)
- 🟢 **Green**: `Troubleshooting`, `Performance`, `Automation` (Performance & Ops)
- 🔴 **Red**: `Security`, `CVE`, `Incident`, `Forensic` (Security & Incident Response)
- 🟣 **Purple**: `Serverless`, `Lambda`, `AI`, `Gemini`, `Architecture` (Serverless & AI)
- 🟡 **Yellow**: `Windows`, `WSL`, `MySQL`, `Database`, `C++` (DB & OS)
- ⚪ **Gray**: `VitePress`, `Tech`, `Blog` (General)

---

## 2. Build-Time Data Loader & Real-Time Filtering (`TagFilterBoard.vue`)

In an SSG environment, parsing all Markdown files at browser runtime causes performance degradation (higher TBT).  
Using VitePress's built-in `createContentLoader`, we built `posts.data.mjs` to compile all post metadata into structured JSON at build time.

`TagFilterBoard.vue` delivers:
1. **Per-Tag Post Counts**: Real-time aggregation (e.g., `#AWS (6)`)
2. **URL Query Synchronization (`?tag=AWS`)**: Direct deep-linking with auto-filter state
3. **Keyword Debounced Search**: Fast live filtering across titles, summaries, and tags

---

## 3. Metric-Driven Project Showcase (`/en/projects`)

Rather than listing project titles passively, each project follows a structured engineering breakdown:  
**`Problem Definition` → `Technical Solution` → `Key Quantifiable Metrics` → `Direct Tech Deep Dive Links`**.

### Featured 4 Core Projects
1. **AWS $0 Always Free Serverless Telegram Blog Automation Pipeline (2026)**
   - *Key Metrics*: $0/month infrastructure cost, <1 min mobile remote publishing, 100% Zero-Ops
2. **Hybrid Cloud IDC Zero-Downtime Migration & TCO Cost Optimization (2021-2026)**
   - *Key Metrics*: RDS Blue/Green switchover in seconds, 30% operational cost reduction
3. **CVE-2025-55182 (React2Shell) Incident Response & Syscall Forensics (2026)**
   - *Key Metrics*: Full containment & recovery within 1 hour, 0 secondary breach incidents
4. **Coline Incubator & Anger Control Disorder (C++ Game Engine & Tutoring) (2019-2025)**
   - *Key Metrics*: University Capstone Award, public YouTube video courses, open-source GitHub release

---

## 4. Post Metadata & Estimated Reading Time (`ReadingTime.vue`)

Injected via the VitePress `doc-before` layout slot, each post renders a clean header:
- 📅 **Publication Date**
- ⏱️ **Estimated Reading Time**: ~500 chars/words per minute calculation
- 📁 **Category Distinction**: `Tech & Architecture` / `Blog & Life`
- 🏷️ **Clickable Notion-style Tags**

---

## 5. Automated CI/CD Notification

Integrated a Telegram notification step in GitHub Actions (`deploy.yml`) to receive build status, commit messages, and deployment URLs right on mobile upon every push.

---

## 6. Conclusion & Roadmap

Through this enhancement, `uoosnn.github.io` has transformed into an **interactive engineering portfolio and knowledge hub**.  
Next, we will publish a series on **Windows 11 + WSL2 Terraform IaC Automation** and **Local Prometheus & Grafana Observability**.
