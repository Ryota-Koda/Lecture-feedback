# Amplify Hostingへのデプロイ

## 前提

Amplify Hostingは静的フロントエンドを配信します。クイズ生成処理は既存Lambdaまたは `infra/template.yaml` で作成したバックエンドを利用します。

## 手動デプロイ（最短）

1. `lecture-feedback-amplify-frontend.zip` を用意する。
2. AWS Amplifyの「すべてのアプリ」から「新しいアプリを作成」を選ぶ。
3. 「Gitを使用せずにデプロイ」を選ぶ。
4. ZIPをアップロードし、デプロイする。
5. 発行された `https://...amplifyapp.com` のOriginを控える。
6. Lambda Function URLのCORSを、そのOriginへ更新する。

ZIP直下に `index.html` が必要です。本配布物の手動デプロイZIPはこの形式です。

## Git連携

このフォルダをGitHubへ登録し、Amplifyからリポジトリとブランチを接続します。`amplify.yml` が `frontend/index.html` を `dist/index.html` へコピーします。

## Lambda Function URLのCORS確認

```bash
aws lambda get-function-url-config \
  --function-name FUNCTION_NAME \
  --region ap-northeast-1
```

Amplifyドメイン発行後の更新例:

```bash
aws lambda update-function-url-config \
  --function-name FUNCTION_NAME \
  --region ap-northeast-1 \
  --cors '{"AllowOrigins":["https://BRANCH.APP_ID.amplifyapp.com"],"AllowMethods":["POST"],"AllowHeaders":["content-type"],"MaxAge":600}'
```

`FUNCTION_NAME` とOriginは実値へ置き換えます。Access keyやsecret keyをHTMLへ記載しないでください。

## デプロイ後確認

1. テキストから3問生成できる。
2. 小さいテキストPDFから3問生成できる。
3. `quiz_id` で学生用問題を取得できる。
4. 回答を送信し、採点結果が返る。
5. 結果分析が取得できる。
6. ブラウザの開発者ツールにCORSエラーがない。
7. CloudWatch Logsに500エラーがない。

## 公開範囲

認証なしFunction URLを利用する間は、短期のチーム内MVPとして扱ってください。Amplifyページの公開制限だけではAPI自体の認証にはなりません。

