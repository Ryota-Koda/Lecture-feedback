# Lecture Feedback / Quiz Generator

講義テキストまたはPDFから4択クイズを生成し、学生の回答を採点・集計して、講義改善のための分析を生成するMVPです。

## 現在の構成

- フロントエンド: 単一の静的HTML (`frontend/index.html`)
- API: AWS Lambda Function URL
- 実行処理: Python Lambda (`backend/lambda_function.py`)
- 生成AI: Amazon Bedrock Converse API
- PDFテキスト抽出: `pypdf==6.14.2`（OCRではありません）
- 保存先: Amazon S3、Amazon DynamoDB（クイズ用・回答用の2テーブル）
## ディレクトリ


frontend/               Amplify Hostingに配置する画面
backend/                LambdaコードとPython依存関係
infra/template.yaml     新規環境を再現するためのAWS SAMテンプレート
docs/                   解析結果、AWS要件、API仕様、統合・デプロイ手順
samples/events/         Lambdaテストイベント
samples/responses/      期待されるレスポンス例
tests/                  AWSを呼ばないローカル単体テスト
amplify.yml             Git連携でAmplify Hostingする場合のビルド設定

