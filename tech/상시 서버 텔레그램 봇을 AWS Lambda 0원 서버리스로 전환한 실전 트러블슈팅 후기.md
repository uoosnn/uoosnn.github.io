---
title: "상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기"
description: "Cross-platform manylinux 패키징, asyncio MarshalError 래퍼 패턴, 텔레그램 웹훅 타임아웃 중복 재시도를 해결한 서버리스 전환기"
date: 2026-08-21
tags: [AWS, Lambda, Serverless, Telegram, Python, DynamoDB, Troubleshooting, Architecture]
---

# 상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기

::: tip 1줄 요약
상시 가동 VM의 Long-Polling 봇을 **AWS Lambda Function URL + DynamoDB + EventBridge** 기반 0원 서버리스로 전환하면서 맞닥뜨린 **C-바이너리 호환성(manylinux), asyncio MarshalError, 웹훅 30초 타임아웃 재시도 루프**의 실전 해결 일지.
:::

## 1. 아키텍처 전환: VM ➔ AWS Always Free Serverless

* **컴퓨팅**: VM 상시 실행 (`python bot_main.py`) ➔ **AWS Lambda** (월 100만 건 무료)
* **엔드포인트**: API Gateway 과금 배제 ➔ **Lambda Function URL** (무료 HTTPS 웹훅 수신)
* **상태 관리**: 로컬 JSON 파일 ➔ **Amazon DynamoDB** (25GB 영구 무료)
* **스케줄링**: cron 데몬 ➔ **Amazon EventBridge** (매일 09:00 KST 뉴스 스크래핑 트리거)
* **블로그 자동 배포**: 로컬 git push ➔ **PyGithub (GitHub REST API)** 직접 커밋 생성

```
[서버리스 웹훅 아키텍처]
Telegram Server ──(Webhook POST)──> [Lambda Function URL]
                                            │
                             ┌──────────────┴──────────────┐
                             ▼                             ▼
                    [Amazon DynamoDB]            [GitHub Repository]
                    (상태/세션 관리)              (블로그 포스트 자동 커밋)
```

---

## 2. 실전 트러블슈팅 3대 이슈

### 이슈 1. Windows 개발 환경의 C-Extension 바이너리 비호환 (502 Bad Gateway)
* **현상**: Lambda 배포 후 `ImportError: cannot import name ...` 발생하며 502 에러 반환.
* **원인**: Windows 개발 PC에서 `pip install` 시 `pydantic_core`, `cryptography` 등의 C-확장 패키지가 Windows용 `.pyd` 바이너리로 설치되어 Linux(AL2023) 런타임에서 로드 실패.
* **해결 조치**: `build_zip.py` 패키징 스크립트에 `manylinux` 바이너리 강제 다운로드 옵션 적용.

```bash
# Windows 환경에서 Linux용 Lambda 바이너리 강제 다운로드
pip install -r requirements.txt -t ./package \
  --platform manylinux2014_x86_64 \
  --only-binary=:all: \
  --implementation cp
```

---

### 이슈 2. Lambda 비동기 핸들러 직렬화 실패 (Runtime.MarshalError)
* **현상**: 핸들러를 `async def lambda_handler`로 선언 시 `Object of type coroutine is not JSON serializable` 에러 발생.
* **원인**: AWS Lambda의 기본 Python 부트스트랩은 `async def`를 `await` 하지 않고 코루틴 객체 자체를 반환값으로 취급하여 직렬화 시도 중 에러 발생.
* **해결 조치**: 동기 핸들러 내에서 `asyncio.run()`으로 이벤트 루프를 생성하는 래퍼 패턴 적용.

```python
import asyncio

async def main_async(event, context):
    # python-telegram-bot 비동기 처리 로직
    return {"statusCode": 200, "body": "OK"}

def lambda_handler(event, context):
    """Lambda 표준 진입점 (동기 래퍼)"""
    return asyncio.run(main_async(event, context))
```

---

### 이슈 3. AI 다국어 번역 지연으로 인한 텔레그램 웹훅 무한 재시도 루프
* **현상**: Gemini API로 블로그 생성 및 영/일 번역 시 45초 이상 소요되자, 텔레그램 서버가 타임아웃(30초)으로 간주하고 동일 웹훅을 1분 간격으로 계속 재전송하여 중복 포스팅 발생.
* **해결 조치**: 순차 처리되던 번역 API 호출을 `asyncio.gather()` 병렬 처리로 전환하여 총 소요 시간을 18초 이내로 단축.

```python
# 수정: 영문/일문 번역 병렬 처리로 응답 시간 50% 단축
translation_tasks = [
    ai_processor.translate_blog_post_async(content, "English"),
    ai_processor.translate_blog_post_async(content, "Japanese")
]
en_content, ja_content = await asyncio.gather(*translation_tasks)
```

---

## 3. 핵심 체크포인트 (Gotchas)

1. **Lambda Function URL 콜드스타트**: Python 패키지 크기가 커지면 콜드스타트가 2~3초 발생할 수 있으므로, 텔레그램 봇 응답은 최대한 빠르게 200 OK를 반환하거나 병렬 처리를 통해 30초 웹훅 타임아웃을 사수해야 한다.
2. **DynamoDB On-Demand 모드**: 개인 프로젝트 규모에서는 프로비저닝(1 RCU/WCU) 대신 온디맨드 모드를 사용해도 영구 무료 프리티어(25 RCU/WCU 상당) 내에서 100% 0원으로 운영된다.
3. **Lambda 메모리 = CPU 파워**: 메모리를 256MB에서 512MB로 올리면 네트워크 및 연산 속도가 비례하여 빨라져 AI 응답 지연을 방어하는 데 매우 효과적이다.

---
*게시된 시간: 2026-08-21 16:37:13*
*수정한 시간: 2026-08-15 13:57:00*
