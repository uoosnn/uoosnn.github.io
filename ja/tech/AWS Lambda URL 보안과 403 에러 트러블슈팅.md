---
title: "AWS Lambda Function URL再生成後に発生した403 Forbiddenエラーの分析"
description: "AWS Lambda Function URLをセキュリティ上の理由で削除し再生成した際、AWSコンソールのキャッシュバグによりリソースベースポリシーが欠落し、403 Forbiddenエラーが発生する事象を分析します。ブラウザの再読み込みによる解決策と、コードレベルでの検証ロジック追加プロセスについて解説します。"
date: 2026-11-18
tags: [AWS, Troubleshooting, Security, Serverless, Lambda]
---

# AWS Lambda Function URL再生成後に発生した403 Forbiddenエラーの分析

::: tip 1行要約
Lambda Function URL再生成後に`{"Message":"Forbidden"}`エラーが発生した場合、AWSコンソールのキャッシュバグによるリソースベースポリシーの欠落が原因である可能性があります。ブラウザを再読み込みしてからURLを再生成してください。
:::

## インシデント概要

`setup_aws.md`ドキュメントに`AuthType: NONE`で設定されたTelegramウェブフック用のLambda Function URLがコミットされ、外部に公開されてしまいました。URLが公開されると、誰でもcurlなどのツールを使って任意のPOSTリクエストを送信し、GitHubブログのコンテンツを操作したり、接続されているGemini APIのクォータを使い果たしたりするセキュリティリスクが存在しました。

Git履歴の書き換えではなく、既存のFunction URLを即座に削除・再発行し、コードレベルで送信元`CHAT_ID`を検証する防御ロジックを追加する方向で対応を決定しました。

## 原因分析: 403 Forbiddenおよび無応答の事象

既存のFunction URLを削除し、AWSコンソールで同様に`AuthType: NONE`で新しいURLを生成した後、Telegramの`setWebhook` API呼び出しまで成功裏に完了しました。しかし、その後Telegramボットの`/info`コマンドに応答がなく、AWS CloudWatchのモニタリング上でも関数呼び出し(Invocations)数が0件であることが確認されました。

再生成されたURLに直接アクセスすると、以下の403エラーメッセージが返されました。

```json
{"Message":"Forbidden"}
```

問題の原因は、AWSコンソールのキャッシュ動作に関連するバグでした。コンソールでFunction URLを削除した直後、ブラウザを再読み込み(F5)せずにすぐに「URLを作成」ボタンをクリックすると、以下のような事象が発生します。

1.  UIには「関数URLに対するパブリックアクセス権限を付与するポリシーが存在します」といったキャッシュされた状態メッセージが表示されます。
2.  しかし実際には、パブリック呼び出しに必要なリソースベースポリシーの生成がスキップされます。
3.  結果として、関数のリソースベースポリシーJSONから`lambda:InvokeFunctionUrl`権限を持つパブリックアクセス(`Principal: "*"`)の記述が欠落し、すべての外部呼び出しがAWSインフラのフロントエンドでブロックされます。

正常なポリシーには、EventBridgeなどの他のサービスに加えて、以下のようなパブリック呼び出し権限が含まれている必要があります。

```json
{
  "Sid": "FunctionURLAllowPublicAccess",
  "Effect": "Allow",
  "Principal": "*",
  "Action": "lambda:InvokeFunctionUrl",
  "Resource": "arn:aws:lambda:ap-northeast-2:...",
  "Condition": {
    "StringEquals": {
      "lambda:FunctionUrlAuthType": "NONE"
    }
  }
}
```

## 復旧手順とコードによる防御

### 1. Function URLポリシーの復旧

以下の手順で問題を解決しました。

1.  問題が発生したLambda Function URLを再度削除します。
2.  ブラウザを再読み込み(F5)して、AWSコンソールのキャッシュを完全に初期化します。
3.  再び関数設定(Configuration)タブで`AuthType: NONE`としてFunction URLを生成します。
4.  生成後、「アクセス権限(Permissions)」タブでリソースベースポリシーが正常に追加されていることを確認します。
5.  新しく発行されたURLでTelegramの`setWebhook`を再登録し、サービスを正常化しました。

### 2. コードレベルでの送信元検証の追加

URL公開に備えた追加の防御策として、`lambda_function.py`のエントリポイント最上部に`is_authorized_update()`関数を追加しました。この関数は、ウェブフックペイロードの`message.chat.id`または`from.id`が環境変数`TELEGRAM_CHAT_ID`と一致するかを検査します。許可されていないIDからのリクエストがあった場合、DynamoDBやAI APIを呼び出す前に即座にリクエストを破棄し、以下の応答を返します。

```python
# is_authorized_update() 関数ロジック例
def is_authorized_update(update, context):
    # ... chat_id, from_id 抽出ロジック ...
    if str(chat_id) != os.environ.get('TELEGRAM_CHAT_ID'):
        return False
    return True

# メインハンドラー
def lambda_handler(event, context):
    if not is_authorized_update(update, context):
        return {"ok": True, "unauthorized_dropped": True}
    # ... 既存ロジックを実行 ...
```

### 3. PowerShellを用いたスプーフィングテスト

防御ロジックの正常動作を検証するため、PowerShellの`Invoke-RestMethod`を使用して、許可されていない`chat_id` (例: `9999999`)でスプーフィングされたリクエストを送信しました。

*注: Windows PowerShellの`curl.exe`は、ネストされたJSON内の引用符処理で「Unterminated string」エラーを引き起こす可能性があるため、`Invoke-RestMethod`の使用が推奨されます。*

```powershell
Invoke-RestMethod -Method Post -Uri "https://<NEW_URL>.lambda-url.ap-northeast-2.on.aws/" -ContentType "application/json" -Body '{"update_id":1,"message":{"date":9999999999,"chat":{"id":9999999},"text":"/post test"}}'
```

テストの結果、Lambda関数は`{"ok": true, "unauthorized_dropped": true}`を返し、意図した通りにブロック動作を実行することを確認しました。

## 重要なチェックポイント (Gotchas)

*   **AWSコンソールのキャッシュ**: Lambda Function URLのように、リソースとポリシーが一緒に作成/削除されるAWSサービスをコンソールで操作する際、削除直後に再読み込みせずにすぐに再生成すると、関連ポリシーが欠落する可能性があります。重要な変更作業の後には、常にブラウザを再読み込みすることが安全です。
*   **Public URLのセキュリティ**: `AuthType: NONE`で設定されたFunction URLは、それ自体が認証の役割を果たすため、URLが公開された場合は即座に破棄し、再発行する必要があります。また、ペイロードの特定の値(例: `chat.id`)や`X-Telegram-Bot-Api-Secret-Token`のようなカスタムヘッダーを検証するコードレベルの防御ロジックを必ず実装すべきです。
*   **PowerShellでのJSON送信**: PowerShell環境で複雑なJSONデータをAPI Bodyとして送信する場合、`curl.exe`の文字列解析問題を避けるため、`Invoke-RestMethod`や`Invoke-WebRequest`コマンドレットの使用を推奨します。

*投稿日時: 2026-11-18 00:00:00*
