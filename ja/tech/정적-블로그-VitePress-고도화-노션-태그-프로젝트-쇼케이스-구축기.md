---
title: "静的ブログ(VitePress)高度化：Notion風タグシステムとプロジェクトショーケース構築記"
description: "VitePress静的ブログをエンジニアリングブランディング拠点へと進化させたNotion風タグ/ラベリング、クライアントサイドフィルタリング、および成果指標重視のプロジェクトショーケース構築ログ。"
date: 2026-08-23
tags: [Tech, VitePress, Frontend, Architecture, UI/UX, Showcase, Automation, DevOps]
---

# 🚀 静的ブログ(VitePress)高度化：Notion風タグシステムとプロジェクトショーケース構築記

ブログ(`uoosnn.com`)にインフラトラブルシューティング、セキュリティ侵害対応、0円サーバーレスなど実践的な技術文書が約20件蓄積されるにつれ、ひとつの課題に直面しました。

> *「訪問者や採用担当者が多数の技術ログの中から目的のトピックを1秒で見つけるにはどうすればよいか？」*  
> *「単なるテキスト履歴書を超えて、設計したシステム構成や定量的成果をひと目で証明するにはどうすべきか？」*

これを解決するため、**VitePressとVue 3カスタムコンポーネント、SSGビルドタイムデータローダー**を組み合わせ、**Notion風のタグ/ラベリングシステム**と**インタラクティブなプロジェクトショーケース(`/ja/projects`)**を構築しました。本稿ではその設計思想と実装ノウハウを共有します。

---

## 1. Notion風タグ＆ラベリングの設計

### ① 課題とUXのゴール
frontmatterに `tags: [AWS, Security, Troubleshooting]` を記載していても、直感的に把握しタグ別に記事を絞り込むUIが不足していました。そこで親しみやすく視認性の高い**Notionデータベースのパステル調ピルバッジ**を採用しました。

### ② カテゴリ別の自動配色
タグ名に応じて自動的に適切なパステルカラーが適用されます：
- 🔵 **Blue**: `AWS`, `Cloud`, `Network`, `Linux`, `RDS`（インフラ/クラウド）
- 🟢 **Green**: `Troubleshooting`, `Performance`, `Automation`（性能/トラブル対応）
- 🔴 **Red**: `Security`, `CVE`, `Incident`, `Forensic`（セキュリティ/侵害対応）
- 🟣 **Purple**: `Serverless`, `Lambda`, `AI`, `Gemini`, `Architecture`（サーバーレス/AI）
- 🟡 **Yellow**: `Windows`, `WSL`, `MySQL`, `Database`, `C++`（DB/OS/言語）
- ⚪ **Gray**: `VitePress`, `Tech`, `Blog`（一般）

---

## 2. ビルド時データローダーとリアルタイム検索 (`TagFilterBoard.vue`)

ブラウザ実行時に全Markdownを解析するとパフォーマンス(TBT)低下の原因になります。  
VitePressの `createContentLoader` を活用し、**ビルド時に全記事のメタデータをJSONへコンパイルする `posts.data.mjs`** を構築しました。

`TagFilterBoard.vue` の主要機能：
1. **タグ別記事数の集計**: `#AWS (6)`, `#Troubleshooting (8)` 等の動的算出
2. **URLクエリ連動 (`?tag=AWS`)**: タグ指定リンクからの初期フィルター表示
3. **全文インクリメンタル検索**: タイトル・概要・タグを横断する高速検索

---

## 3. 定量的成果を重視したプロジェクトショーケース (`/ja/projects`)

単なるプロジェクトの羅列ではなく、**`課題定義(Problem)` → `解決策(Solution)` → `定量的成果(Key Metrics)` → `技術記事リンク(Deep Dive)`** で構造化しました。

### 掲載している代表4大プロジェクト
1. **AWS 0円 Always Free サーバーレステレグラムブログ自動化パイプライン (2026)**
   - *主な成果*: 常時インフラ費用月0円維持、スマホから1分で投稿完了、完全No-Ops運用
2. **ハイブリッドクラウドIDC無停止マイグレーション & TCO最適化 (2021-2026)**
   - *主な成果*: RDS Blue/Green切り替えを数十秒で完了、運用コスト30%削減
3. **CVE-2025-55182 侵害事故緊急フォレンジック & システムコール解析 (2026)**
   - *主な成果*: 検知後1時間以内に緊急隔離および復旧完了、2次被害ゼロ
4. **Coline Incubator & Anger Control Disorder (C++ ゲームエンジン & メンタリング) (2019-2025)**
   - *主な成果*: 大学卒業制作優秀選定、YouTube講義動画・GitHubオープンソース公開

---

## 4. 記事上部メタデータ & 読了目安時間 (`ReadingTime.vue`)

VitePressの `doc-before` スロットに `ReadingTime.vue` を注入し、各記事上部にメタ情報ヘッダーを表示：
- 📅 **投稿日**
- ⏱️ **読了目安時間**: 文字数換算（約500文字/分）
- 📁 **カテゴリ区分**: `Tech & Architecture` / `Blog & Life`
- 🏷️ **クリック可能なNotion風タグ一覧**

---

## 5. CI/CDデプロイ通知の自動化

GitHub Actions (`deploy.yml`) にTelegram通知ステップを組み込み、プッシュ時のビルド成否と配信URLをリアルタイム受信できるようにしました。

---

## 6. まとめと今後の展望

今回の高度化により、`uoosnn.github.io` は**エンジニアリング問題解決能力を直感的に証明する技術ハブ**へと進化しました。  
今後は **Windows 11 + WSL2環境におけるTerraform IaC自動化シリーズ** や **Prometheus & Grafanaローカル監視構築** を連載予定です。
