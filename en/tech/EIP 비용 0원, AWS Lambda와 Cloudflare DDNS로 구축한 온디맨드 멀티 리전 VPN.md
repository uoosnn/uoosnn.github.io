---
title: "$0 EIP Cost: Building an On-Demand Multi-Region VPN with AWS Lambda & Cloudflare DDNS"
description: "How to build a zero-cost on-demand OpenVPN system across Tokyo and Virginia regions using AWS Lambda, Telegram Bot, and Cloudflare Free DNS API without Elastic IP idle fees"
date: 2026-10-07
tags: [AWS, EC2, OpenVPN, Cloudflare, DDNS, Lambda, Serverless, Telegram, Troubleshooting]
---

# $0 EIP Cost: Building an On-Demand Multi-Region VPN with AWS Lambda & Cloudflare DDNS

::: tip 1-Line Summary
Built a **$0/month on-demand VPN system** combining **AWS Lambda + Telegram Bot + Cloudflare Free DNS API** to launch Tokyo/Virginia EC2 instances on click and dynamically update DNS A-records in 1 second, avoiding AWS 24/7 runtime limits and Elastic IP (EIP) idle charges.
:::

## 1. Background: Why an On-Demand VPN?

Running private OpenVPN servers in multiple AWS regions (Tokyo `ap-northeast-1` and N. Virginia `us-east-1`) is critical for testing multi-region network routing and accessing location-restricted services. However, running these instances 24/7 for intermittent personal use leads to unnecessary expenses:

1. **EC2 Free Tier Limits**: The AWS Free Tier provides 750 free instance hours per month. Running instances across two regions 24/7 totals ~1,440 hours, promptly exceeding the limit.
2. **Public IPv4 Charges**: Since February 2024, AWS charges $0.005/hour for all public IPv4 addresses.
3. **Elastic IP (EIP) Idle Cost**: Allocating an Elastic IP prevents the public IP from changing upon reboot, but AWS charges an **idle fee of $0.005/hour** whenever the associated EC2 instance is stopped.

> **Solution**: Keep EC2 instances stopped by default. Start them on-demand via Telegram bot buttons, dynamically update the new public IP to Cloudflare DNS via its free API, and allow clients to connect permanently using **a single, static `.ovpn` profile**.

---

## 2. Serverless Architecture Overview

The system is designed with a **100% serverless control plane (AWS Lambda Function URL)** to eliminate standing infrastructure costs.

```
[Serverless On-Demand VPN Architecture]

Telegram User
      │  /start or inline button click
      ▼
[Telegram Bot API] ──(Webhook HTTPS POST)──> [AWS Lambda Function URL] (Python 3.12)
                                                         │
                 ┌───────────────────────────────────────┴───────────────────────────────────────┐
                 ▼                                                                               ▼
     [AWS EC2 (Tokyo / Virginia)]                                                    [Cloudflare DNS REST API (Free)]
      1. ec2.start_instances()                                                       3. PATCH /dns_records
      2. Wait for new Public IP allocation                                           4. Update vpn-tokyo.uoosnn.com A-record
                 │                                                                               │
                 └───────────────────────────────────────┬───────────────────────────────────────┘
                                                         ▼
                                            [Telegram Notification Sent]
                                            "✅ Tokyo VPN is ready! Turn switch ON in OpenVPN app"
```

### Architectural Key Highlights
* **Static `.ovpn` Profile**: By configuring `remote vpn-tokyo.uoosnn.com 1194` once in client configs, clients never need profile re-imports or modifications when EC2 allocates a new dynamic IP.
* **Ultra-lightweight Package (0.77 MB)**: Used lightweight `requests` instead of heavyweight Telegram frameworks, compiled with `manylinux2014_x86_64` wheels to keep cold-start latency under 100ms.

---

## 3. Real-World Troubleshooting Logs

### Issue 1: Lambda 200 OK Response with Telegram Silence (Error Masking)
* **Symptom**: Telegram bot sent no response upon receiving `/start`, yet AWS Lambda monitoring metrics displayed successful executions with status `200 OK`.
* **Root Cause**: To satisfy Telegram webhook conventions and prevent retry loops, the top-level exception handler returned `200 OK` on uncaught errors. This inadvertently masked initialization crashes inside the Lambda runtime.
* **Resolution**: 
  1. Implemented a browser-accessible `config_check` diagnostic endpoint over HTTP GET.
  2. Identified `CLOUDFLARE_API_TOKEN_SET: false` instantly from the diagnostic JSON and configured the missing environment variable.

```json
// Browser health check diagnostic output
{
  "service": "aws-vpn-telegram-bot",
  "status": "online",
  "config_check": {
    "ALLOWED_CHAT_ID": 8771073288,
    "TELEGRAM_BOT_TOKEN_SET": true,
    "CLOUDFLARE_API_TOKEN_SET": false, // <-- Root cause identified!
    "AWS_TOKYO_INSTANCE_ID_SET": true
  }
}
```

### Issue 2: Cloudflare Proxy Setting for UDP Traffic (`proxied: false`)
* **Symptom**: OpenVPN client connections failed immediately after updating the DNS record.
* **Root Cause**: Cloudflare's free CDN proxy (Orange Cloud) only routes HTTP/HTTPS (port 80/443) traffic and drops raw UDP 1194 OpenVPN packets.
* **Resolution**: Explicitly set `"proxied": False` in the DNS update payload to enforce **DNS Only (Gray Cloud)** mode.

```python
# Cloudflare DNS A-record update payload
payload = {
    "type": "A",
    "name": "vpn-tokyo.uoosnn.com",
    "content": new_public_ip,
    "ttl": 60,         # 1-minute ultra-fast propagation
    "proxied": False   # Required for OpenVPN UDP 1194 direct connectivity
}
```

### Issue 3: Chat ID Whitelist Authorization Guard
* **Security Risk**: If the public Telegram bot username is discovered, unauthorized users could trigger EC2 instances and cause unexpected cloud bills.
* **Resolution**: Verified incoming `chat_id` against `ALLOWED_CHAT_ID` at the entry point of the Lambda dispatcher, rejecting unauthorized requests and logging audit alerts.

---

## 4. Cost Breakdown

| Service Component | Configuration & Usage | Monthly Cost |
| :--- | :--- | :--- |
| **AWS EC2 (Tokyo / Virginia)** | On-demand runtime (10~20 hours/month) | **$0.00** (Free Tier) |
| **AWS Lambda** | Function URL Webhook (< 1,000 invocations/mo) | **$0.00** (1M free req/mo) |
| **Cloudflare DNS API** | Domain hosting & REST API updates | **$0.00** (Permanently Free) |
| **AWS Public IPv4** | Billed only while EC2 is running ($0.005/h) | **~$0.05 - $0.10** |
| **Total** | | **Virtually $0.00 / month** |

---

## 5. Conclusion

This project demonstrates that **Cloudflare's ultra-fast DNS propagation (60s TTL) combined with free REST APIs can effectively eliminate Elastic IP requirements for on-demand cloud infrastructure**.

With a single tap on a Telegram button, multi-region VPN servers boot up in 20 seconds, and an instant `[🛑 Stop Now]` button ensures zero idle costs.
