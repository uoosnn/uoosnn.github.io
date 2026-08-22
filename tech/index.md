---
title: "기술 아카이브 & 시스템 아키텍처"
description: "클라우드 인프라 운영, 실전 장애 트러블슈팅, 보안 침해사고 대응, 그리고 AWS 0원 서버리스 자동화 시스템 엔지니어링 지식 베이스"
date: 2026-08-23
tags: [Tech, Architecture, Infrastructure, Troubleshooting, Security, Serverless, AWS, Linux]
---

# 🛠️ 기술 아카이브 & 시스템 아키텍처

시스템 엔지니어로서 실무에서 마주한 **클라우드(AWS) 인프라 아키텍처**, **실전 장애 트러블슈팅**, **보안 사고 대응(Incident Response)**, 그리고 **완전 자동화된 0원 서버리스 파이프라인**의 기술적 기록과 노하우를 집약한 엔지니어링 지식 베이스(Tech Knowledge Hub)입니다.

단순한 튜토리얼을 넘어 현장에서 직접 시스템 콜(`strace`)을 역추적하고, 무중단 마이그레이션을 설계하며, 영구 무료(Always Free) 서버리스 파이프라인을 구축한 실무 엔지니어링 과정을 공유합니다.

---

## 🧭 주요 기술 카테고리 (Category Map)

<div class="tip custom-block" style="padding-top: 8px">
각 카테고리별 카드를 클릭하면 상세 기술 문서로 바로 이동할 수 있습니다.
</div>

### 1. ☁️ 클라우드 인프라 & 마이그레이션 (Cloud & Infrastructure)
클라우드 및 온프레미스 인프라 환경에서 다운타임을 최소화하고 시스템 안정성을 극대화하기 위한 아키텍처 설계와 마이그레이션 실무 기록입니다.

| 아티클 제목 | 핵심 주제 | 게시일 |
|:---|:---|:---:|
| [EBS 스냅샷과 AMI: AWS 백업 전략 수립을 위한 기술적 비교 분석](./AWS%20백업,%20스냅샷과%20AMI의%20차이와%20선택%20기준.md) | AWS EBS/AMI 스냅샷 메커니즘, Data Lifecycle Manager(DLM) RPO/RTO 최적화 | 2026-08-05 |
| [다운타임을 최소화하는 RDS 블루/그린 마이그레이션](./다운타임을%20최소화하는%20RDS%20블루그린%20마이그레이션.md) | Aurora MySQL 버전 업그레이드, 복제 지연 제어 및 수십 초 이내 무중단 절체(Switchover) | 2026-07-28 |
| [삭제된 AWS SNS 주제 복구 시 ARN의 중요성](./삭제된%20AWS%20SNS%20주제%20복구%20시%20ARN의%20중요성.md) | 오삭제된 SNS 토픽과 CloudWatch Alarm 연동 단절 시 동일 ARN 재생성을 통한 무중단 복구 | 2026-07-08 |
| [레거시 서버의 단계별 마이그레이션 과정](./레거시%20서버의%20단계별%20마이그레이션%20과정.md) | 구형 PHP/MySQL 환경의 최신 OS 및 MariaDB 단계별 전환, 데이터 정합성 검증 프로세스 | 2026-05-17 |
| [서버 디스크 교체, 간단한 작업이 아닌 이유](./서버%20디스크%20교체,%20간단한%20작업이%20아닌%20이유.md) | 파일시스템 언마운트, `rsync` 증분 동기화, `fstab` UUID 검증 등 디스크 교체 엔지니어링 | 2026-05-17 |

---

### 2. 🛡️ 실전 트러블슈팅 & 보안 대응 (Troubleshooting & Security)
원인 불명의 데몬 크래시, 하드웨어 통신 단절, 그리고 실제 웹 서버 보안 침해 사고 현장에서 시스템 로그와 패킷, 시스템 콜을 정밀 분석하여 문제를 해결한 실전 트러블슈팅 기록입니다.

| 아티클 제목 | 핵심 주제 | 게시일 |
|:---|:---|:---:|
| [실전 트러블슈팅: React2Shell (CVE-2025-55182) 침해 사고 분석 및 대응 후기](./실전%20트러블슈팅%20-%20React2Shell%20(CVE-2025-55182)%20침해%20사고%20분석%20및%20대응%20후기.md) | 원격 코드 실행(RCE) 침해 경로 역추적, 웹쉘 격리 및 방화벽 차단 긴급 대응 실무 | 2026-05-17 |
| [로그 없는 아파치 SSL 오류, strace로 분석한 트러블슈팅](./로그%20없는%20아파치%20SSL%20오류,%20strace로%20분석.md) | 에러 로그 없는 Apache 크래시 현상을 `strace` 시스템 콜 추적으로 인증서 및 엔트로피 문제 규명 | 2026-05-21 |
| [MSSQL 구성 관리자 오류, 공유 기능 복구로 해결하기](./MSSQL%20구성%20관리자%20오류,%20공유%20기능%20복구로%20해결하기.md) | WMI 공급자 오류로 인한 SQL Server Configuration Manager 실행 불가 시 MOF 재컴파일 복구 | 2026-07-20 |
| [MRTG 트래픽 그래프로 서버 속도를 알 수 없는 이유](./MRTG%20트래픽%20그래프로%20서버%20속도를%20알%20수%20없는%20이유.md) | 평균 대역폭 지표의 한계 분석, 패킷 손실, 지터, TCP 윈도우 크기에 따른 병목 진단법 | 2026-07-10 |
| [Forti 방화벽을 활용한 네트워크 보안 구성](./Forti%20방화벽을%20활용한%20네트워크%20보안%20구성.md) | FortiGate 기반 DMZ 망분리, Virtual IP(VIP) 포워딩 및 존(Zone) 기반 보안 정책 수립 | 2026-05-17 |
| [IDC 이전 후 Lenovo 서버 XCC 접근 불가 이슈 트러블슈팅 로그](./PM과의%20협업%20갈등,%20IDC%20이전%20프로젝트%20회고.md) | 물리적 IDC 이전 후 발생한 XCC(BMM) 관리 포트 통신 단절 및 BIOS/네트워크 재구성 해결 | 2026-06-26 |

---

### 3. ⚙️ 서버리스 자동화 & 블로그 아키텍처 (Architecture & Automation)
본 블로그와 텔레그램 봇 시스템을 지탱하는 완전 자동화된 서버리스 파이프라인과 다국어 정적 사이트 구조입니다.

| 아티클 제목 | 핵심 주제 | 게시일 |
|:---|:---|:---:|
| [VitePress 다국어 블로그 구축기](./VitePress-다국어-블로그-구축기.md) | VitePress 기반 3개 국어(KO/EN/JA) 라우팅, 커스텀 다크 테마 및 컴포넌트 설계 | 2026-05-16 |
| [AWS Lambda 0원 서버리스 텔레그램 봇 아키텍처](#-최신-시스템-아키텍처-aws-0원-서버리스-파이프라인) | 상시 서버 없이 Lambda + DynamoDB + Function URL 기반으로 운영 비용 0원을 달성한 No-Ops 파이프라인 | 2026-08-23 |

---

### 4. 🌐 웹 성능, 접근성 & 공급망 보안 (Web Performance & DevOps)
검색 엔진 최적화(SEO), 웹 접근성(A11y), 렌더링 차단 리소스 제거를 통한 Google Lighthouse 만점 달성 및 npm 의존성 보안 강화 기록입니다.

| 아티클 제목 | 핵심 주제 | 게시일 |
|:---|:---|:---:|
| [서치 콘솔 기반 모바일 성능 및 접근성 최적화](./서치%20콘솔%20기반%20모바일%20성능%20및%20접근성%20최적화.md) | Google Search Console 데이터 기반 CSS 비동기 로딩, GA4 지연 로드 및 Lighthouse 100점 달성 | 2026-08-15 |
| [정적 블로그 npm 의존성 취약점 분석 및 해결 기록](./정적%20블로그%20npm%20취약점%20점검%20및%20대응%20후기.md) | `npm audit` 기반 공급망 취약점 분석, 빌드 파이프라인 보안 강화 및 패키지 오버라이드 | 2026-08-09 |

---

## 🏗️ 최신 시스템 아키텍처 (AWS 0원 서버리스 파이프라인)

본 블로그(`uoosnn.com`)는 **AWS Always Free Tier**와 **GitHub Pages**를 결합하여 **상시 서버 가동 비용 0원(월 0원)** 및 **관리 부담 제로(Zero-Ops)**를 달성한 이벤트 기반 서버리스 아키텍처로 구동됩니다.

```mermaid
flowchart TD
    subgraph Client_Layer [사용자 & 텔레그램 클라이언트]
        User[사용자 / 관리자] -->|메시지 / 사진 / /post 명령어| TG[Telegram Bot API]
    end

    subgraph AWS_Serverless [AWS Always Free 서버리스 계층 (비용 0원)]
        TG -->|HTTPS POST Webhook| FURL[Lambda Function URL\n(API Gateway 불필요, 비용 0원)]
        FURL --> LAMBDA[AWS Lambda\n(Python 3.12 / x86_64, 256MB)]
        
        CRON[Amazon EventBridge\n(매일 09:00 KST 뉴스 수집)] -->|Scheduled Trigger| LAMBDA
        
        LAMBDA <--> DYNAMO[(Amazon DynamoDB\ntelegram_bot_state / 25GB 영구 무료)]
    end

    subgraph AI_External [AI & 외부 서비스 연동]
        LAMBDA -->|대화 처리 & 블로그 마크다운 생성 & 다국어 번역| GEMINI[Google Gemini API\n(Flash 2.5 / 3.0)]
        LAMBDA -->|PyGithub REST API 직접 커밋| GH_API[GitHub REST API\nuoosnn/uoosnn.github.io]
    end

    subgraph CI_CD_Hosting [배포 & 호스팅 파이프라인]
        GH_API -->|main 브랜치 Push 트리거| ACTIONS[GitHub Actions\n(npm ci -> vitepress build)]
        ACTIONS -->|sitemap.xml + feed.xml 자동 생성| PAGES[GitHub Pages\n(글로벌 CDN 정적 호스팅)]
    end

    PAGES -->|고속 로딩 / Lighthouse 100점| READER[방문자 (웹 브라우저)]
```

### 💡 0원(Always Free) 인프라 설계 5대 원칙

1. **AWS Lambda (월 100만 회 무료)**:
   - 상시 켜두는 VM/EC2 대신 이벤트가 들어올 때만 100ms 이내 기동되어 실행됩니다. 개인 봇 트래픽 기준 월 무료 한도의 0.01% 미만을 사용합니다.
2. **Lambda Function URL (HTTPS 엔드포인트 0원)**:
   - 유료 호출 비용이 발생할 수 있는 API Gateway를 배제하고, Lambda 자체 Function URL을 통해 텔레그램 웹훅을 직결하여 엔드포인트 비용을 0원으로 유지합니다.
3. **Amazon DynamoDB (25GB 스토리지 영구 무료)**:
   - 세션 상태, 대화 히스토리, 일일 뉴스 전송 이력, API 사용량 집계를 단일 테이블(`telegram_bot_state`)에서 관리하며, TTL(7일 자동 삭제)을 통해 용량을 항상 최적화합니다.
4. **PyGithub REST API 커밋 (디스크리스 I/O)**:
   - Lambda 내부 디스크에 무거운 Git 바이너리나 레포지토리 클론 없이, GitHub REST API를 통해 마크다운 및 이미지를 원격 저장소로 직접 원격 커밋합니다.
5. **VitePress + GitHub Pages (초고속 정적 배포)**:
   - 빌드된 순수 HTML/CSS/JS만을 글로벌 CDN으로 배포하여 서버 측 취약점을 원천 차단하고 최고 수준의 페이지 로딩 성능을 보장합니다.

---

## 📊 기술 스택 구성 (Tech Stack)

| 영역 | 사용 기술 | 버전/스펙 | 역할 및 특징 |
|:---|:---|:---:|:---|
| **프론트엔드 (SSG)** | **VitePress** | v1.6.4 | Vue 3.4 기반 초고속 정적 사이트 생성기 |
| **디자인 시스템** | **Custom CSS** | 6:3:1 배색 | Dark/Light 테마 토글, Glassmorphism, 모바일 반응형 |
| **서버리스 백엔드** | **AWS Lambda** | Python 3.12 | Webhook 수신, 비동기 디스패치, AI 블로그 생성 |
| **영속 상태 저장소** | **Amazon DynamoDB** | On-Demand | 25GB 영구 무료, 세션 관리, 뉴스 중복 발송 방지, TTL 적용 |
| **스케줄러** | **Amazon EventBridge** | Cron (09:00 KST) | 매일 아침 IT/보안 주요 뉴스 자동 수집 트리거 |
| **인공지능 모델** | **Google Gemini API** | Flash Models | 대화형 블로그 작성, 3개 국어(KO/EN/JA) 실시간 교차 번역 |
| **CI/CD & 배포** | **GitHub Actions / Pages** | Ubuntu Latest | 자동 빌드, RSS 3개 국어 피드(`feed.xml`) 및 `sitemap.xml` 생성 |
| **댓글 & 피드백** | **Giscus** | GitHub Discussions | 서버리스 댓글 시스템 (GitHub OAuth 인증) |
| **모니터링 & 분석** | **Google Analytics 4** | gtag.js (지연 로드) | TBT 0ms 보장 비동기 트래픽 분석, Search Console 연동 |

---

## 🌍 다국어 지원 체계 (Multilingual Engine)

VitePress의 `locales` 기능과 Gemini AI의 번역 파이프라인을 결합하여 한국어 원본 작성 즉시 3개 언어로 동기화 배포됩니다.

```
[한국어 원본 포스트]  --->  /blog/ 또는 /tech/
       │
       ├─── [Gemini AI 번역] ───> /en/blog/ 또는 /en/tech/  (🇺🇸 English)
       └─── [Gemini AI 번역] ───> /ja/blog/ 또는 /ja/tech/  (🇯🇵 日本語)
```

- **표준 URL 구조**: `ko` (루트), `en` (`/en/`), `ja` (`/ja/`)
- **SEO 최적화**: 각 페이지마다 `hreflang` 태그, `canonical` URL, 그리고 `TechArticle` / `BlogPosting` Schema.org 구조화 데이터를 자동으로 삽입합니다.

---

## 🚀 앞으로의 기록 계획

- 📌 **AWS ECS / EKS 기반 컨테이너 오케스트레이션 및 모니터링 구축기**
- 📌 **IaC (Terraform / AWS CDK)를 활용한 서버리스 인프라 코드 관리**
- 📌 **Linux 커널 튜닝 및 네트워크 소켓 레벨 성능 최적화 사례**
- 📌 **Prometheus / Grafana를 이용한 엔터프라이즈 통합 옵저버빌리티(Observability)**

---

*현장에서 발생한 기술적 고민과 트러블슈팅의 기록은 지속적으로 업데이트됩니다. 문의나 제안은 언제든 댓글이나 GitHub를 통해 남겨주세요.*
