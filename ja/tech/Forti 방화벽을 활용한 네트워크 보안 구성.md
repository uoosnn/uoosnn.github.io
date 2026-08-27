---
title: "FortiGateファイアウォールによるNAT移行とZoneベースネットワークセキュリティ構築"
description: "Forti-60Fをブリッジ(Transparent)からNAT/Routeモードへ切り替え、WAS/DB/DEVの3-Tier Zone分離とVIPポートフォワーディングを適用した実戦構成ガイド"
date: 2026-05-17
tags: [Network, Security, Firewall, FortiGate, NAT, VPN, Architecture]
---

# FortiGateファイアウォールによるNAT移行とZoneベースネットワークセキュリティ構築

::: tip 1行要約
ブリッジ(Transparent)モードで動作していたFortiGate-60Fを**NAT/Routeモードへ移行**し、物理ポート単位で**WAS / DB / DEV Zoneを分離**した上でVIP(Virtual IP) 1:1 NATおよび厳格なセキュリティポリシーを適用した構成案。
:::

## 1. ネットワークセキュリティ構成の概要

全サーバーへのパブリックIP直接割当から脱却し、内部サーバーをプライベートIP帯(`10.0.0.0/8`)へ隠蔽。Zone分離によりラテラルムーブメント（横展開攻撃）を遮断する。

```
[FortiGate 60F Zone トポロジー]
                        Internet (WAN 1 / グローバルIP)
                                   │
                         ┌─────────▼─────────┐
                         │   FortiGate-60F   │
                         │  (NAT/Route Mode) │
                         └──┬──────┬──────┬──┘
                            │      │      │
           ┌────────────────┘      │      └────────────────┐
           ▼                       ▼                       ▼
    [WAS Zone (DMZ)]       [DB Zone (隔離)]        [DEV Zone (開発)]
     10.0.1.0/24             10.0.2.0/24             10.0.100.0/24
    (VIP 80/443 公開)       (WASからの3306のみ許可)    (SSL-VPN接続)
```

---

## 2. 段階別構築手順

### 1) モード切り替え: TP(Transparent) ➔ NAT/Route モード
* L3ルーティングとNAT機能を有効化するため、FortiGateをNATモードへ切り替え。既存上位ルーターのデフォルトゲートウェイ機能を統合。

### 2) 物理ポート別Zone分割およびサブネット割当
`internal`仮想スイッチポートを分割し、用途別の独立インターフェースを作成。

```
- Port 1 (WAS Zone) : 10.0.1.1/24
- Port 2 (DB Zone)  : 10.0.2.1/24 (インターネット直接アウトバウンド遮断)
- Port 3 (DEV Zone) : 10.0.100.1/24
```

### 3) VIP (Virtual IP) インバウンドポートフォワーディング設定
外部グローバルIPへのWebトラフィック(`80`, `443`)をWASプライベートIPへ1:1マッピング。

```ini
config firewall vip
    edit "VIP_WAS_HTTPS"
        set extip 203.0.113.10
        set mappedip "10.0.1.10"
        set extintf "wan1"
        set portforward enable
        set protocol tcp
        set extport 443
        set mappedport 443
    next
end
```

### 4) Zone間トラフィック制御ポリシー
* **WAS ➔ DB**: 指定DBポート(`TCP 3306`, `TCP 1433`)のみホワイトリスト許可。
* **DB ➔ External**: インターネット直接接続を全面遮断。
* **External ➔ All**: 原則Deny All、許可されたVIPのみ通信可能。

---

## 3. コアチェックポイント (Gotchas)

1. **TPモード切替時のセッション切断**: TransparentからNATモードへの切替時は全インターフェースIPが初期化されるため、必ずRJ45シリアルコンソール接続下で作業を行う。
2. **VIPとファイアウォールポリシーの連動**: VIPオブジェクトを作成しても、`firewall policy`側でDestinationにVIPを指定して許可ルールを追加しなければパケットは通過しない。

---
*投稿日: 2026-05-17 08:11:32*
*更新日: 2026-08-15 13:57:00*
