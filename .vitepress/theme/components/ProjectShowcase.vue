<template>
  <div class="project-showcase-container">
    <div
      v-for="project in localizedProjects"
      :key="project.id"
      class="project-card"
    >
      <!-- 프로젝트 헤더 -->
      <div class="project-card-header">
        <div>
          <h3 class="project-title">{{ project.title }}</h3>
        </div>
        <span class="project-period">{{ project.period }}</span>
      </div>

      <!-- 기술 스택 태그 -->
      <div class="post-card-tags" style="margin-bottom: 1rem;">
        <span
          v-for="tag in project.tags"
          :key="tag"
          :class="['notion-tag', getTagColor(tag)]"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- 문제 정의 (Problem) -->
      <div class="project-section">
        <span class="project-section-title">🎯 {{ labels.problem }}:</span>
        <span>{{ project.problem }}</span>
      </div>

      <!-- 해결 솔루션 (Solution) -->
      <div class="project-section">
        <span class="project-section-title">💡 {{ labels.solution }}:</span>
        <span>{{ project.solution }}</span>
      </div>

      <!-- 핵심 성과 지표 (Metrics) -->
      <div class="project-metrics-box">
        📊 <strong>{{ labels.metrics }}:</strong> {{ project.metrics }}
      </div>

      <!-- 관련 링크 버튼들 -->
      <div v-if="project.links && project.links.length > 0" class="project-links">
        <a
          v-for="link in project.links"
          :key="link.text"
          :href="link.url"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
          class="project-link-btn"
        >
          {{ link.icon || '🔗' }} {{ link.text }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const currentLang = computed(() => {
  if (route.path.startsWith('/en/')) return 'en'
  if (route.path.startsWith('/ja/')) return 'ja'
  return 'ko'
})

const labels = computed(() => {
  if (currentLang.value === 'en') {
    return { problem: 'Problem', solution: 'Solution', metrics: 'Key Results' }
  }
  if (currentLang.value === 'ja') {
    return { problem: '課題定義', solution: '解決策', metrics: '主な成果' }
  }
  return { problem: '문제 정의', solution: '해결 솔루션', metrics: '핵심 성과 지표' }
})

const getTagColor = (tag) => {
  const t = tag.toLowerCase()
  if (t.includes('aws') || t.includes('cloud') || t.includes('network') || t.includes('linux') || t.includes('rds')) return 'notion-tag-blue'
  if (t.includes('troubleshoot') || t.includes('성능') || t.includes('performance') || t.includes('migration')) return 'notion-tag-green'
  if (t.includes('security') || t.includes('cve') || t.includes('incident') || t.includes('forensic')) return 'notion-tag-red'
  if (t.includes('serverless') || t.includes('lambda') || t.includes('ai') || t.includes('gemini') || t.includes('telegram')) return 'notion-tag-purple'
  if (t.includes('windows') || t.includes('wsl') || t.includes('sql') || t.includes('c++') || t.includes('directx')) return 'notion-tag-yellow'
  return 'notion-tag-gray'
}

const rawProjects = [
  {
    id: 'serverless-bot',
    period: '2026',
    tags: ['AWS Lambda', 'DynamoDB', 'Telegram Bot', 'Gemini AI', 'GitHub Actions', 'Serverless'],
    ko: {
      title: 'AWS 0원 Always Free 서버리스 텔레그램 블로그 자동화 파이프라인',
      problem: '블로그 포스팅 시 매번 PC 접속 및 마크다운 편집이 번거롭고, 상시 서버 가동으로 인한 불필요한 고정 비용 발생.',
      solution: '텔레그램 메시지/사진 전송 즉시 Lambda Function URL이 수신하여 DynamoDB 상태 관리, Gemini AI 다국어 번역, PyGithub REST API 원격 커밋 및 Pages 배포까지 100% 자동화.',
      metrics: '상시 가동 비용 월 0원 (Always Free 티어), 모바일 원격 포스팅 1분 완료, No-Ops 운영 환경 달성',
      links: [
        { text: '기술 아티클 보기', url: '/tech/상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기', icon: '📝' },
        { text: '블로그 Tech Hub', url: '/tech/', icon: '🛠️' }
      ]
    },
    en: {
      title: 'AWS $0 Always Free Serverless Telegram Blog Automation Pipeline',
      problem: 'Inefficient manual markdown posting on PC and recurring server costs for running always-on instances.',
      solution: 'Event-driven serverless pipeline using Telegram Webhook -> Lambda Function URL -> DynamoDB -> Gemini AI translation -> GitHub REST API commit -> GitHub Actions CDN deployment.',
      metrics: '$0/month running cost (Always Free Tier), <1 min mobile remote posting, 100% Zero-Ops maintenance',
      links: [
        { text: 'Read Technical Article', url: '/en/tech/상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기', icon: '📝' }
      ]
    },
    ja: {
      title: 'AWS 0円 Always Free サーバーレステレグラムブログ自動化パイプライン',
      problem: 'PCでの手動Markdown執筆の煩わしさと、常時稼働サーバーによる不要な固定費用の発生。',
      solution: 'Telegramメッセージ/画像送信即座にLambda Function URLが受信し、DynamoDB、Gemini AI翻訳、PyGithubコミット、GitHub Actions配信まで完全自動化。',
      metrics: '常時運用コスト月0円 (Always Free)、スマホから1分で投稿完了、完全No-Ops運用を実現',
      links: [
        { text: '技術記事を読む', url: '/ja/tech/상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기', icon: '📝' }
      ]
    }
  },
  {
    id: 'cloud-migration',
    period: '2021 ~ 2026',
    tags: ['Cloud Migration', 'Hybrid Cloud', 'AWS', 'NHN Cloud', 'RDS Blue-Green', 'Network Security'],
    ko: {
      title: '하이브리드 클라우드 IDC 무중단 마이그레이션 & TCO 최적화',
      problem: '공공기관 및 엔터프라이즈 레거시 시스템의 노후화, 다운타임 최소화 요구 및 제한된 예산 내 인프라 사이징.',
      solution: 'NHN 코로케이션 게이트웨이 연동 하이브리드 아키텍처 설계, Aurora RDS 블루/그린 마이그레이션 절체, L4/L7 부하 분산 및 TCO 비용 예측 모델 적용.',
      metrics: '마이그레이션 서비스 다운타임 수십 초 이내 절체 완료, 인프라 운영 비용(TCO) 30% 절감, 고가용성(HA) 확보',
      links: [
        { text: 'RDS 블루그린 마이그레이션 아티클', url: '/tech/다운타임을 최소화하는 RDS 블루그린 마이그레이션', icon: '📝' },
        { text: '레거시 서버 마이그레이션 아티클', url: '/tech/레거시 서버의 단계별 마이그레이션 과정', icon: '📝' },
        { text: '이력서 상세 보기', url: '/resume', icon: '💼' }
      ]
    },
    en: {
      title: 'Hybrid Cloud IDC Zero-Downtime Migration & TCO Cost Optimization',
      problem: 'Aging legacy systems for public institutions, strict minimal downtime requirements, and tight budgetary constraints.',
      solution: 'Hybrid architecture via NHN Colocation Gateway, RDS Blue/Green replication and switchover, L4/L7 load balancing, and cloud TCO estimation modeling.',
      metrics: 'Switchover downtime minimized to seconds, 30% operational cost reduction, 99.99% system availability',
      links: [
        { text: 'RDS Migration Article', url: '/en/tech/다운타임을 최소화하는 RDS 블루그린 마이그레이션', icon: '📝' },
        { text: 'View Resume', url: '/en/resume', icon: '💼' }
      ]
    },
    ja: {
      title: 'ハイブリッドクラウドIDC無停止マイグレーション & TCO最適化',
      problem: '公共機関・エンタープライズのレガシー老朽化、ダウンタイム最小化要求、限られた予算でのインフラ設計。',
      solution: 'NHNコロケーションゲートウェイ連携、Aurora RDSブルー/グリーン切り替え、L4/L7負荷分散およびTCOコスト予測モデルの導入。',
      metrics: '切り替えダウンタイムを数十秒以内に抑制、運用コスト(TCO) 30%削減、高可用性(HA)の確保',
      links: [
        { text: 'RDSマイグレーション記事', url: '/ja/tech/다운타임을 최소화하는 RDS 블루그린 마이그레이션', icon: '📝' },
        { text: '職務経歴書を見る', url: '/ja/resume', icon: '💼' }
      ]
    }
  },
  {
    id: 'security-incident',
    period: '2026',
    tags: ['Incident Response', 'Security', 'CVE-2025-55182', 'strace', 'Forensic', 'Linux Kernel'],
    ko: {
      title: 'CVE-2025-55182 (React2Shell) 침해 사고 긴급 포렌식 & 시스템콜 역추적',
      problem: '신종 RCE 원격 코드 실행 취약점을 통한 웹 서버 침해 및 백그라운드 악성 웹쉘 프로세스 기동 발생.',
      solution: 'strace 시스템 콜 역추적 및 네트워크 소켓 패킷 정밀 분석으로 웹쉘 유입 경로 규명, 악성 프로세스 긴급 격리, 방화벽 차단 및 패치 적용.',
      metrics: '최초 감지 후 1시간 이내 긴급 격리 및 정상 복구 완료, 2차 침해 피해 0건',
      links: [
        { text: '침해 사고 분석 아티클', url: '/tech/실전 트러블슈팅 - React2Shell (CVE-2025-55182) 침해 사고 분석 및 대응 후기', icon: '📝' },
        { text: 'strace 시스템콜 트러블슈팅', url: '/tech/로그 없는 아파치 SSL 오류, strace로 분석', icon: '📝' }
      ]
    },
    en: {
      title: 'CVE-2025-55182 (React2Shell) Security Incident Response & Syscall Forensics',
      problem: 'Remote Code Execution (RCE) exploitation on production web servers and unauthorized background webshell execution.',
      solution: 'Tracing system calls via `strace` and network socket analysis, isolating malicious processes, firewall lockdown, and root-cause mitigation.',
      metrics: 'Complete containment and restoration within 1 hour of detection, 0 secondary breach incidents',
      links: [
        { text: 'Read Incident Response Article', url: '/en/tech/실전 트러블슈팅 - React2Shell (CVE-2025-55182) 침해 사고 분석 및 대응 후기', icon: '📝' }
      ]
    },
    ja: {
      title: 'CVE-2025-55182 (React2Shell) セキュリティインシデント緊急対応 & システムコール解析',
      problem: '最新のRCE脆弱性を突いたWebサーバー侵害およびバックグラウンドでの不正WebShell稼働の発生。',
      solution: '`strace`システムコール追跡とネットワークソケット解析による侵入経路特定、不正プロセス隔離、ファイアウォール遮断および恒久対策。',
      metrics: '検知後1時間以内に緊急隔離および正常復旧完了、2次被害ゼロを達成',
      links: [
        { text: 'インシデント対応記事', url: '/ja/tech/실전 트러블슈팅 - React2Shell (CVE-2025-55182) 침해 사고 분석 및 대응 후기', icon: '📝' }
      ]
    }
  },
  {
    id: 'game-tutoring',
    period: '2019 ~ 2025',
    tags: ['C++', 'DirectX', 'Game Engine', 'Win32 API', 'Mentoring'],
    ko: {
      title: 'Coline Incubator & Anger Control Disorder (게임 엔진 & C++ 튜터링)',
      problem: '신입 개발자 및 학과 후배 대상의 C++ 기반 게임 엔진 아키텍처 및 Win32/DirectX 그래픽스 파이프라인 교육 필요.',
      solution: 'C++ 및 Win32/DirectX 기반 모듈형 게임 프레임워크 설계, 단계별 튜터링 커리큘럼 제작 및 YouTube 영상 강의/시연 자료 제작.',
      metrics: '한국공학대학교 졸업작품 선정, YouTube 튜터링 누적 발표 영상 공개, GitHub 오픈소스 배포',
      links: [
        { text: 'YouTube 튜터링 영상', url: 'https://youtube.com/playlist?list=PL7SCNKKIIA9dynBeO2mPA0Ph4N-YNOOP0&si=tv32xQSfbf3hj2aN', icon: '📺', external: true },
        { text: 'Coline Incubator GitHub', url: 'https://github.com/wsj2681/coline_incubator', icon: '🐙', external: true },
        { text: '졸업작품 GitHub', url: 'https://github.com/wsj2681/Anger_Control_Disoder', icon: '🐙', external: true }
      ]
    },
    en: {
      title: 'Coline Incubator & Anger Control Disorder (C++ Game Engine & Tutoring)',
      problem: 'Educating junior developers on C++ game engine architecture and DirectX rendering pipelines.',
      solution: 'Designed modular game framework in C++ and DirectX, provided structured mentoring courses and video demonstrations.',
      metrics: 'Selected as University Graduation Capstone Project, public YouTube tutoring lectures, open-source GitHub release',
      links: [
        { text: 'YouTube Tutoring Playlist', url: 'https://youtube.com/playlist?list=PL7SCNKKIIA9dynBeO2mPA0Ph4N-YNOOP0&si=tv32xQSfbf3hj2aN', icon: '📺', external: true },
        { text: 'GitHub Repository', url: 'https://github.com/wsj2681/coline_incubator', icon: '🐙', external: true }
      ]
    },
    ja: {
      title: 'Coline Incubator & Anger Control Disorder (ゲームエンジン & C++ メンタリング)',
      problem: '後輩開発者向けC++ゲームエンジン内部構造およびDirectXレンダリングパイプラインの教育支援。',
      solution: 'C++およびDirectXベースのモジュール型ゲームフレームワーク設計、体系的なメンタリング資料およびYouTube講義動画の作成。',
      metrics: '大学卒業制作優秀プロジェクト選定、YouTube講義動画の公開、GitHubオープンソース公開',
      links: [
        { text: 'YouTube講義プレイリスト', url: 'https://youtube.com/playlist?list=PL7SCNKKIIA9dynBeO2mPA0Ph4N-YNOOP0&si=tv32xQSfbf3hj2aN', icon: '📺', external: true },
        { text: 'GitHubリポジトリ', url: 'https://github.com/wsj2681/coline_incubator', icon: '🐙', external: true }
      ]
    }
  }
]

const localizedProjects = computed(() => {
  return rawProjects.map(p => {
    const data = p[currentLang.value] || p.ko
    return {
      id: p.id,
      period: p.period,
      tags: p.tags,
      title: data.title,
      problem: data.problem,
      solution: data.solution,
      metrics: data.metrics,
      links: data.links
    }
  })
})
</script>
