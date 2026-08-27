---
title: "로그 없는 아파치 SSL 오류, strace로 분석한 실전 트러블슈팅"
description: "httpd -t는 정상이나 에러 로그 없이 프로세스가 죽는 Silent Failure를 strace 시스템 콜 추적으로 해결한 사례"
date: 2026-05-21
tags: [Linux, Apache, SSL, strace, Troubleshooting, Incident Report]
---

# 로그 없는 아파치 SSL 오류, strace로 분석한 실전 트러블슈팅

::: tip 1줄 요약
`httpd -t` 구문 검사는 정상이지만 메인 에러로그 없이 데몬이 즉시 죽는 경우, `strace httpd -X` 포그라운드 실행으로 추적하면 **특정 가상호스트 전용 로그 fd에 기록된 SSL Passphrase 및 키 페어 불일치 오류**를 즉시 찾아낼 수 있다.
:::

## 1. 장애 현상: 소리 없이 죽는 Apache (Silent Failure)

SSL 인증서 갱신 후 Apache 데몬 기동이 실패했다. 일반적인 장애와 달리 단서가 없는 상태였다.

* **설정 파일 문법**: `httpd -t` 실행 시 `Syntax OK` 정상 반환
* **메인 에러 로그**: `/var/log/httpd/error_log`에 아무런 에러 메시지가 기록되지 않음

프로세스가 시작하자마자 어떤 로그도 남기지 않고 즉시 종료되는 'Silent Failure' 상태였으므로, 시스템 콜 레벨에서 원인을 파악하기 위해 `strace`를 투입했다.

## 2. strace를 통한 시스템 콜 추적

Apache를 단일 프로세스/포그라운드 디버그 모드(`-X`)로 기동하면서 시스템 콜을 캡처했다.

```bash
# strace로 Apache 기동 과정 추적
strace /usr/sbin/httpd -X 2>&1 | tail -n 50
```

`strace` 출력의 마지막 부분에서 프로세스가 비정상 종료(`exit_group(1)`)된 결정적 단서가 포착되었다.

```c
// 1. SSL Passphrase 스크립트 실행 (파이프 통신)
pipe([206, 207]) = 0
clone(...) = 2834
read(206, "8", 1) ... // 암호 획득

// 2. 개인키 파일 로드
open("/etc/httpd/ssl/key.pem", O_RDONLY) = 203
read(203, "-----BEGIN RSA PRIVATE KEY-----\r"..., 4096) = 1781

// 3. 특정 가상호스트 전용 로그(fd=46)에 에러 출력 후 프로세스 즉시 종료
write(46, "[Thu May 21 05:31:27 2026] [error] SSL Library Error: ...", 63) = 63
exit_group(1)
```

### 핵심 발견: 메인 에러로그가 아닌 가상호스트 fd(46)에만 기록됨
`write` 시스템 콜의 파일 디스크립터가 `46`이었다. 
즉, 메인 `/var/log/httpd/error_log`가 아니라 **특정 VirtualHost 설정에 정의된 별도 로그 파일에 에러를 쓰고 데몬이 죽어버렸기 때문**에 메인 로그에서는 아무것도 보이지 않았던 것이다.

## 3. 원인 규명 및 해결 조치

원인은 새로 갱신된 `key.pem`의 암호화 방식 변경 및 인증서와의 **모듈러스(Modulus) 해시 불일치**였다.

```bash
# 1. 인증서와 개인키의 모듈러스 해시 일치 여부 검증
openssl x509 -noout -modulus -in /etc/httpd/ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in /etc/httpd/ssl/key.pem | openssl md5
# -> 두 MD5 해시값이 반드시 일치해야 정상 페어임

# 2. Passphrase가 걸려있는지 확인
openssl rsa -in /etc/httpd/ssl/key.pem -check
```

1. 인증서와 짝이 맞는 올바른 개인키 파일로 교체.
2. `SSLPassPhraseDialog` 스크립트가 반환하는 비밀번호와 개인키 암호를 일치시키거나 Passphrase가 제거된 키로 재배치.
3. Apache 정상 재기동 완료.

## 4. 핵심 체크포인트 (Gotchas)

1. **`httpd -X` 포그라운드 디버그 모드**: 백그라운드 포크(Fork) 없이 단일 스레드로 실행되므로 `strace`나 `gdb` 분석 시 필수 옵션이다.
2. **VirtualHost 에러로그 분산 주의**: SSL 핸드셰이크나 키 로딩 실패는 메인 로그가 아닌 해당 가상호스트의 `ErrorLog` 지시자에만 남을 수 있으므로 모든 vhost 로그를 확인해야 한다.
3. **OpenSSL Modulus 검증 습관화**: 인증서 갱신 작업 시 배포 전 `openssl md5` 모듈러스 비교를 자동화 스크립트에 포함하면 이러한 휴먼 에러를 100% 예방할 수 있다.

---
*게시된 시간: 2026-05-21 05:47:07*
*수정한 시간: 2026-08-15 13:57:00*
