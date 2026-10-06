---
title: "EIP 비용 0원! AWS Lambda와 Cloudflare DDNS로 구축한 온디맨드 멀티 리전 VPN"
description: "고정 IP(EIP) 과금 없이 텔레그램 봇과 Cloudflare 무료 DNS API, AWS Lambda를 결합해 월 0원으로 운영하는 개인용 멀티 리전 OpenVPN 구축기"
date: 2026-10-07
tags: [AWS, EC2, OpenVPN, Cloudflare, DDNS, Lambda, Serverless, Telegram, Troubleshooting]
---

# EIP 비용 0원! AWS Lambda와 Cloudflare DDNS로 구축한 온디맨드 멀티 리전 VPN

::: tip 1줄 요약
상시 가동 비용과 AWS 탄력적 IP(EIP) 유휴 과금을 완벽히 피하기 위해, **AWS Lambda + Telegram 봇 + Cloudflare 무료 DNS API**를 연동하여 버튼 클릭 한 번으로 도쿄/버지니아 EC2를 켜고 도메인 IP를 1초 만에 자동 갱신하는 **0원 온디맨드 VPN 시스템** 구축기.
:::

## 1. 프로젝트 배경: 왜 온디맨드 VPN인가?

해외 망 접속 및 리전별 네트워크 레이턴시 테스트를 위해 도쿄(`ap-northeast-1`)와 버지니아 북부(`us-east-1`) 리전에 OpenVPN 서버를 구축해 사용해왔다. 하지만 개인용 VPN 특성상 필요할 때만 간헐적으로 쓰는데 서버를 24시간 켜두는 것은 심각한 자원과 비용 낭비였다:

1. **EC2 프리티어 한도 초과 위험**: AWS 프리티어는 계정당 월 750시간 무료 인스턴스 시간을 제공한다. 2개 리전 인스턴스를 동시에 24시간 켜두면 한 달에 약 1,440시간이 소요되어 프리티어 한도를 즉시 초과하고 과금이 발생한다.
2. **AWS Public IPv4 과금 정책**: 2024년 2월부터 모든 퍼블릭 IPv4 주소에 시간당 $0.005가 부과된다.
3. **탄력적 IP(EIP) 유휴 과금 함정**: 인스턴스를 껐다 켤 때 공용 IP가 변경되는 것을 막기 위해 EIP를 할당해 두면, 인스턴스가 꺼져 있는 동안 **미연결 EIP 유휴 비용($0.005/h)**이 그대로 청구된다.

> **핵심 해결 전략**: EIP를 쓰지 않고 인스턴스를 평소에 꺼둔다(Stop). 필요할 때만 텔레그램 버튼으로 기동하고, 동적으로 새로 발급된 퍼블릭 IP를 무료 Cloudflare DNS API로 1초 만에 A 레코드에 자동 갱신하여, **클라이언트에서는 단 하나의 고정된 `.ovpn` 프로필로 영구 접속**하도록 구현하자!

---

## 2. 전체 시스템 아키텍처

별도의 상시 가동 프록시나 관리 서버 없이, **100% 서버리스(AWS Lambda Function URL)**로 구성하여 기본 인프라 유지비용을 0원으로 설계했다.

```
[온디맨드 서버리스 VPN 아키텍처]

사용자 (Telegram)
      │  /start 또는 인라인 버튼 클릭
      ▼
[Telegram Bot API] ──(Webhook HTTPS POST)──> [AWS Lambda Function URL] (Python 3.12)
                                                         │
                 ┌───────────────────────────────────────┴───────────────────────────────────────┐
                 ▼                                                                               ▼
     [AWS EC2 (도쿄 / 버지니아)]                                                    [Cloudflare DNS REST API (무료)]
      1. ec2.start_instances()                                                       3. PATCH /dns_records
      2. 신규 Public IP 할당 대기                                                     4. vpn-tokyo.uoosnn.com A 레코드 갱신
                 │                                                                               │
                 └───────────────────────────────────────┬───────────────────────────────────────┘
                                                         ▼
                                            [Telegram 완료 알림 전송]
                                            "✅ 도쿄 VPN 준비 완료! 앱에서 스위치 ON"
```

### 아키텍처 핵심 포인트
* **영구 고정 `.ovpn` 프로필**: 클라이언트 설정 파일(`*.ovpn`)에 IP 대신 `remote vpn-tokyo.uoosnn.com 1194`를 1회만 등록해 두면, 인스턴스가 켜질 때마다 IP가 바뀌어도 클라이언트 설정을 재수정하거나 재다운로드할 필요가 없다.
* **초경량 배포 패키지 (0.77 MB)**: 무거운 텔레그램 SDK 대신 경량 `requests`를 채택하고 `manylinux2014_x86_64` 바이너리로 패키징하여 콜드 스타트 지연을 100ms 이내로 단축했다.

---

## 3. 실전 트러블슈팅 3대 이슈

### 이슈 1. Lambda 200 OK 응답과 텔레그램 무응답 (오류 은폐 트랩)
* **현상**: 텔레그램 봇으로 명령을 전송했을 때 아무런 반응이 없었으나, AWS Lambda 모니터링 로그에서는 "요청 성공 (200 OK)"으로 표시됨.
* **원인**: 텔레그램 웹훅 규격상 예외 발생 시 재전송 루프를 차단하기 위해 `except Exception` 블록에서 일괄 `200 OK`를 반환하도록 작성되어 있었다. 이로 인해 람다 내부 초기화 단계에서 발생한 에러가 겉으로 드러나지 않고 삼켜졌다.
* **해결 조치**: 
  1. 웹 브라우저에서 함수 URL을 GET 방식으로 호출하면 모든 환경 변수의 등록 상태를 실시간 진단해 주는 `config_check` 엔드포인트를 구현했다.
  2. 진단 결과 `CLOUDFLARE_API_TOKEN_SET: false`를 확인하여 누락된 환경 변수를 즉시 교정했다.

```json
// 브라우저 헬스체크 진단 결과 예시
{
  "service": "aws-vpn-telegram-bot",
  "status": "online",
  "config_check": {
    "ALLOWED_CHAT_ID": 8771073288,
    "TELEGRAM_BOT_TOKEN_SET": true,
    "CLOUDFLARE_API_TOKEN_SET": false, // <-- 원인 규명!
    "AWS_TOKYO_INSTANCE_ID_SET": true
  }
}
```

### 이슈 2. Cloudflare DDNS 연동 시 프록시 설정 (UDP 1194 통신 이슈)
* **현상**: Cloudflare DNS A 레코드에 IP를 갱신할 때 기본 프록시(주황색 구름)를 켜두면 OpenVPN 접속이 실패함.
* **원인**: Cloudflare의 무료 CDN 프록시는 HTTP/HTTPS(80/443) 웹 트래픽만 지원하며, UDP 1194 포트를 사용하는 OpenVPN 트래픽은 통과시키지 못함.
* **해결 조치**: API 호출 페이로드에 `proxied: False` 옵션을 명시하여 반드시 **DNS Only (회색 구름)** 상태로 갱신되도록 처리했다.

```python
# Cloudflare DNS A 레코드 갱신 핵심 로직
payload = {
    "type": "A",
    "name": "vpn-tokyo.uoosnn.com",
    "content": new_public_ip,
    "ttl": 60,         # 1분 초고속 DNS 전파
    "proxied": False   # OpenVPN(UDP 1194) 직접 연결을 위해 필수!
}
```

### 이슈 3. 타인 도용 방지를 위한 Chat ID 화이트리스트 검증
* **문제**: 봇 유저네임이 외부에 노출되면 제3자가 명령어를 보내 인스턴스를 무단 기동하고 비용을 발생시킬 위험이 있음.
* **해결 조치**: 람다 핸들러 진입 시 전송자의 `chat_id`가 사전에 승인된 관리자 ID(`ALLOWED_CHAT_ID`)와 일치하는지 엄격히 검증하고, 불일치 시 인출을 즉각 차단하며 해당 사용자의 Chat ID를 안내하도록 구성했다.

---

## 4. 운영 비용 결산

| 서비스 항목 | 스펙 및 사용 조건 | 비용 |
| :--- | :--- | :--- |
| **AWS EC2 (도쿄 / 버지니아)** | 필요할 때만 켜고 끄는 온디맨드 (월 10~20시간 내외) | **$0.00** (프리티어) |
| **AWS Lambda** | Function URL 기반 웹훅 (월 수백 회 미만) | **$0.00** (월 100만 회 무료) |
| **Cloudflare DNS API** | 도메인 호스팅 및 REST API 갱신 | **$0.00** (영구 무료) |
| **AWS Public IPv4** | 실행 중일 때만 부과 ($0.005/h) | **월 약 $0.05 ~ $0.10 (100원 내외)** |
| **총합** | | **사실상 0원 (Always Free)** |

---

## 5. 회고 및 결론

고정 IP(EIP)를 쓰지 않더라도, **Cloudflare의 빠른 DNS 전파(TTL 60초)와 무료 REST API를 결합하면 얼마든지 영구 도메인 기반의 온디맨드 클라우드 인프라를 구축할 수 있다**는 점을 확인했다.

스마트폰 텔레그램에서 버튼 한 번으로 도쿄나 버지니아의 VPN을 20초 만에 준비하고, 작업 완료 후 `[🛑 지금 종료]` 버튼으로 인스턴스를 즉각 정지하여 프리티어 한도와 비용을 완벽하게 방어할 수 있게 되었다.
