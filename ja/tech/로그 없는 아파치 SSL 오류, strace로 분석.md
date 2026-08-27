---
title: "エラーログが出力されないApache起動失敗をstraceシステムコール追跡で解決した事例"
description: "Apache httpd起動時にエラーログを残さず即座にプロセス終了する障害を、straceシステムコール追跡とOpenSSL modulus検証で根本解決した実戦トラブルシューティング"
date: 2026-06-25
tags: [Linux, Apache, SSL, Troubleshooting, SysAdmin, strace, Security]
---

# エラーログが出力されないApache起動失敗をstraceシステムコール追跡で解決した事例

::: tip 1行要約
Apache(httpd)が`error_log`にログを1行も残さず起動に失敗する場合、**`strace -f`でプロセス初期化時のシステムコールを直接トレース**し、SSL証明書と秘密鍵のModulusハッシュ不一致を特定して解決した実録。
:::

## 1. 障害状況：ログの完全な沈黙

CentOS/RHEL環境でApache Webサーバーの再起動を実行したところ、起動に失敗しプロセスが即時終了した。

```bash
# 起動コマンド実行
systemctl start httpd
Job for httpd.service failed because the control process exited with error code.

# ログ確認 -> エラーログが全く出力されていない
tail -n 20 /var/log/httpd/error_log
# (ログ出力なし)
```

---

## 2. 原因究明：`strace` システムコール追跡

ログが出力されない原因は、ロギングデーモンが初期化される前の極めて初期のバイナリパース段階でクラッシュしているためである。`strace`を用いてバイナリ実行時のファイルI/Oとシステムコールを追跡した。

```bash
# Apache起動バイナリをstraceでフォーク追跡
strace -f -e trace=file,write httpd -X
```

```
[strace 出力抜粋]
open("/etc/httpd/conf.d/ssl.conf", O_RDONLY) = 3
open("/etc/pki/tls/certs/server.crt", O_RDONLY) = 4
open("/etc/pki/tls/private/server.key", O_RDONLY) = 5
write(2, "SSL Library Error: 185073780 error:0B080074:x509 certificate routines:X509_check_private_key:key values mismatch", 115) = 115
exit_group(1) = ?
```

* **根本原因**: `server.crt`（SSL公開証明書）と`server.key`（秘密鍵）のキーペアが一致していなかった。
* **ログ不在の理由**: 標準エラー出力(fd=2)に直接SSLエラーを吐き出してプロセスが即時`exit_group(1)`で終了していたため、`error_log`ファイルへの書き込み関数が呼ばれていなかった。

---

## 3. キーペア整合性検証 (OpenSSL Modulus Check)

証明書と秘密鍵のModulus（公開鍵の剰余）ハッシュを計算し、不一致を確認した。

```bash
# 1. SSL証明書のModulus MD5ハッシュ計算
openssl x509 -noout -modulus -in /etc/pki/tls/certs/server.crt | openssl md5
# 出力: (stdin)= a1b2c3d4e5f6...

# 2. 秘密鍵のModulus MD5ハッシュ計算
openssl rsa -noout -modulus -in /etc/pki/tls/private/server.key | openssl md5
# 出力: (stdin)= 998877665544... (不一致確認)
```

正しい秘密鍵ファイルへパスを再設定後、Apacheは正常に起動した。

---

## 4. コアチェックポイント (Gotchas)

1. **フォアグラウンドデバッグモード (`httpd -X` / `apachectl -X`)**: デーモン起動せずに単一プロセスでフォアグラウンド実行することで、標準エラー出力に直接エラーメッセージを捕捉できる。
2. **証明書チェーンの順序**: 中間証明書(CA Bundle)の順序が誤っている場合もブラウザ側でハンドシェイクエラーが発生するため、`openssl verify -CAfile ca-bundle.crt server.crt`で事前検証を行う。

---
*投稿日: 2026-06-25 21:04:12*
*更新日: 2026-08-15 13:57:00*
