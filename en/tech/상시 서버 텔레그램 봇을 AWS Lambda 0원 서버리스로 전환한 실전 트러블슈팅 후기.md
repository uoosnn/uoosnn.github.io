---
title: "Migrating a 24/7 Telegram Bot to AWS Lambda for $0/Month Serverless Architecture"
description: "How to migrate an EC2 polling bot to AWS Lambda Webhooks, solve manylinux binary compilation, fix DynamoDB float serialization, and optimize asyncio pipelines"
date: 2026-08-23
tags: [AWS, Lambda, Serverless, TelegramBot, Python, DynamoDB, Troubleshooting, Architecture]
---

# Migrating a 24/7 Telegram Bot to AWS Lambda for $0/Month Serverless Architecture

::: tip 1-Line Summary
Migrated a 24/7 polling EC2 instance to an **API Gateway + AWS Lambda Webhook architecture**, resolving ARM64 C-extension dependencies, DynamoDB Decimal serialization, and async I/O bottlenecks to achieve **$0/month permanent free-tier operations**.
:::

## 1. Serverless Architecture Overview

```
[AWS Lambda Serverless Telegram Bot Architecture]
Telegram User
      │ (HTTPS POST Webhook)
      ▼
[Amazon API Gateway (HTTP API)] ➔ [AWS Lambda (Python 3.12 / ARM64)]
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      [Google Gemini API]      [Amazon DynamoDB]        [GitHub Actions API]
      (Summarization/Drafting)    (Context Session State)    (VitePress Auto Deploy)
```

---

## 2. Key Troubleshooting Milestones

### 1) Native C-Extension Compilation in Lambda Environments
* **Symptom**: Deploying dependencies packaged locally on Windows threw `ImportError: cannot import name 'cffi' / ELF class mismatch`.
* **Fix**: Used an ARM64 Amazon Linux container (`public.ecr.aws/sam/build-python3.12:latest-arm64`) to build `manylinux` compatible wheel binaries.

```dockerfile
# Cross-compile Lambda dependencies
docker run --rm -v "$PWD":/var/task public.ecr.aws/sam/build-python3.12:latest-arm64 \
    pip install -r requirements.txt -t /var/task/package --platform manylinux2014_aarch64 --only-binary=:all:
```

### 2) DynamoDB `TypeError: Float types are not supported`
* **Symptom**: Storing Unix epoch floats (`time.time()`) directly in DynamoDB crashed the bot execution.
* **Fix**: Implemented a recursive sanitizer coercing floats into `decimal.Decimal(str(val))`.

```python
from decimal import Decimal

def sanitize_for_dynamodb(data):
    if isinstance(data, float):
        return Decimal(str(data))
    if isinstance(data, dict):
        return {k: sanitize_for_dynamodb(v) for k, v in data.items()}
    return data
```

### 3) Concurrency Acceleration via `asyncio.gather`
* **Symptom**: Sequential execution of scraping, LLM content drafting, JA/EN translation, and GitHub API commits hit the 29-second API Gateway timeout limit.
* **Fix**: Parallelized translation and metadata extraction via `asyncio.gather()`, cutting execution duration by 65%.

---

## 3. Gotchas & Engineering Checkpoints

1. **Immediate 200 OK Webhook Handshake**: Telegram webhooks must receive an HTTP 200 OK acknowledgement quickly; prolonged background processing should be decoupled or optimized to avoid message replay storms.
2. **AWS Lambda Free Tier Efficiency**: With 1M free requests and 3.2M seconds of compute per month, personal utility bots incur zero infrastructure costs.

---
*Published: 2026-08-23 12:00:00*
*Updated: 2026-08-23 12:00:00*
