---
title: "常時サーバーTelegramボットをAWS Lambdaの0円サーバーレスに移行した実践トラブルシューティング体験記"
date: 2026-08-21
tags: [Tech, Troubleshooting, Incident Report]
---

# 常時サーバーTelegramボットをAWS Lambdaの0円サーバーレスに移行した実践トラブルシューティング体験記

既存の常時稼働VM（Virtual Machine）で運用していたTelegramボットを、コスト削減と運用効率化のため、AWSの永久無料プラン（Always Free Tier）を活用した完全サーバーレス（Serverless）アーキテクチャに移行しました。この過程で発生した3つの主要な技術的問題と解決プロセスを、トラブルシューティングログ形式で記録します。

### 1. アーキテクチャ移行の背景と設計

既存のアーキテクチャは、コストと管理の面で非効率的でした。これを改善するため、AWSのサーバーレスサービスを中心に、コスト「0円」を目標とする新しいアーキテクチャを設計しました。

**既存アーキテクチャ (VMベース)**
*   **コンピューティング**: クラウドVMで`python3 bot_main.py`スクリプトを常時実行（ロングポーリング方式）。固定の月額費用が発生。
*   **状態管理**: ローカルファイルシステムのJSONファイルを使用して、ニュース履歴と会話状態を保存。
*   **デプロイ**: VMに直接接続し、`git` CLIコマンドでソースコードを更新。

**新規アーキテクチャ (AWS Serverlessベース)**
*   **コンピューティング**: `AWS Lambda`を採用。月間100万件の永久無料リクエストを活用。
*   **エンドポイント**: `Lambda Function URL`を使用して、API Gatewayなしで無料でTelegramウェブフック(Webhook)を受信するHTTPSエンドポイントを構成。
*   **データベース**: `Amazon DynamoDB`を導入。25GBの永久無料ストレージを活用して状態を安定的に管理。
*   **スケジューリング**: `Amazon EventBridge`を使用して、毎日午前9時にニューススクレイピングLambda関数をトリガーするCron Jobを設定。
*   **コード管理**: `PyGithub`ライブラリを介してGitHub REST APIを呼び出し、Lambda関数内でリモートリポジトリに直接コミットを作成することで、ローカルgitの依存関係を排除。

### 2. 主要トラブルシューティングログ

移行プロセス中に3つの主要な障害状況に直面し、それぞれの原因分析と解決プロセスは以下の通りです。

#### 問題1: クロスプラットフォームバイナリの非互換性 (502 Bad Gateway)

Lambda関数デプロイ後、呼び出し時に継続的に`502 Bad Gateway`エラーが発生しました。CloudWatchログを確認した結果、特定のPythonパッケージで`ImportError`が発生していることを確認しました。

*   **原因分析**:
    開発環境であるWindowsで`pip install`を通じて依存性パッケージをインストールし、圧縮してデプロイしました。この過程でC-Extensionベースのライブラリ（例: `pydantic_core`、`grpcio`、`cryptography`）がWindows環境に合ったバイナリファイル（`.pyd`）としてインストールされました。これらのパッケージをLinuxベースのAWS Lambda実行環境でロードしようとすると、バイナリの非互換性により`ImportError`が発生し、関数実行が失敗しました。

*   **解決策**:
    デプロイパッケージングスクリプト（`build_zip.py`）内の`pip install`コマンドに、Lambda実行環境と互換性のあるバイナリを明示的にダウンロードするオプションを追加しました。これにより、開発環境に関係なく常にLinux用のバイナリをパッケージングできるようになりました。

    ```bash
    pip install -r requirements.txt -t ./package \
      --platform manylinux2014_x86_64 \
      --only-binary=:all: \
      --implementation cp
    ```
    *   `--platform manylinux2014_x86_64`: ターゲットプラットフォームをAWS LambdaのLinux環境に指定。
    *   `--only-binary=:all:`: ソースコンパイルの代わりに、事前にビルドされたバイナリパッケージを優先的に使用するよう強制。
    *   `--implementation cp`: CPythonインタープリタ用のパッケージを指定。

#### 問題2: AWS Lambdaの非同期ハンドラ処理エラー (MarshalError)

`python-telegram-bot`ライブラリの非同期(asyncio)機能を活用するため、Lambdaハンドラを`async def`で宣言しましたが、再び`502 Bad Gateway`エラーが発生しました。

*   **原因分析**:
    CloudWatchログで`Runtime.MarshalError: Object of type coroutine is not JSON serializable`メッセージを確認しました。これは、AWS Lambdaの標準Pythonランタイムブートストラップが`async def`で定義されたハンドラ関数を直接`await`しないために発生した問題です。ランタイムはハンドラを通常の同期関数のように呼び出し、その結果として返された「コルーチン(coroutine)オブジェクト」をJSONにシリアル化しようとして失敗したのです。

*   **解決策**:
    Lambdaが理解できる標準の同期関数（`def`）内で`asyncio.run()`を呼び出し、非同期ロジックを実行するラッパー(Wrapper)パターンを適用しました。

    ```python
    import asyncio

    # 実際の非同期ロジックを含むメイン関数
    async def main(event, context):
        # ... すべての非同期ロジック ...
        pass

    # Lambdaランタイムが呼び出す同期ハンドラ
    def lambda_handler(event, context):
        # 同期コンテキストで非同期イベントループを実行
        return asyncio.run(main(event, context))
    ```

#### 問題3: Telegramウェブフックのタイムアウトによる再試行ループ

AIブログ生成および多言語翻訳機能の実行時間が50秒以上かかったため、Lambda関数は正常に成功したにもかかわらず、1分間隔でTelegramサーバーから同じウェブフックリクエストが繰り返し受信される現象が発生しました。

*   **原因分析**:
    Telegramウェブフックのメカニズムは、リクエスト送信後、約30〜40秒のタイムアウトを持ちます。Lambda関数の全体の実行時間がこのタイムアウトを超過したため、Telegramサーバーは応答を受け取れなかったとみなし、リクエストが失敗したと判断して再試行を送ったのが原因でした。

*   **解決策**:
    実行時間短縮のため、相互依存性のない英語翻訳と日本語翻訳の作業を、順次処理から並列処理に変更しました。`asyncio.gather()`を使用して、2つの翻訳API呼び出しを同時に実行するようにコードを最適化しました。

    ```python
    # 修正前: 順次処理
    # english_translation = await translate_text(content, 'en')
    # japanese_translation = await translate_text(content, 'ja')

    # 修正後: 並列処理
    translation_tasks = [
        translate_text(content, 'en'),
        translate_text(content, 'ja')
    ]
    results = await asyncio.gather(*translation_tasks)
    ```
    この最適化により、全体の実行時間を20秒以内に短縮し、Telegramウェブフックのタイムアウト問題を根本的に解決しました。

### 3. 成果と結論

今回のサーバーレス移行により、以下の成果を達成しました。
1.  **コスト削減**: AWS永久無料プランを活用し、常時サーバー運用コストを月額0円に削減しました。
2.  **運用負担の排除 (Zero-Ops)**: サーバーインフラの管理、パッチ適用、モニタリングなどの運用負担がなくなり、アプリケーションロジックの開発にのみ集中できるようになりました。
3.  **技術力の確保**: クロスプラットフォームサーバーレスパッケージング、Lambda環境での非同期プログラミング、外部サービス(Webhook)連携時のタイムアウト最適化など、実務的なトラブルシューティング経験を確保しました。

---
*投稿日時: 2026-08-21 16:37:13*
