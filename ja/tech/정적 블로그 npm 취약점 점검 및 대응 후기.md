---
title: "VitePress静的ブログにおけるnpm依存関係の脆弱性分析とCI/CDセキュリティ対応記録"
description: "静的サイトのビルドパイプライン(GitHub Actions)および開発環境におけるセキュリティ脅威分析、npm audit fixの適用とpackage-lock.json管理ガイド"
date: 2026-08-09
tags: [Security, npm, VitePress, CI-CD, Vulnerability, Node.js, DevSecOps]
---

# VitePress静的ブログにおけるnpm依存関係の脆弱性分析とCI/CDセキュリティ対応記録

::: tip 1行要約
静的サイトの配信成果物(HTML/JS)は安全であっても、**CI/CD(GitHub Actions)ビルドコンテナ内でのSecrets奪取やローカル開発環境でのパストラバーサル(Path Traversal)**を防ぐため、`npm audit fix`の適用と`package-lock.json`の厳格なバージョン管理が不可欠である。
:::

## 1. 静的サイトにおけるnpm脆弱性の真の脅威モデル

* **本番配信ランタイム (User Browser)**: 単なる静的ファイル配信のためサーバーサイドRCEのリスクは皆無。
* **CI/CDパイプライン (GitHub Actions Runner)**: ビルド実行時に悪意ある依存パッケージがスクリプトを実行し、環境変数に保存された`GITHUB_TOKEN`や`API_KEYS`を外部流出させるリスクが存在。
* **ローカル開発PC (`npm run dev`)**: Vite/PostCSSのパストラバーサル(CWE-22)等によりローカルファイルシステムが侵害されるリスク。

---

## 2. 脆弱性スキャン結果

```bash
npm audit
```

| パッケージ名 | 深刻度 | 脆弱性タイプ (CWE) | 脅威内容 |
| :--- | :--- | :--- | :--- |
| `brace-expansion` | **High** | CWE-400 (DoS) | 不正な入力処理時に過度なCPUリソースを消費 |
| `postcss` | **High** | CWE-22 (Path Traversal) | `.map`読み込み時に任意パスへのファイルアクセス |
| `vite` | **High** | CWE-22 / CWE-522 | Windows環境におけるNTLMv2ハッシュ流出リスク |

---

## 3. 対応手順：自動パッチと`package-lock.json`同期

```bash
# セマンティックバージョニング範囲内で安全に自動更新
npm audit fix
```

* **`package-lock.json`のコミット必須性**: GitHub Actionsは`npm install`ではなく`package-lock.json`を参照する`npm ci`を実行するため、ローカルで更新された`package-lock.json`をコミット&プッシュしなければCI環境では脆弱な旧バージョンがインストールされ続ける。

---

## 4. コアチェックポイント (Gotchas)

1. **`npm audit fix --force`の乱用禁止**: `--force`はメジャーバージョンの破壊的変更(Breaking Change)を伴うため、VitePressテーマが破損する恐れがある。メジャー更新はリリースノートを確認して手動で行う。
2. **Dependabotの活用**: GitHub Dependabotを有効化し、脆弱性PRを定期的に自動生成させることで運用負荷を軽減する。

---
*投稿日: 2026-08-09 09:54:57*
*更新日: 2026-08-15 13:57:00*
