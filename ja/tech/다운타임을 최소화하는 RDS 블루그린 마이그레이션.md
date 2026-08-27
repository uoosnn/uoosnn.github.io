---
title: "ダウンタイムを最小化するAmazon RDS Blue/Greenデプロイ移行ガイド"
description: "RDSメジャーバージョンアップグレード時のダウンタイムを1分未満に短縮するBlue/Greenデプロイの内部レプリケーション原理、パラメータ制約、フェイルオーバーSOP"
date: 2026-07-23
tags: [AWS, RDS, Database, MySQL, Migration, HighAvailability, Cloud]
---

# ダウンタイムを最小化するAmazon RDS Blue/Greenデプロイ移行ガイド

::: tip 1行要約
Amazon RDS Blue/Greenデプロイは、**ステージング環境(Green)を独立プロビジョニングし、論理レプリケーションで同期した後にDNSエンドポイントを瞬時に切り替える(Switchover)**ことで、DBアップグレードに伴うダウンタイムを1分未満に抑制する。
:::

## 1. なぜIn-Place直接アップグレードは危険なのか？

MySQL 5.7から8.0へのメジャーバージョンアップグレードを稼働中インスタンスに直接実行(In-Place)すると、データディクショナリ変換とインデックス再構築により**数十分から数時間のダウンタイム**が発生し、障害時の即時ロールバックが不可能になる。

```
[RDS Blue/Green デプロイ アーキテクチャ]
Production Traffic
       │
       ▼ (DNS Endpoint: mydb.c7xxxx.ap-northeast-2.rds.amazonaws.com)
┌──────────────┐                          ┌──────────────┐
│ [Blue DB]    │ ──(Logical Replication)─>│ [Green DB]   │
│ MySQL 5.7    │   (binlog_format = ROW)  │ MySQL 8.0    │
└──────────────┘                          └──────────────┘
   (現行本番)                                (アップグレード検証環境)
```

---

## 2. 実践移行手順 (SOP)

### Step 1. パラメータグループの事前準備
Blue/Greenデプロイを実行するには、論理レプリケーション用のバイナリログ設定が必須である。

```ini
# カスタムパラメータグループで設定 (再起動が必要な静的パラメータ)
binlog_format = ROW
binlog_row_image = FULL
```

### Step 2. Green環境のプロビジョニングと事前検証
マネジメントコンソールまたはAWS CLIからBlue/Greenデプロイを作成し、Green環境でクエリ互換性(`sql_mode`)やインデックスパフォーマンスを検証する。

```bash
aws rds create-blue-green-deployment \
    --blue-green-deployment-name bg-mysql8-upgrade \
    --source "arn:aws:rds:ap-northeast-2:123456789012:db:prod-mysql" \
    --target-engine-version "8.0.36"
```

### Step 3. 切り替え実行 (Switchover)
レプリケーション遅延(Replication Lag)が0秒になった時点で切り替えを実行する。

```bash
aws rds switchover-blue-green-deployment \
    --blue-green-deployment-identifier bgd-xxxxxxxxx \
    --switchover-timeout 30
```
* **DNS切り替え**: AWSがBlueとGreenのDNSエンドポイント名を相互交換し、既存Blueへの書き込みをブロックした上でGreenへトラフィックを即時ルーティング。実質的な切替時間は30秒未満で完了。

---

## 3. コアチェックポイント (Gotchas)

1. **静的パラメータ変更時の再起動**: `binlog_format`はStaticパラメータであるため、本番適用には事前のインスタンス再起動が伴う。
2. **テーブル定義の制約**: 主キー(Primary Key)が存在しないテーブルは論理レプリケーション時に全件走査(Table Scan)が発生し、レプリケーション遅延の原因となるため事前にPKを追加する。
3. **ロールバックの即時性**: 切り替え後も旧Blueインスタンスは停止状態で保持されるため、問題発生時は逆向きの手動切り替えで即座に旧環境へ復旧可能。

---
*投稿日: 2026-07-23 23:22:25*
*更新日: 2026-08-15 13:57:00*
