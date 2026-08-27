---
title: "VitePress 기반 정적 블로그의 npm 의존성 취약점 분석 및 해결 기록"
description: "정적 사이트의 빌드 파이프라인(GitHub Actions) 및 로컬 환경 보안 위협 분석, npm audit fix 적용과 package-lock.json 관리 가이드"
date: 2026-08-09
tags: [Security, npm, VitePress, CI-CD, Vulnerability, Node.js, DevSecOps]
---

# VitePress 기반 정적 블로그의 npm 의존성 취약점 분석 및 해결 기록

::: tip 1줄 요약
정적 사이트의 최종 산출물(HTML/JS)은 런타임 공격에 안전하더라도, **CI/CD(GitHub Actions) 빌드 컨테이너 내 Secrets 탈취 및 개발 환경 경로 횡단(Path Traversal)** 공격을 방어하기 위해 `npm audit fix` 적용 및 `package-lock.json` 형상 관리는 필수적이다.
:::

## 1. 정적 사이트에서 npm 취약점의 실제 위협 모델

"서버리스/정적 HTML 배포 사이트의 npm 취약점이 실제로 위험한가?"라는 의문에 대한 실무 보안 관점의 위협 분석 결과:

* **배포 런타임 (User Browser)**: 정적 파일 서빙이므로 서버 사이드 RCE 위험 없음.
* **CI/CD 파이프라인 (GitHub Actions Runner)**: 빌드 시 취약한 의존성 패키지가 악의적 스크립트를 실행하여 컨테이너 환경 변수에 저장된 `GITHUB_TOKEN`, `AWS_KEYS`, `API_SECRETS`를 외부로 유출할 위험 존재.
* **로컬 개발 PC (`npm run dev`)**: Vite/PostCSS 경로 횡단(CWE-22) 및 NTLM 해시 유출 취약점을 통해 개발자 로컬 파일 시스템 침해 가능.

---

## 2. 취약점 스캔 및 분석 결과

`npm audit` 점검 시 6건의 취약점이 검출되었으며, 주요 High 등급 패키지는 다음과 같다.

```bash
# 취약점 진단 실행
npm audit
```

| 패키지명 | 심각도 | 취약점 유형 (CWE) | 위협 내용 |
| :--- | :--- | :--- | :--- |
| `brace-expansion` | **High** | CWE-400 (DoS) | 조작된 입력 처리 시 과도한 CPU 자원 소모 |
| `postcss` | **High** | CWE-22 (Path Traversal) | `.map` 소스맵 파일 로드 시 임의 경로 파일 접근 |
| `vite` | **High** | CWE-22 / CWE-522 | Windows 환경에서 SMB 링크 유도로 NTLMv2 해시 유출 |

---

## 3. 해결 조치: 자동 패치 및 `package-lock.json` 동기화

### 1) 패치 적용
```bash
# SemVer 호환 버전 내 안전 자동 업데이트
npm audit fix
```
* `postcss`, `brace-expansion` 등 3건의 High 취약점 즉시 해결 완료.

### 2) CI/CD `npm ci`와 `package-lock.json`의 관계 (핵심)
GitHub Actions 워크플로우는 재현성을 위해 `npm install` 대신 `npm ci`를 실행한다. `npm ci`는 `package.json`이 아니라 **`package-lock.json`에 잠긴 정확한 버전만을 설치**한다.

```
[CI/CD 반영 파이프라인]
로컬 `npm audit fix` ──> [package-lock.json 갱신] ──> [Git Commit & Push]
                                                              │
                                     (GitHub Actions) ────────▼
                                  `npm ci` 실행 시 안전한 패키지 버전 자동 배포
```

따라서 `package.json`만 수정하고 `package-lock.json`을 커밋하지 않으면 CI 환경에서는 여전히 취약한 구버전 패키지가 설치되므로, 반드시 두 파일을 함께 커밋해야 한다.

---

## 4. 핵심 체크포인트 (Gotchas)

1. **`npm audit fix --force` 남발 금지**: `--force` 플래그는 메이저 버전(Breaking Change)까지 강제 업데이트하여 VitePress 빌드 스크립트나 테마가 깨질 수 있으므로, 메이저 업그레이드는 릴리스 노트를 확인 후 수동 진행해야 한다.
2. **Dependabot 연동**: GitHub Dependabot을 활성화하여 주 단위로 취약점 PR이 자동 생성되도록 설정하면 수동 감사 부담을 대폭 줄일 수 있다.

---
*게시된 시간: 2026-08-09 09:54:57*
*수정한 시간: 2026-08-15 13:57:00*
