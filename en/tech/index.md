---
title: "Tech Knowledge Base & System Architecture"
description: "A technical knowledge base for cloud infrastructure, real-world troubleshooting, incident response, and AWS zero-cost serverless automation."
date: 2026-08-23
tags: [Tech, Architecture, Infrastructure, Troubleshooting, Security, Serverless, AWS, Linux]
---

# 🛠️ Tech Knowledge Base & System Architecture

This engineering knowledge hub consolidates hands-on technical records and expertise gained as a systems engineer—spanning **Cloud (AWS) Infrastructure Architecture**, **Production Incident Troubleshooting**, **Security Incident Response**, and a **Fully Automated Zero-Cost Serverless Pipeline**.

Beyond high-level tutorials, this space documents deep-dive engineering practices: tracing system calls with `strace`, designing zero-downtime database migrations, and building permanently free (Always Free) serverless pipelines.

---

## 🧭 Technical Categories (Category Map)

<div class="tip custom-block" style="padding-top: 8px">
Click on any article title in the tables below to read the detailed technical documentation.
</div>

### 1. ☁️ Cloud Infrastructure & Migration
Architecture design and migration practices focused on minimizing downtime and maximizing system reliability across cloud and on-premises environments.

| Article Title | Key Focus | Date |
|:---|:---|:---:|
| [EBS Snapshot vs AMI: Technical Comparison for AWS Backup Strategy](./AWS%20백업,%20스냅샷과%20AMI의%20차이와%20선택%20기준.md) | AWS EBS/AMI snapshot mechanisms, Data Lifecycle Manager (DLM) RPO/RTO optimization | 2026-08-05 |
| [Minimizing Downtime with RDS Blue/Green Deployment](./다운타임을%20최소화하는%20RDS%20블루그린%20마이그레이션.md) | Aurora MySQL major/minor version upgrades, replication lag management, sub-minute switchovers | 2026-07-28 |
| [Importance of ARNs When Restoring Accidentally Deleted AWS SNS Topics](./삭제된%20AWS%20SNS%20주제%20복구%20시%20ARN의%20중요성.md) | Restoring deleted SNS topics with identical ARNs to seamlessly reconnect CloudWatch Alarms | 2026-07-08 |
| [Step-by-Step Legacy Server Migration Process](./레거시%20서버의%20단계별%20마이그레이션%20과정.md) | Phased transition of legacy PHP/MySQL stacks to modern OS and MariaDB with data integrity validation | 2026-05-17 |
| [Server Disk Replacement: Why It's More Than a Simple Task](./서버%20디스크%20교체,%20간단한%20작업이%20아닌%20이유.md) | Filesystem unmounting, `rsync` incremental sync, `fstab` UUID verification, and live maintenance | 2026-05-17 |

---

### 2. 🛡️ Production Troubleshooting & Security
Rigorous troubleshooting case studies resolving silent daemon crashes, hardware communication failures, and real-world web server exploitation via log, packet, and system call analysis.

| Article Title | Key Focus | Date |
|:---|:---|:---:|
| [Troubleshooting: React2Shell (CVE-2025-55182) Incident Analysis & Response](./실전%20트러블슈팅%20-%20React2Shell%20(CVE-2025-55182)%20침해%20사고%20분석%20및%20대응%20후기.md) | Remote Code Execution (RCE) root cause analysis, webshell quarantine, and emergency firewall response | 2026-05-17 |
| [Troubleshooting Logless Apache SSL Crashes with strace](./로그%20없는%20아파치%20SSL%20오류,%20strace로%20분석.md) | Diagnosing silent Apache startup crashes using `strace` to identify certificate permission and entropy issues | 2026-05-21 |
| [Fixing MSSQL Configuration Manager Errors via Shared Feature Repair](./MSSQL%20구성%20관리자%20오류,%20공유%20기능%20복구로%20해결하기.md) | Resolving WMI provider errors in SQL Server Configuration Manager by recompiling MOF files | 2026-07-20 |
| [Why MRTG Traffic Graphs Fail to Explain Server Latency](./MRTG%20트래픽%20그래프로%20서버%20속도를%20알%20수%20없는%20이유.md) | Limitations of averaged bandwidth metrics; diagnosing packet loss, jitter, and TCP window constraints | 2026-07-10 |
| [Network Security Configuration with FortiGate Firewall](./Forti%20방화벽을%20활용한%20네트워크%20보안%20구성.md) | DMZ network segmentation, Virtual IP (VIP) forwarding, and zone-based security policy design | 2026-05-17 |
| [Lenovo Server XCC Unreachable Troubleshooting After IDC Relocation](./PM과의%20협업%20갈등,%20IDC%20이전%20프로젝트%20회고.md) | Diagnosing physical IDC relocation issues, BMC/XCC port communication failures, and BIOS reconfigurations | 2026-06-26 |

---

### 3. ⚙️ Serverless Automation & Blog Architecture
The fully automated, zero-cost serverless architecture and multilingual static pipeline powering this platform.

| Article Title | Key Focus | Date |
|:---|:---|:---:|
| [Enhancing VitePress Blog: Notion-Style Tags and Project Showcase](./정적-블로그-VitePress-고도화-노션-태그-프로젝트-쇼케이스-구축기.md) | Notion-style tag badges, build-time data loaders, 4-project showcase, and CI/CD alerts | 2026-08-23 |
| [Migrating Telegram Bot to AWS Lambda $0 Serverless: Troubleshooting Review](./상시%20서버%20텔레그램%20봇을%20AWS%20Lambda%200원%20서버리스로%20전환한%20실전%20트러블슈팅%20후기.md) | Achieving $0 VM cost, Lambda Function URL + DynamoDB session handling, and real troubleshooting | 2026-08-23 |
| [Building a Multilingual Blog with VitePress](./VitePress-다국어-블로그-구축기.md) | Setting up trilingual (KO/EN/JA) routing, custom dark theme, and components with VitePress | 2026-05-16 |

---

### 4. 🌐 Web Performance, Accessibility & Supply Chain Security
Optimizing SEO, Web Accessibility (A11y), eliminating render-blocking resources for perfect Google Lighthouse scores, and securing npm dependencies.

| Article Title | Key Focus | Date |
|:---|:---|:---:|
| [Mobile Performance and Accessibility Optimization via Search Console](./서치%20콘솔%20기반%20모바일%20성능%20및%20접근성%20최적화.md) | Data-driven optimization via Search Console: async CSS, GA4 deferred loading, 100 Lighthouse score | 2026-08-15 |
| [VitePress Static Blog npm Dependency Vulnerability Analysis & Fix](./정적%20블로그%20npm%20취약점%20점검%20및%20대응%20후기.md) | Supply chain vulnerability mitigation with `npm audit`, CI/CD build hardening, and package overrides | 2026-08-09 |

---

## 🏗️ Modern System Architecture (AWS $0 Serverless Pipeline)

This platform (`uoosnn.com`) operates on an event-driven serverless architecture pairing **AWS Always Free Tier** with **GitHub Pages**, achieving **$0 monthly operating costs** and **Zero-Ops infrastructure maintenance**.

```mermaid
flowchart TD
    subgraph Client_Layer [User & Telegram Client]
        User[Admin / User] -->|Messages / Photos / /post commands| TG[Telegram Bot API]
    end

    subgraph AWS_Serverless [AWS Always Free Serverless Layer ($0 Cost)]
        TG -->|HTTPS POST Webhook| FURL[Lambda Function URL\n(No API Gateway needed, $0)]
        FURL --> LAMBDA[AWS Lambda\n(Python 3.12 / x86_64, 256MB)]
        
        CRON[Amazon EventBridge\n(Daily 09:00 KST News Trigger)] -->|Scheduled Trigger| LAMBDA
        
        LAMBDA <--> DYNAMO[(Amazon DynamoDB\ntelegram_bot_state / 25GB Always Free)]
    end

    subgraph AI_External [AI & External Services]
        LAMBDA -->|Chat / Blog Generation / Multilingual Translation| GEMINI[Google Gemini API\n(Flash 2.5 / 3.0)]
        LAMBDA -->|PyGithub REST API Direct Commits| GH_API[GitHub REST API\nuoosnn/uoosnn.github.io]
    end

    subgraph CI_CD_Hosting [Deployment & Global Hosting]
        GH_API -->|main branch push event| ACTIONS[GitHub Actions\n(npm ci -> vitepress build)]
        ACTIONS -->|sitemap.xml + feed.xml auto-generation| PAGES[GitHub Pages\n(Global CDN Static Hosting)]
    end

    PAGES -->|Fast Loading / Lighthouse 100| READER[Visitors (Web Browser)]
```

### 💡 5 Core Principles of the Zero-Cost (Always Free) Architecture

1. **AWS Lambda (1M free requests/month)**:
   - Eliminates 24/7 VM hosting costs by spinning up in under 100ms only when an event occurs. Personal bot usage consumes less than 0.01% of the monthly free allowance.
2. **Lambda Function URL ($0 HTTPS Endpoint)**:
   - Connects Telegram Webhooks directly to Lambda without API Gateway overhead, keeping endpoint costs strictly at $0.
3. **Amazon DynamoDB (25GB Always Free Tier)**:
   - Stores session state, conversation history, news deduplication records, and API usage counters in a single table (`telegram_bot_state`) with a 7-day TTL for automated data cleanup.
4. **PyGithub REST API Commits (Diskless I/O)**:
   - Direct remote commits via GitHub REST API without requiring local Git binaries, storage volumes, or local repository cloning.
5. **VitePress + GitHub Pages (High-Speed Static Hosting)**:
   - Compiles pure HTML/CSS/JS deployed to global CDNs, eliminating server-side attack vectors while maximizing page load performance.

---

## 📊 Tech Stack Overview

| Domain | Technology | Version/Tier | Role & Features |
|:---|:---|:---:|:---|
| **Frontend (SSG)** | **VitePress** | v1.6.4 | High-performance SSG powered by Vue 3.4 |
| **Design System** | **Custom CSS** | 6:3:1 Palette | Dark/Light mode switch, Glassmorphism, responsive UI |
| **Serverless Backend** | **AWS Lambda** | Python 3.12 | Webhook receiver, async event dispatch, AI post generator |
| **State Storage** | **Amazon DynamoDB** | On-Demand | 25GB Always Free, session persistence, news history, TTL |
| **Scheduler** | **Amazon EventBridge** | Cron (09:00 KST) | Daily morning IT/Security news ingestion trigger |
| **AI Models** | **Google Gemini API** | Flash Models | Conversational post generation, real-time trilingual translation |
| **CI/CD & Hosting** | **GitHub Actions / Pages** | Ubuntu Latest | Automated build, multilingual RSS (`feed.xml`) and `sitemap.xml` |
| **Comments** | **Giscus** | GitHub Discussions | Serverless discussion system authenticated via GitHub OAuth |
| **Analytics** | **Google Analytics 4** | gtag.js (Deferred) | 0ms TBT impact with deferred asynchronous tracking |

---

## 🌍 Multilingual Pipeline (Multilingual Engine)

Leveraging VitePress's native `locales` and Gemini AI translation, newly published Korean content is automatically translated and deployed across three languages simultaneously.

```
[Korean Original Post]  --->  /blog/ or /tech/
       │
       ├─── [Gemini AI Translation] ───> /en/blog/ or /en/tech/  (🇺🇸 English)
       └─── [Gemini AI Translation] ───> /ja/blog/ or /ja/tech/  (🇯🇵 日本語)
```

- **Clean URL Structure**: `ko` (root), `en` (`/en/`), `ja` (`/ja/`)
- **SEO Optimization**: Automatic injection of `hreflang` tags, `canonical` URLs, and `TechArticle` / `BlogPosting` Schema.org JSON-LD structured data.

---

## 🚀 Upcoming Engineering Topics

- 📌 **Container Orchestration & Monitoring with AWS ECS / EKS**
- 📌 **Infrastructure as Code (IaC) with Terraform & AWS CDK**
- 📌 **Linux Kernel Tuning & Socket-Level Network Optimization**
- 📌 **Enterprise Observability with Prometheus and Grafana**

---

*Hand-crafted technical notes and troubleshooting records are continuously updated. Feel free to leave comments or connect via GitHub.*
