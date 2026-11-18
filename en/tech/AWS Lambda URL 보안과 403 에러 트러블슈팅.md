---
title: "Analyzing 403 Forbidden Errors After Regenerating AWS Lambda Function URLs"
description: "This post analyzes a 403 Forbidden error that occurs when regenerating an AWS Lambda Function URL after deleting it for security reasons. The error is caused by a missing resource-based policy due to an AWS console cache bug. We'll cover how to resolve it by refreshing the browser and adding code-level validation logic."
date: 2026-11-18
tags: [AWS, Troubleshooting, Security, Serverless, Lambda]
---

# Analyzing 403 Forbidden Errors After Regenerating AWS Lambda Function URLs

::: tip TL;DR
If you encounter a `{"Message":"Forbidden"}` error after regenerating a Lambda Function URL, it might be due to a missing resource-based policy caused by an AWS console cache bug. The fix is to refresh your browser and then recreate the URL.
:::

## Incident Overview

A Lambda Function URL for a Telegram webhook, configured with `AuthType: NONE`, was committed to `setup_aws.md` and exposed publicly. This posed a security risk: anyone could use tools like `curl` to send arbitrary POST requests, potentially manipulating GitHub blog content or exhausting the connected Gemini API's quota.

Instead of rewriting Git history, we decided to immediately delete and re-issue the existing Function URL and add defensive logic at the code level to validate the sender's `CHAT_ID`.

## Root Cause Analysis: 403 Forbidden and No Response

After deleting the old Function URL and creating a new one with `AuthType: NONE` in the AWS console, we successfully called the Telegram `setWebhook` API. However, the Telegram bot's `/info` command received no response, and AWS CloudWatch monitoring showed zero function invocations.

When accessing the regenerated URL directly, the following 403 error message was returned:

```json
{"Message":"Forbidden"}
```

The root cause was a bug related to the AWS console's caching behavior. If you delete a Function URL and then immediately click the 'Create URL' button without refreshing your browser (F5), the following occurs:

1.  The UI displays a cached status message like "A policy granting public access to the function URL exists."
2.  However, it actually skips creating the resource-based policy required for public invocations.
3.  Consequently, the resource-based policy JSON for the function is missing the public access statement (`Principal: "*"`) with `lambda:InvokeFunctionUrl` permission, causing all external calls to be blocked at the AWS infrastructure layer.

A normal policy should include the following public invocation permissions, in addition to other services like EventBridge:

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

## Recovery Procedure and Code-Level Defense

### 1. Recovering the Function URL Policy

We resolved the issue by following these steps:

1.  Delete the problematic Lambda Function URL again.
2.  Refresh your browser (F5) to completely clear the AWS console's cache.
3.  Recreate the Function URL with `AuthType: NONE` from the function's Configuration tab.
4.  After creation, verify that the resource-based policy has been correctly added in the 'Permissions' tab.
5.  Re-register the Telegram `setWebhook` with the newly issued URL to restore service.

### 2. Adding Code-Level Sender Validation

As an additional defensive measure against URL exposure, we added an `is_authorized_update()` function at the top of the `lambda_function.py` entry point. This function checks if the `message.chat.id` or `from.id` in the webhook payload matches the `TELEGRAM_CHAT_ID` environment variable. If a request comes from an unauthorized ID, it immediately discards the request and returns the following response before calling DynamoDB or AI APIs.

```python
# Example is_authorized_update() function logic
def is_authorized_update(update, context):
    # ... chat_id, from_id extraction logic ...
    if str(chat_id) != os.environ.get('TELEGRAM_CHAT_ID'):
        return False
    return True

# Main handler
def lambda_handler(event, context):
    if not is_authorized_update(update, context):
        return {"ok": True, "unauthorized_dropped": True}
    # ... existing logic ...
```

### 3. Spoofing Test Using PowerShell

To verify the defensive logic's correct operation, we sent a spoofed request with an unauthorized `chat_id` (e.g., `9999999`) using PowerShell's `Invoke-RestMethod`.

*Note: Windows PowerShell's `curl.exe` can cause "Unterminated string" errors when handling nested quotes within JSON, so `Invoke-RestMethod` is recommended.*

```powershell
Invoke-RestMethod -Method Post -Uri "https://<NEW_URL>.lambda-url.ap-northeast-2.on.aws/" -ContentType "application/json" -Body '{"update_id":1,"message":{"date":9999999999,"chat":{"id":9999999},"text":"/post test"}}'
```

The test confirmed that the Lambda function returned `{"ok": true, "unauthorized_dropped": true}`, performing the intended blocking action.

## Key Takeaways (Gotchas)

*   **AWS Console Cache**: When managing AWS services in the console where resources and policies are created/deleted together (like Lambda Function URLs), regenerating immediately after deletion without a refresh can lead to missing associated policies. It's always safer to refresh your browser after significant changes.
*   **Public URL Security**: A Function URL configured with `AuthType: NONE` acts as its own authentication mechanism. If the URL is exposed, it must be immediately revoked and reissued. Furthermore, you must implement code-level defensive logic to validate specific values in the payload (e.g., `chat.id`) or custom headers like `X-Telegram-Bot-Api-Secret-Token`.
*   **PowerShell JSON Transmission**: When sending complex JSON data as an API body in a PowerShell environment, it's recommended to use `Invoke-RestMethod` or `Invoke-WebRequest` cmdlets to avoid string parsing issues with `curl.exe`.
