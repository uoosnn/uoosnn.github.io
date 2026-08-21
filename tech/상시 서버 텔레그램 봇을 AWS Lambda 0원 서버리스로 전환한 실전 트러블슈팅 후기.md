---
title: "상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기"
date: 2026-08-21
tags: [Tech, Troubleshooting, Incident Report]
---

# 상시 서버 텔레그램 봇을 AWS Lambda 0원 서버리스로 전환한 실전 트러블슈팅 후기

기존에 상시 가동 VM(Virtual Machine)에서 운영하던 텔레그램 봇을 비용 절감 및 운영 효율화를 위해 AWS의 영구 무료 플랜(Always Free Tier)을 활용한 완전 서버리스(Serverless) 아키텍처로 전환했다. 이 과정에서 발생했던 세 가지 주요 기술적 문제와 해결 과정을 트러블슈팅 로그 형식으로 기록한다.

### 1. 아키텍처 전환 배경 및 설계

기존 아키텍처는 비용과 관리 측면에서 비효율적이었다. 이를 개선하기 위해 AWS의 서버리스 서비스를 중심으로 비용 '0원'을 목표로 하는 새로운 아키텍처를 설계했다.

**기존 아키텍처 (VM 기반)**
*   **컴퓨팅**: 클라우드 VM에서 `python3 bot_main.py` 스크립트를 상시 실행 (Long Polling 방식). 고정 월 비용 발생.
*   **상태 관리**: 로컬 파일 시스템의 JSON 파일을 사용하여 뉴스 이력 및 대화 상태를 저장.
*   **배포**: VM에 직접 접속하여 `git` CLI 명령어로 소스 코드를 업데이트.

**신규 아키텍처 (AWS Serverless 기반)**
*   **컴퓨팅**: `AWS Lambda`를 채택. 월 100만 건의 영구 무료 요청을 활용.
*   **엔드포인트**: `Lambda Function URL`을 사용하여 API Gateway 없이 무료로 텔레그램 웹훅(Webhook)을 수신하는 HTTPS 엔드포인트를 구성.
*   **데이터베이스**: `Amazon DynamoDB`를 도입. 25GB의 영구 무료 스토리지를 활용하여 상태를 안정적으로 관리.
*   **스케줄링**: `Amazon EventBridge`를 사용하여 매일 아침 9시 뉴스 스크래핑 Lambda 함수를 트리거하는 Cron Job을 설정.
*   **코드 관리**: `PyGithub` 라이브러리를 통해 GitHub REST API를 호출, Lambda 함수 내에서 원격 저장소에 직접 커밋을 생성하여 로컬 git 의존성을 제거.

### 2. 핵심 트러블슈팅 로그

마이그레이션 과정에서 세 가지 주요 장애 상황에 직면했으며, 각각의 원인 분석과 해결 과정은 다음과 같다.

#### 이슈 1: 크로스 플랫폼 바이너리 비호환성 (502 Bad Gateway)

Lambda 함수 배포 후, 호출 시 지속적으로 `502 Bad Gateway` 오류가 발생했다. CloudWatch 로그 확인 결과, 특정 Python 패키지에서 `ImportError`가 발생하는 것을 확인했다.

*   **원인 분석**:
    개발 환경인 Windows에서 `pip install`을 통해 의존성 패키지를 설치하고 압축하여 배포했다. 이 과정에서 C-Extension 기반의 라이브러리들(예: `pydantic_core`, `grpcio`, `cryptography`)이 Windows 환경에 맞는 바이너리 파일(`.pyd`)로 설치되었다. 이 패키지들을 Linux 기반의 AWS Lambda 실행 환경에서 로드하려고 시도하자, 바이너리 비호환성으로 인해 `ImportError`가 발생하며 함수 실행이 실패했다.

*   **해결 조치**:
    배포 패키징 스크립트(`build_zip.py`) 내의 `pip install` 명령어에 Lambda 실행 환경과 호환되는 바이너리를 명시적으로 다운로드하도록 옵션을 추가했다. 이를 통해 개발 환경과 관계없이 항상 Linux용 바이너리를 패키징할 수 있게 되었다.

    ```bash
    pip install -r requirements.txt -t ./package \
      --platform manylinux2014_x86_64 \
      --only-binary=:all: \
      --implementation cp
    ```
    *   `--platform manylinux2014_x86_64`: 타겟 플랫폼을 AWS Lambda의 Linux 환경으로 지정.
    *   `--only-binary=:all:`: 소스 컴파일 대신 사전 빌드된 바이너리 패키지를 우선적으로 사용하도록 강제.
    *   `--implementation cp`: CPython 인터프리터용 패키지를 지정.

#### 이슈 2: AWS Lambda의 비동기 핸들러 처리 오류 (MarshalError)

`python-telegram-bot` 라이브러리의 비동기(asyncio) 기능을 활용하기 위해 Lambda 핸들러를 `async def`로 선언했으나, 또다시 `502 Bad Gateway` 오류가 발생했다.

*   **원인 분석**:
    CloudWatch 로그에서 `Runtime.MarshalError: Object of type coroutine is not JSON serializable` 메시지를 확인했다. 이는 AWS Lambda의 표준 Python 런타임 부트스트랩이 `async def`로 정의된 핸들러 함수를 직접 `await` 하지 않기 때문에 발생한 문제다. 런타임은 핸들러를 일반 동기 함수처럼 호출하고, 그 결과로 반환된 '코루틴(coroutine) 객체'를 JSON으로 직렬화하려다 실패한 것이다.

*   **해결 조치**:
    Lambda가 이해할 수 있는 표준 동기 함수(`def`) 내에서 `asyncio.run()`을 호출하여 비동기 로직을 실행하는 래퍼(Wrapper) 패턴을 적용했다.

    ```python
    import asyncio

    # 실제 비동기 로직을 포함하는 메인 함수
    async def main(event, context):
        # ... 모든 비동기 로직 ...
        pass

    # Lambda 런타임이 호출하는 동기 핸들러
    def lambda_handler(event, context):
        # 동기 컨텍스트에서 비동기 이벤트 루프를 실행
        return asyncio.run(main(event, context))
    ```

#### 이슈 3: 텔레그램 웹훅 타임아웃으로 인한 재시도 루프

AI 블로그 생성 및 다국어 번역 기능의 실행 시간이 50초 이상 소요되자, Lambda 함수는 정상적으로 성공했음에도 불구하고 1분 간격으로 텔레그램 서버로부터 동일한 웹훅 요청이 반복적으로 수신되는 현상이 발생했다.

*   **원인 분석**:
    텔레그램 웹훅 메커니즘은 요청 전송 후 약 30~40초의 타임아웃을 가진다. Lambda 함수의 전체 실행 시간이 이 타임아웃을 초과하자, 텔레그램 서버는 응답을 받지 못한 것으로 간주하고 요청이 실패했다고 판단하여 재시도를 보낸 것이 원인이었다.

*   **해결 조치**:
    실행 시간 단축을 위해, 상호 의존성이 없는 영문 번역과 일문 번역 작업을 순차 처리에서 병렬 처리로 변경했다. `asyncio.gather()`를 사용하여 두 개의 번역 API 호출을 동시에 실행하도록 코드를 최적화했다.

    ```python
    # 수정 전: 순차 처리
    # english_translation = await translate_text(content, 'en')
    # japanese_translation = await translate_text(content, 'ja')

    # 수정 후: 병렬 처리
    translation_tasks = [
        translate_text(content, 'en'),
        translate_text(content, 'ja')
    ]
    results = await asyncio.gather(*translation_tasks)
    ```
    이 최적화를 통해 전체 실행 시간을 20초 이내로 단축하여 텔레그램 웹훅 타임아웃 문제를 근본적으로 해결했다.

### 3. 성과 및 결론

이번 서버리스 마이그레이션을 통해 다음과 같은 성과를 달성했다.
1.  **비용 절감**: AWS 영구 무료 플랜을 활용하여 상시 서버 운영 비용을 월 0원으로 절감했다.
2.  **운영 부담 제거 (Zero-Ops)**: 서버 인프라 관리, 패치, 모니터링 등의 운영 부담이 사라지고 애플리케이션 로직 개발에만 집중할 수 있게 되었다.
3.  **기술 역량 확보**: 크로스 플랫폼 서버리스 패키징, Lambda 환경에서의 비동기 프로그래밍, 외부 서비스(Webhook) 연동 시의 타임아웃 최적화 등 실무적인 트러블슈팅 경험을 확보했다.

---
*게시된 시간: 2026-08-21 16:37:13*
