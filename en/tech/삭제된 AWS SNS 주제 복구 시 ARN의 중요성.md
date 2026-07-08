---
title: "The Importance of ARN When Recovering Deleted AWS SNS Topics"
date: 2026-07-08
tags: [Tech, Troubleshooting, Incident Report, AWS, SNS, CloudWatch, ARN]
---

### Problem Situation: Deleted SNS Topic and Non-functional CloudWatch Alarms

Recently, an incident occurred in a client environment where an AWS SNS (Simple Notification Service) topic used for monitoring alarms was accidentally deleted. The first recovery strategy attempted was to create a new topic with the 'same name' as the deleted one. This action was based on the hypothesis that CloudWatch alarms would reference the topic's 'name'.

However, this method was not a complete solution. It was discovered that numerous existing CloudWatch alarms were unable to send notifications correctly to the newly created SNS topic. This troubleshooting log was written to document why service integration failed despite recreating the resource with the same name, explaining the concept of **ARN (Amazon Resource Name)** as the root cause, and outlining the correct recovery procedure.

### Initial Response and Incorrect Assumption

To identify the subscribers of the deleted SNS topic, we first checked the AWS CloudTrail logs. The `DeleteTopic` event was confirmed, but logs from the topic's creation or modification (`CreateTopic`, `SetTopicAttributes`, etc.) were lost due to the expiration of the retention period (90 days). In a situation where the subscriber list could not be immediately restored, we formed the following seemingly logical hypothesis:

> "CloudWatch alarms will send notifications based on the 'name' of the SNS topic. Therefore, if a topic is recreated with the same name, existing alarms will automatically recognize the new topic and send notifications without requiring changes to their settings."

Based on this hypothesis, a new SNS topic was created with the exact same name as the deleted one.

### Root Cause: ARN (Amazon Resource Name), Not Name

However, test results showed that existing CloudWatch alarms were still unable to send notifications. The root cause lay in **ARN**, a core concept of AWS resource management.

-   **Name**: A user-defined identifier, unique within a region, but can be reused after deletion.
-   **ARN (Amazon Resource Name)**: A globally unique ID assigned to every AWS resource upon creation. It's like a resource's 'social security number'; once a resource is deleted, its ARN is permanently gone, and even if a new resource is created with the same name, a completely new ARN is assigned.

CloudWatch alarm's 'Action' settings store the unique identifier **ARN**, not the SNS topic's name.

-   **Existing Alarm Setting**: `arn:aws:sns:ap-northeast-2:123456789012:OLD-TOPIC-UNIQUE-ID`
-   **Topic Deletion**: The above ARN now points to a non-existent resource.
-   **Topic Recreation with Same Name**: A new ARN, `arn:aws:sns:ap-northeast-2:123456789012:NEW-TOPIC-DIFFERENT-ID`, is assigned.

Consequently, all existing CloudWatch alarms were still pointing to a 'past ARN' that no longer existed, leading to the failure of notification delivery. This was the key finding of this **troubleshooting** effort.

### Correct SNS Topic Recovery Procedure

The correct **AWS SNS topic recovery** procedure established through this incident is as follows:

1.  **Secure Subscription Information**: This is the most crucial step. If CloudTrail logs have expired, you must obtain the list of existing subscribers (email, Lambda, SQS, etc.) through IaC (Infrastructure as Code) code, internal documentation, or service owners. In this case, fortunately, the owner knew the subscriber information, making recovery possible.

2.  **Recreate SNS Topic and Subscriptions**: Based on the secured information, create a new SNS topic with the same name and re-add all subscriptions.

3.  **Update CloudWatch Alarm Actions**: This step is critical.
    -   Identify all CloudWatch alarms that were using the deleted topic.
    -   Navigate to the 'Actions' settings of each alarm and remove the non-existent previous SNS topic (ARN).
    -   Re-add the newly created SNS topic (new ARN) as the notification target and save.

4.  **Verification Test**: After all settings are complete, use the AWS CLI to force a change in a specific alarm's state to confirm that notifications are correctly received by all subscribers.

    ```bash
    # Force the alarm state to ALARM for testing
    aws cloudwatch set-alarm-state \
      --alarm-name "My-EC2-Status-Check-Alarm" \
      --state-value ALARM \
      --state-reason "Testing SNS notification recovery"
    ```

### Conclusion

This **troubleshooting** experience demonstrated the critical importance of clearly understanding the difference between 'Name' and 'ARN' when dealing with AWS resources. Many AWS service integrations operate based on the immutable unique identifier **ARN**, rather than reusable names. Therefore, when recreating a resource after deletion, it is essential to verify the settings of all services referencing that resource and update them with the new **ARN**.

---
Posted: 2026-07-08 09:35:53