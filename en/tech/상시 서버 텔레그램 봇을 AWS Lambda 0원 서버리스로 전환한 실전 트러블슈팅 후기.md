---
title: "Practical Troubleshooting Review: Migrating an Always-On Telegram Bot to AWS Lambda's Free Serverless Tier"
date: 2026-08-21
tags: [Tech, Troubleshooting, Incident Report]
---

# Practical Troubleshooting Review: Migrating an Always-On Telegram Bot to AWS Lambda

To reduce costs and improve operational efficiency, I migrated a Telegram bot, previously running on an always-on VM (Virtual Machine), to a fully serverless architecture utilizing AWS's Always Free Tier. This document records the three main technical issues encountered during this process and their resolution, presented in a troubleshooting log format.

### 1. Architecture Transition Background and Design

The existing architecture was inefficient in terms of cost and management. To improve this, a new architecture was designed, centered around AWS serverless services, with the goal of achieving 'zero cost'.

**Existing Architecture (VM-based)**
*   **Computing**: An `python3 bot_main.py` script running continuously on a cloud VM (Long Polling method). Incurred fixed monthly costs.
*   **State Management**: Stored news history and conversation states using JSON files on the local file system.
*   **Deployment**: Updated source code by directly connecting to the VM and using `git` CLI commands.

**New Architecture (AWS Serverless-based)**
*   **Computing**: Adopted `AWS Lambda`, leveraging 1 million permanent free requests per month.
*   **Endpoint**: Configured an HTTPS endpoint using `Lambda Function URL` to receive Telegram webhooks for free, without API Gateway.
*   **Database**: Introduced `Amazon DynamoDB`, utilizing 25GB of permanent free storage for stable state management.
*   **Scheduling**: Set up a Cron Job using `Amazon EventBridge` to trigger the news scraping Lambda function every day at 9 AM.
*   **Code Management**: Called the GitHub REST API via the `PyGithub` library, creating commits directly in the remote repository from within the Lambda function, eliminating local git dependency.

### 2. Core Troubleshooting Log

During the migration process, three major failure scenarios were encountered, and their respective root cause analyses and resolution processes are as follows.

#### Issue 1: Cross-Platform Binary Incompatibility (502 Bad Gateway)

After deploying the Lambda function, `502 Bad Gateway` errors consistently occurred upon invocation. CloudWatch logs revealed an `ImportError` originating from specific Python packages.

*   **Root Cause Analysis**:
    Dependency packages were installed via `pip install` in the Windows development environment and then zipped for deployment. During this process, C-Extension based libraries (e.g., `pydantic_core`, `grpcio`, `cryptography`) were installed as Windows-compatible binary files (`.pyd`). When attempting to load these packages in the Linux-based AWS Lambda execution environment, an `ImportError` occurred due to binary incompatibility, causing the function execution to fail.

*   **Resolution**:
    Options were added to the `pip install` command within the deployment packaging script (`build_zip.py`) to explicitly download binaries compatible with the Lambda execution environment. This ensured that Linux binaries are always packaged, regardless of the development environment.

    ```bash
    pip install -r requirements.txt -t ./package \
      --platform manylinux2014_x86_64 \
      --only-binary=:all: \
      --implementation cp
    ```
    *   `--platform manylinux2014_x86_64`: Specifies the target platform as AWS Lambda's Linux environment.
    *   `--only-binary=:all:`: Forces the use of pre-built binary packages preferentially over source compilation.
    *   `--implementation cp`: Specifies packages for the CPython interpreter.

#### Issue 2: AWS Lambda's Asynchronous Handler Processing Error (MarshalError)

To utilize the asynchronous (`asyncio`) features of the `python-telegram-bot` library, the Lambda handler was declared as `async def`, but `502 Bad Gateway` errors occurred again.

*   **Root Cause Analysis**:
    CloudWatch logs showed the message `Runtime.MarshalError: Object of type coroutine is not JSON serializable`. This issue arose because AWS Lambda's standard Python runtime bootstrap does not directly `await` handler functions defined with `async def`. The runtime invoked the handler as if it were a regular synchronous function, and then failed when attempting to JSON serialize the returned 'coroutine object'.

*   **Resolution**:
    A wrapper pattern was applied, where `asyncio.run()` is called within a standard synchronous function (`def`) that Lambda understands, to execute the asynchronous logic.

    ```python
    import asyncio

    # Main function containing the actual asynchronous logic
    async def main(event, context):
        # ... all asynchronous logic ...
        pass

    # Synchronous handler called by the Lambda runtime
    def lambda_handler(event, context):
        # Run the asynchronous event loop in a synchronous context
        return asyncio.run(main(event, context))
    ```

#### Issue 3: Telegram Webhook Timeout Causing Retry Loop

When the execution time for AI blog generation and multi-language translation exceeded 50 seconds, the Lambda function, despite completing successfully, repeatedly received the same webhook requests from the Telegram server at 1-minute intervals.

*   **Root Cause Analysis**:
    The Telegram webhook mechanism has a timeout of approximately 30-40 seconds after sending a request. When the Lambda function's total execution time exceeded this timeout, the Telegram server considered the request to have failed due to no response, and thus sent retries.

*   **Resolution**:
    To reduce execution time, English and Japanese translation tasks, which had no interdependencies, were changed from sequential to parallel processing. The code was optimized to execute two translation API calls concurrently using `asyncio.gather()`.

    ```python
    # Before modification: Sequential processing
    # english_translation = await translate_text(content, 'en')
    # japanese_translation = await translate_text(content, 'ja')

    # After modification: Parallel processing
    translation_tasks = [
        translate_text(content, 'en'),
        translate_text(content, 'ja')
    ]
    results = await asyncio.gather(*translation_tasks)
    ```
    This optimization reduced the total execution time to under 20 seconds, fundamentally resolving the Telegram webhook timeout issue.

### 3. Achievements and Conclusion

Through this serverless migration, the following achievements were made:
1.  **Cost Reduction**: Reduced monthly always-on server operating costs to $0 by utilizing AWS's Always Free Tier.
2.  **Elimination of Operational Burden (Zero-Ops)**: Eliminated operational burdens such as server infrastructure management, patching, and monitoring, allowing focus solely on application logic development.
3.  **Acquisition of Technical Expertise**: Gained practical troubleshooting experience in areas such as cross-platform serverless packaging, asynchronous programming in Lambda environments, and timeout optimization when integrating with external services (Webhooks).

---
*Posted: 2026-08-21 16:37:13*
