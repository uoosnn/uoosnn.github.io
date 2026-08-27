---
title: "AWSバックアップ戦略：EBSスナップショットとAMIの違いと選定基準"
description: "EC2およびEBSバックアップにおけるスナップショットとAMIの内部構造の違い、整合性確保のための静止点(Quiescence)、ライフサイクル管理(DLM)の実践ガイド"
date: 2026-07-28
tags: [AWS, Cloud, Backup, EC2, EBS, Architecture, Infrastructure]
---

# AWSバックアップ戦略：EBSスナップショットとAMIの違いと選定基準

::: tip 1行要約
**EBSスナップショット**はブロックストレージ単位の増分バックアップであり、**AMI**はインスタンス起動メタデータ（OS、ブートローダー、ブロックデバイスマッピング）とスナップショットを束ねた完全な復元ブループリントである。
:::

## 1. EBSスナップショット vs AMI アーキテクチャ比較

AWS運用において、データ復旧時間目標(RTO)と復旧ポイント目標(RPO)を達成するためには、両者の概念的境界を正確に分離する必要がある。

```
[AMI (Amazon Machine Image) の構造]
┌─────────────────────────────────────────────────────────┐
│ AMI ID: ami-xxxxxxxxxxxxxxxxx                           │
│  ├─ [ルートボリューム EBSスナップショット] (snap-01)        │
│  ├─ [追加データボリューム EBSスナップショット] (snap-02)     │
│  └─ [インスタンスメタデータ] (Block Device Mapping, OS, 仮想化タイプ)│
└─────────────────────────────────────────────────────────┘
```

| 区分 | EBSスナップショット (Snapshot) | Amazon Machine Image (AMI) |
| :--- | :--- | :--- |
| **対象** | 単一または複数のEBSブロックボリューム | EC2インスタンス全体 (OS + 設定 + 全ボリューム) |
| **保存データ** | ボリューム内の変更されたブロックデータ (S3保存) | スナップショット参照 + ブロックデバイスマッピング情報 |
| **復元プロセス** | 1. スナップショットからEBS生成<br>2. 既存EC2へボリューム再アタッチ | AMIから新規EC2インスタンスを即時起動 (1-Click) |
| **主な用途** | DB/ファイルサーバーの増分データバックアップ | 障害復旧(DR)インスタンス、Auto Scaling起動テンプレート |

---

## 2. 実戦選択マトリックス

* **シナリオ A: OSを含むサーバー全体の完全障害復旧(DR)** ➔ **AMIバックアップ推奨**
  * システムファイル破損やOSクラッシュ時、設定済みのAMIから即座に同一スペックのインスタンスを起動可能。
* **シナリオ B: 大容量データボリュームの周期的な増分バックアップ** ➔ **EBSスナップショット推奨**
  * 初回フルバックアップ以降は変更ブロックのみが増分保存されるため、S3ストレージコストを最小化。

---

## 3. 静止点(Quiescence)の確保と整合性

運用中のEC2/DBでバックアップを作成する場合、OSメモリキャッシュ(Dirty Pages)がディスクにフラッシュされていない状態でスナップショットが取得されると、ファイルシステムの不整合(Inconsistency)が発生する恐れがある。

```bash
# Linux: XFS/EXT4 ファイルシステムの一時フリーズ (静止点確保)
fsfreeze -f /data

# AWS CLI: スナップショット作成トリガー
aws ec2 create-snapshot --volume-id vol-0123456789abcdef0 --description "Consistent-Backup"

# ファイルシステムのフリーズ解除
fsfreeze -u /data
```

---

## 4. 自動化ライフサイクル管理 (Amazon Data Lifecycle Manager)

手動バックアップの人的ミスを防ぐため、**AWS DLM(Data Lifecycle Manager)** ポリシーを定義し、タグベースの自動保持(Retention)サイクルを適用する。

```json
{
  "ResourceTypes": ["VOLUME"],
  "TargetTags": [{"Key": "Environment", "Value": "Production"}],
  "Schedules": [
    {
      "Name": "Daily-Snapshot",
      "CreateRule": {"Interval": 24, "IntervalUnit": "HOURS", "Times": ["03:00"]},
      "RetainRule": {"Count": 7}
    }
  ]
}
```

---

## 5. コアチェックポイント (Gotchas)

1. **スナップショット削除順序の誤解**: 中間のスナップショットを削除しても、後続のスナップショットで参照されているブロックデータはS3内部で自動マージされるため、最新スナップショットが破損することはない。
2. **本番DBの稼働中バックアップ**: 高負荷トランザクションDB(MySQL/PostgreSQL)は、EC2スナップショットよりもRDS Automated Backupや`mysqldump`/LVMスナップショットを活用してトランザクションログ(WAL/binlog)の整合性を保証する。

---
*投稿日: 2026-07-28 08:33:04*
*更新日: 2026-08-15 13:57:00*
