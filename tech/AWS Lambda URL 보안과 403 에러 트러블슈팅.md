---
title: "AWS Lambda Function URL 재생성 후 403 Forbidden 에러 분석"
description: "AWS Lambda Function URL을 보안상 삭제 후 재생성 시 AWS 콘솔 캐시 버그로 인해 리소스 기반 정책이 누락되어 403 Forbidden 에러가 발생하는 현상을 분석하고, 브라우저 새로고침을 통한 해결 및 코드 레벨 검증 로직 추가 과정을 다룹니다."
date: 2026-11-18
tags: [AWS, Troubleshooting, Security, Serverless, Lambda]
---

# AWS Lambda Function URL 재생성 후 403 Forbidden 에러 분석

::: tip 1줄 요약
Lambda Function URL 재생성 후 `{"Message":"Forbidden"}` 에러 발생 시, AWS 콘솔 캐시 버그로 인한 리소스 기반 정책 누락이 원인일 수 있으므로 브라우저 새로고침 후 URL을 다시 생성해야 합니다.
:::

## 인시던트 개요

`setup_aws.md` 문서에 `AuthType: NONE`으로 설정된 텔레그램 웹훅용 Lambda Function URL이 커밋되어 외부에 노출되었습니다. URL이 노출되면 누구나 curl 등의 도구로 임의의 POST 요청을 보내 GitHub 블로그 콘텐츠를 조작하거나 연결된 Gemini API의 쿼터를 소진시킬 수 있는 보안 위험이 존재했습니다.

Git 히스토리 재작성 대신, 기존 Function URL을 즉시 삭제 및 재발급하고 코드 레벨에서 발신자 `CHAT_ID`를 검증하는 방어 로직을 추가하는 것으로 대응 방향을 결정했습니다.

## 원인 분석: 403 Forbidden 및 무응답 현상

기존 Function URL을 삭제하고 AWS 콘솔에서 동일하게 `AuthType: NONE`으로 새 URL을 생성한 후, 텔레그램 `setWebhook` API 호출까지 성공적으로 마쳤습니다. 그러나 이후 텔레그램 봇의 `/info` 명령어에 응답이 없었고, AWS CloudWatch 모니터링 상에서도 함수 호출(Invocations) 수가 0건으로 확인되었습니다.

재생성된 URL에 직접 접속 시, 다음과 같은 403 에러 메시지가 반환되었습니다.

```json
{"Message":"Forbidden"}
```

문제의 원인은 AWS 콘솔의 캐시 동작과 관련된 버그였습니다. 콘솔에서 Function URL을 삭제한 직후, 브라우저를 새로고침(F5)하지 않고 바로 'URL 생성' 버튼을 누르면 다음과 같은 현상이 발생합니다.

1.  UI에는 "함수 URL에 대한 퍼블릭 액세스 권한을 부여하는 정책이 존재합니다"와 같은 캐시된 상태 메시지가 표시됩니다.
2.  하지만 실제로는 퍼블릭 호출에 필요한 리소스 기반 정책(Resource-based policy) 생성을 건너뜁니다.
3.  결과적으로, 함수의 리소스 기반 정책 JSON에서 `lambda:InvokeFunctionUrl` 권한을 가진 퍼블릭 접근(`Principal: "*"`) 구문이 누락되어, 모든 외부 호출이 AWS 인프라 앞단에서 차단됩니다.

정상적인 정책에는 EventBridge 등 다른 서비스 외에 다음과 같은 퍼블릭 호출 권한이 포함되어야 합니다.

```json
{
  "Sid": "FunctionURLAllowPublicAccess",
  "Effect": "Allow",
  "Principal": "*",
  "Action": "lambda:InvokeFunctionUrl",
  "Resource": "arn:aws:lambda:ap-northeast-2:...",
  "Condition": {
    "StringEquals": {
      "lambda:FunctionUrlAuthType": "NONE"
    }
  }
}
```

## 복구 절차 및 코드 방어

### 1. Function URL 정책 복구

다음 절차를 통해 문제를 해결했습니다.

1.  문제가 발생한 Lambda Function URL을 다시 삭제합니다.
2.  브라우저를 새로고침(F5)하여 AWS 콘솔의 캐시를 완전히 초기화합니다.
3.  다시 함수 구성(Configuration) 탭에서 `AuthType: NONE`으로 Function URL을 생성합니다.
4.  생성 후 '권한(Permissions)' 탭에서 리소스 기반 정책이 정상적으로 추가되었는지 확인합니다.
5.  새로 발급된 URL로 텔레그램 `setWebhook`을 재등록하여 서비스를 정상화했습니다.

### 2. 코드 레벨 발신자 검증 추가

URL 노출에 대비한 추가 방어 조치로, `lambda_function.py` 진입점 최상단에 `is_authorized_update()` 함수를 추가했습니다. 이 함수는 웹훅 페이로드의 `message.chat.id` 또는 `from.id`가 환경변수 `TELEGRAM_CHAT_ID`와 일치하는지 검사합니다. 허가되지 않은 ID로부터 요청이 들어오면, DynamoDB나 AI API를 호출하기 전에 즉시 요청을 폐기하고 아래 응답을 반환합니다.

```python
# is_authorized_update() 함수 로직 예시
def is_authorized_update(update, context):
    # ... chat_id, from_id 추출 로직 ...
    if str(chat_id) != os.environ.get('TELEGRAM_CHAT_ID'):
        return False
    return True

# 메인 핸들러
def lambda_handler(event, context):
    if not is_authorized_update(update, context):
        return {"ok": True, "unauthorized_dropped": True}
    # ... 기존 로직 수행 ...
```

### 3. PowerShell을 이용한 스푸핑 테스트

방어 로직의 정상 동작을 검증하기 위해, PowerShell의 `Invoke-RestMethod`를 사용하여 허가되지 않은 `chat_id` (e.g., `9999999`)로 스푸핑된 요청을 전송했습니다.

*참고: Windows PowerShell의 `curl.exe`은 중첩된 JSON 내 따옴표 처리 시 "Unterminated string" 에러를 유발할 수 있어 `Invoke-RestMethod` 사용이 권장됩니다.*

```powershell
Invoke-RestMethod -Method Post -Uri "https://<NEW_URL>.lambda-url.ap-northeast-2.on.aws/" -ContentType "application/json" -Body '{"update_id":1,"message":{"date":9999999999,"chat":{"id":9999999},"text":"/post test"}}'
```

테스트 결과, Lambda 함수는 `{"ok": true, "unauthorized_dropped": true}`를 반환하며 의도대로 차단 동작을 수행함을 확인했습니다.

## 핵심 체크포인트 (Gotchas)

*   **AWS 콘솔 캐시**: Lambda Function URL과 같이 리소스와 정책이 함께 생성/삭제되는 AWS 서비스를 콘솔에서 다룰 때, 삭제 직후 새로고침 없이 바로 재생성하면 관련 정책이 누락될 수 있습니다. 중요한 변경 작업 후에는 항상 브라우저를 새로고침하는 것이 안전합니다.
*   **Public URL 보안**: `AuthType: NONE`으로 설정된 Function URL은 그 자체로 인증 역할을 하므로, URL이 노출되면 즉시 폐기하고 재발급해야 합니다. 또한 페이로드의 특정 값(e.g., `chat.id`)이나 `X-Telegram-Bot-Api-Secret-Token` 같은 커스텀 헤더를 검증하는 코드 레벨의 방어 로직을 반드시 구현해야 합니다.
*   **PowerShell JSON 전송**: PowerShell 환경에서 복잡한 JSON 데이터를 API Body로 전송할 경우, `curl.exe`의 문자열 파싱 문제를 피하기 위해 `Invoke-RestMethod`나 `Invoke-WebRequest` cmdlet 사용을 권장합니다.
