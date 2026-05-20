yaml
---
title: "Apache SSL Error Without Logs: Troubleshooting with strace"
date: 2026-05-21
tags: [Tech, Troubleshooting, Apache, SSL, strace]
---

## Problem: Apache Fails Silently

After an SSL certificate renewal, the Apache web server failed to start. Unlike typical failure scenarios, there were peculiar aspects:

1.  **No Configuration File Syntax Errors**: When checking the validity of the configuration file (`httpd.conf`) with the `httpd -t` command, a normal `Syntax OK` response was received.
2.  **Absence of Error Logs**: No error records were found in the main error log file (`/var/log/httpd/error_log`).

The service wouldn't start, yet it was a 'Silent Failure' situation with no clues to identify the cause. In such cases, I decided to use `strace` to trace system calls and monitor process-level operations.

## Root Cause Analysis: Tracing System Calls with strace

I used the following command to trace system calls when the Apache daemon was run in foreground mode (`-X`).

```bash
# strace /usr/sbin/httpd -X 2>&1 | tail -n 50
```

From the last 50 lines of the `strace` output, I was able to capture the process's actions just before termination, which clearly indicated a critical error during the SSL private key processing.

### 1. SSL Passphrase Processing

```c
pipe([206, 207]) = 0
clone(...) = 2834
read(206, "8", 1)
read(206, "0", 1)
...
read(206, "\n", 1)
```

In the initial part of the log, Apache created a child process via `pipe` and `clone` system calls. This is a process to retrieve the passphrase for an encrypted private key from an external script, as configured by the `SSLPassPhraseDialog` directive in `httpd.conf`. It can be confirmed that the passphrase string was successfully received from the pipe via the `read` system call.

### 2. Private Key File Loading

```c
open("/etc/httpd/ssl_2026/mkgolf-mall.mk.co.kr/key.pem", O_RDONLY) = 203
read(203, "-----BEGIN RSA PRIVATE KEY-----\r"..., 4096) = 1781
```

After acquiring the passphrase, the Apache process opened the private key file (`key.pem`) for the corresponding virtual host using the `open` system call and loaded its content into memory via `read`. Up to this point, the flow was normal.

### 3. Error Occurrence and Process Termination

```c
write(46, "[Thu May 21 05:31:27 2026] [erro"..., 63) = 63
... (총 8줄의 에러 기록) ...
exit_group(1)
```

The problem occurred in the next step. Apache failed either to decrypt the private key loaded into memory with the previously provided passphrase or to validate its authenticity by comparing the decrypted key with the certificate (`cert.pem`).

What's noteworthy is that the first argument of the `write` system call, the File Descriptor, was `46`. This was not the standard error (`stderr`, fd 2), but a separate error log file specified for that particular virtual host. In other words, Apache **recorded the error only in the log file of a specific virtual host, not the main error log**, and then called the `exit_group(1)` system call with error code `1` to terminate its own process. This was why there was no trace in the main error log.

## Conclusion and Solution

Through `strace` log analysis, the root cause of the problem could be narrowed down to the following two scenarios:

1.  **Private Key Passphrase Mismatch**: Even though the passphrase for the newly issued `key.pem` file was changed or removed, the `SSLPassPhraseDialog` script passed the old passphrase, leading to decryption failure.
2.  **Certificate and Private Key Pair Mismatch**: The private key was correctly decrypted with the right passphrase, but it did not match the accompanying certificate file. (i.e., the modulus hash values of the two files were different).

Based on this analysis, I verified if the newly issued certificate and private key precisely matched by comparing their modulus values using the `openssl` command. If the key was passphrase-protected, I confirmed that the `SSLPassPhraseDialog` setting returned the correct value. Ultimately, the problem was resolved by applying the correct certificate/key pair and restarting Apache.

This troubleshooting experience reaffirmed how powerful system-level debugging tools like `strace` can be in failure scenarios where no clues are left in log files.

Posted on: 2026-05-21 05:47:07