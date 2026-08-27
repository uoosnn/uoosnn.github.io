---
title: "削除されたAWS SNSトピック復旧時にARNの同一性が極めて重要な理由"
description: "誤削除されたSNSトピックの再作成時に発生するサブスクリプションおよびダウンストリーム(SQS/Lambda)の切断障害と、完全なARN一致による復旧メカニズムの解説"
date: 2026-08-15
tags: [AWS, Cloud, SNS, Architecture, Troubleshooting, Infrastructure]
---

# 削除されたAWS SNSトピック復旧時にARNの同一性が極めて重要な理由

::: tip 1行要約
AWS SNSトピックを誤削除して再作成する場合、トピック名だけでなく**AWSアカウントID、リージョン、大文字小文字を含む完全なARN(Amazon Resource Name)を一致**させなければ、SQSやLambdaのサブスクリプション参照関係が断絶する。
:::

## 1. 障害インシデントの流れ

```
[障害発生から復旧までのフロー]
1. [SNSトピック誤削除] ──> トピックARNが完全消失
                                 │
2. [同名で再作成] ──────> 異リージョンまたは別アカウントの場合: ARN不一致 ──✖ (通知切断)
                                 │
3. [完全一致ARNで再作成] ──> 同一ARN生成 ──✔ (SQS/Lambdaサブスクリプション正常復帰)
```

* 運用チームで検証用トピックを削除する際、誤って本番アラートパイプラインのSNSトピックを削除。
* 直ちに同名でトピックを再作成したが、ダウンストリームのSQSキューやLambda関数にメッセージが到達しないインシデントが発生。

---

## 2. ARN構造とサブスクリプション参照のメカニズム

AWS SNSのARNは以下の厳格なフォーマットで決定論的に生成される。

```
arn:aws:sns:{Region}:{Account-ID}:{TopicName}
```

* **ダウンストリームサービスの挙動**: SQSキューやCloudWatchアラーム、Lambdaトリガーはトピック名ではなく**完全修飾ARN**をターゲットとして保持している。
* **ARNが完全に一致していれば**（同じアカウント、同じリージョン、同じトピック名）、トピックを再作成した瞬間に既存のIAMポリシーやCloudWatchアラームの通知先参照が自動的に再接続される。

---

## 3. 実践トラブルシューティング手順

```bash
# 1. 削除前の正確なARNの確認 (CloudTrailイベント検索)
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteTopic

# 2. 完全一致するリージョンおよび名前でトピック再作成
aws sns create-topic \
    --name Production-Alert-Topic \
    --region ap-northeast-2

# 3. トピックARNの属性検証
aws sns get-topic-attributes \
    --topic-arn arn:aws:sns:ap-northeast-2:123456789012:Production-Alert-Topic
```

---

## 4. コアチェックポイント (Gotchas)

1. **IaC(Terraform/CloudFormation)による削除保護**: 本番SNSトピックには`prevent_destroy = true`またはDeletionPolicyを設定し、コンソールからの誤削除を物理的に防止する。
2. **サブスクライバー側のIAMポリシー確認**: SQSキューのアクセスポリシー側で`Condition: {"ArnEquals": {"aws:SourceArn": "arn:aws:sns:..."}}`が設定されている場合、ARNが1文字でも異なるとメッセージが暗黙的に拒否(Deny)される。

---
*投稿日: 2026-08-15 14:04:16*
*更新日: 2026-08-15 13:57:00*
