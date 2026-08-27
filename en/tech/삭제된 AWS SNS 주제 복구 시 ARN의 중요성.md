---
title: "AWS SNS Disaster Recovery: Why Exact ARN Matching is Critical"
description: "Why recreating a deleted AWS SNS Topic requires exact ARN matching across Account ID, Region, and Topic Name to recover SQS/Lambda subscriber pipelines"
date: 2026-08-15
tags: [AWS, Cloud, SNS, Architecture, Troubleshooting, Infrastructure]
---

# AWS SNS Disaster Recovery: Why Exact ARN Matching is Critical

::: tip 1-Line Summary
When recovering an accidentally deleted AWS SNS Topic, **recreating it with the exact matching Account ID, Region, and Topic Name restores the identical ARN (Amazon Resource Name)**, automatically reconnecting downstream SQS and Lambda subscriptions.
:::

## 1. Incident Breakdown: Downstream Pipeline Failure

```
[SNS Topic Disaster Recovery Flow]
1. [Accidental Topic Deletion] ──> ARN completely unregistered
                                         │
2. [Recreated in Wrong Region]  ──> ARN mismatch ──✖ (Alerts silently dropped)
                                         │
3. [Recreated with Exact ARN]   ──> Identical ARN generated ──✔ (SQS/Lambda recovered)
```

* An engineer accidentally deleted a production SNS alerting topic during maintenance.
* Recreating the topic under a slightly different naming convention or region failed to restore alerts because all CloudWatch Alarms and SQS policies referenced the original ARN.

---

## 2. Deterministic ARN Resolution Mechanics

AWS SNS assigns ARNs deterministically based on three immutable components:

```
arn:aws:sns:{Region}:{Account-ID}:{TopicName}
```

* Downstream resources (SQS Access Policies, Lambda event sources, CloudWatch Alarms) do not reference topic names—they bind exclusively to the **fully-qualified ARN**.
* If the topic is recreated with the **exact same Region, Account ID, and Topic Name**, the resulting ARN is mathematically identical, allowing existing IAM trust policies to immediately re-bind.

---

## 3. Recovery SOP & Verification

```bash
# 1. Retrieve the original ARN from AWS CloudTrail logs
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteTopic

# 2. Recreate the topic in the exact target region
aws sns create-topic \
    --name Production-Alert-Topic \
    --region ap-northeast-2

# 3. Confirm topic attributes and downstream subscription health
aws sns get-topic-attributes \
    --topic-arn arn:aws:sns:ap-northeast-2:123456789012:Production-Alert-Topic
```

---

## 4. Gotchas & Engineering Checkpoints

1. **IaC Deletion Protection**: Always enforce `prevent_destroy = true` in Terraform or `DeletionPolicy: Retain` in CloudFormation for critical messaging topics.
2. **SQS Resource Policies**: If SQS Access Policies enforce `Condition: {"ArnEquals": {"aws:SourceArn": "arn:aws:sns:..."}}`, any subtle ARN mismatch will cause AWS to silently drop incoming messages without throwing errors.

---
*Published: 2026-08-15 14:04:16*
*Updated: 2026-08-15 13:57:00*
