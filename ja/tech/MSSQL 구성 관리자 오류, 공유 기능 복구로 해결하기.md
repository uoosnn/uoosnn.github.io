---
title: "MSSQL構成マネージャーの起動エラーを「共有機能の修復」で解決した事例"
description: "sqlmanager.dll欠落によるMMCスナップインロード失敗時、稼働中DBインスタンスを停止することなくISOメディアの共有機能(Shared Features)修復で安全に復旧した実録"
date: 2026-07-20
tags: [Database, MSSQL, SQL Server, DBA, Windows, Troubleshooting]
---

# MSSQL構成マネージャーの起動エラーを「共有機能の修復」で解決した事例

::: tip 1行要約
`SQL Server Configuration Manager`実行時に`sqlmanager.dll`欠落でMMCスナップインのロードに失敗した場合、単なる手動DLLコピーではなく**MSSQLインストールISOの「修復(Repair)」から「共有機能(Shared Features)」のみを選択復元**することで、DBエンジンを無停止で安全に復旧できる。
:::

## 1. 障害事象：SQL Server 構成マネージャー(MMC) ロード失敗

Windows Server上でネットワークプロトコルやサービスアカウントを管理する**SQL Server構成マネージャー(`SQLServerManagerXX.msc`)**起動時にスナップイン初期化エラーが発生。

* **原因**: `C:\Windows\System32\` または `C:\Program Files (x86)\Microsoft SQL Server\...\Shared\` 配下の`sqlmanager.dll`がアンチウイルスの誤検知または不正パッチにより消失。
* **1次手動対応の限界**: 別サーバーから`sqlmanager.dll`のみをコピーしたが、COMレジストリ依存関係の不一致により復旧せず。

---

## 2. 解決手順：ISOインストールメディアによる「共有機能」部分修復

稼働中のDBインスタンス(`MSSQLSERVER`)を再インストール・停止することなく、管理ツール層のみを復旧する**「共有機能の修復」**を実施。

```
[復旧範囲の隔離]
┌──────────────────────────────────────────────┐
│ MSSQL Server                                 │
│  ├─ [DBエンジン インスタンス] : 正常稼働維持 (影響なし) │
│  └─ [共有機能 (Shared Features)] : ISOメディアで修復│
│      └─ sqlmanager.dll, 管理ツール, MMC        │
└──────────────────────────────────────────────┘
```

1. **同一バージョンMSSQLインストールISOをマウント**。
2. **`setup.exe` 起動 ➔ メンテナンス(Maintenance) ➔ 修復(Repair)** を選択。
3. **修復対象の選択**: インスタンスを選択せず、**「共有機能のみ修復(Repair shared features only)」**を選択してウィザードを完了。
4. **検証**: コマンドラインから`SQLServerManager15.msc`を再実行し、正常起動を確認。

---

## 3. コアチェックポイント (Gotchas)

1. **CU(Cumulative Update)の再適用**: 初期RTM ISOで修復した場合、現在適用済みのCUインストーラーを再実行してバイナリバージョンを同期させる必要がある。
2. **手動DLLコピーの回避**: MMCスナップインはSxSアセンブリとCOM GUIDに依存するため、公式修復ウィザードを利用するのが最も安全である。

---
*投稿日: 2026-07-20 14:07:27*
*更新日: 2026-08-15 13:57:00*
