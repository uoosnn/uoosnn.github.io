---
title: "삭제된 AWS SNS 주제 복구 시 ARN의 중요성"
description: "CloudWatch 알람 액션이 Name이 아닌 Immutable ARN을 바라봄으로써 발생하는 장애 메커니즘과 일괄 복구 절차"
date: 2026-07-08
tags: [Tech, Troubleshooting, Incident Report, AWS, SNS, CloudWatch, ARN]
---

# 삭제된 AWS SNS 주제 복구 시 ARN의 중요성

::: tip 1줄 요약
AWS SNS 주제(Topic)를 삭제한 뒤 동일한 이름으로 다시 생성해도, 기존 CloudWatch 알람은 **이전 리소스의 고유 ARN**을 참조하므로 **알람 액션을 반드시 명시적으로 재설정**해야 한다.
:::

## 1. 인시던트 개요

모니터링 알람용 AWS SNS 주제가 실수로 삭제되는 일이 발생했다. 가장 빠른 복구를 위해 삭제된 주제와 **'동일한 이름'**으로 새 주제를 생성하고 이메일 및 Lambda 구독을 다시 연결했다.

겉보기에는 모든 구성이 정상 복구된 것처럼 보였으나, 실제 테스트 시 **기존에 설정되어 있던 수많은 CloudWatch 알람들이 새로 생성된 SNS 주제로 알림을 전송하지 못하고 침묵하는 장애**가 발생했다.

```
[장애 발생 흐름]
1. SNS 주제 실수 삭제 (기존 고유 ARN 소멸)
2. 동일 이름으로 주제 재생성 (새로운 내부 ARN 발급)
3. CloudWatch 알람 발동 ──(알림 시도)──✖ [과거 ARN 참조로 인한 드롭]
```

## 2. 근본 원인: Name vs Immutable ARN

CloudWatch 알람의 '작업(Action)' 설정은 사람이 지정하는 리소스 이름(Name)이 아닌, AWS 전역 고유 식별자인 **ARN(Amazon Resource Name)**을 저장한다.

* **이름(Name)**: 사용자가 지정하는 식별자로, 삭제 후 동일 이름으로 재사용 가능
* **ARN(Amazon Resource Name)**: 리소스 생성 시 고유하게 부여되는 불변의 ID

동일한 이름으로 주제를 다시 생성하더라도, AWS 내부적으로는 완전히 새로운 리소스가 생성된 것이므로 기존 CloudWatch 알람 액션은 **더 이상 존재하지 않는 과거의 대상(Dangling ARN)**을 가리키게 된다.

```
- 기존 알람 액션 Target : arn:aws:sns:ap-northeast-2:123456789012:OLD-TOPIC-ID (삭제됨)
- 새로 생성된 주제 ARN  : arn:aws:sns:ap-northeast-2:123456789012:NEW-TOPIC-ID (미연결)
```

## 3. 실전 복구 및 검증 절차

### Step 1. 구독자 정보 확보
삭제된 SNS 주제의 생성 이력이 90일을 초과하여 CloudTrail 로그가 만료되었다면, IaC(Terraform/CloudFormation) 코드나 배포 설정 문서를 통해 기존 구독자 목록(이메일, Lambda, SQS 등)을 신속히 확보해야 한다.

### Step 2. SNS 주제 및 구독 재생성
동일한 이름으로 SNS 주제를 생성하고, 확보된 구독자 정보를 바탕으로 구독(Subscription)을 모두 다시 추가한다.

### Step 3. CloudWatch 알람 작업(Action) 일괄 갱신
삭제된 주제를 바라보던 모든 CloudWatch 알람의 액션을 식별하여 신규 SNS ARN으로 업데이트한다. 알람이 많을 경우 AWS CLI로 일괄 갱신한다.

```bash
# 특정 알람의 액션을 신규 SNS ARN으로 업데이트
aws cloudwatch put-metric-alarm \
  --alarm-name "EC2-CPU-High-Alarm" \
  --alarm-actions "arn:aws:sns:ap-northeast-2:123456789012:NEW-TOPIC-ID"
```

### Step 4. 강제 트리거를 통한 수신 테스트
실제 인시던트 발생 전에 `set-alarm-state` 명령어로 알람을 강제 발동시켜 모든 구독자에게 정상 수신되는지 즉시 검증한다.

```bash
# 알람 상태를 강제로 ALARM으로 변경하여 테스트
aws cloudwatch set-alarm-state \
  --alarm-name "EC2-CPU-High-Alarm" \
  --state-value ALARM \
  --state-reason "Testing SNS notification recovery"
```

## 4. 핵심 체크포인트 (Gotchas)

1. **AWS 리소스 재사용의 함정**: 이름이 같다고 해서 기존 서비스 간의 링크나 권한이 자동으로 복원되지 않는다.
2. **IaC 기반 인프라 관리 권장**: 콘솔에서 수동으로 생성한 리소스는 삭제 시 복구와 추적이 어려우므로, 알람 및 알림 파이프라인은 코드로 관리하는 것이 안전하다.

---
*게시된 시간: 2026-07-08 09:35:53*
*수정한 시간: 2026-08-15 13:57:00*
