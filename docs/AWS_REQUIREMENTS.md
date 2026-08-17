# AWS構成と必要情報

## 必須リソース

### Lambda

- ハンドラー: `lambda_function.handler`
- 推奨ランタイム: Python 3.13（提供パッケージがPython 3.13で作成されているため）
- 依存関係: `pypdf==6.14.2`
- 推奨開始値: メモリ 1,024 MiB、タイムアウト 120秒
- リージョン: 現行コードの既定値は `ap-northeast-1`

### Lambda環境変数

| 変数 | 内容 |
| --- | --- |
| `QUIZ_TABLE` | クイズ用DynamoDBテーブル名 |
| `SUBMISSION_TABLE` | 回答用DynamoDBテーブル名 |
| `PDF_BUCKET` | PDF・抽出テキスト保存用S3バケット名 |
| `BEDROCK_PROFILE_ID` | Bedrock inference profile IDまたはARN |

秘密値をソースコードやフロントエンドへ直接記載しないでください。

### DynamoDB

クイズテーブル:

- パーティションキー: `quiz_id` (String)
- 読み書き: `GetItem`, `PutItem`, `UpdateItem`

回答テーブル:

- パーティションキー: `quiz_id` (String)
- ソートキー: `student_id` (String)
- 読み書き: `PutItem`, `Query`

オンデマンド課金と保管時暗号化を推奨します。

### S3

利用プレフィックス:

- `pdfs/browser-upload/`
- `lecture_texts/`

必要操作:

- `s3:GetObject`
- `s3:PutObject`

パブリックアクセスブロックとサーバー側暗号化を有効にします。保存期間は授業・研究データの方針に合わせて決めてください。

### Bedrock

必要操作は `bedrock:InvokeModel` です。Cross-Region inference profileを利用する場合は、profile本体だけでなく、ルーティング先のfoundation modelに対する許可が必要になる場合があります。

## 現行AWS環境から取得して共有すべき設定

次の値・設定は現行ディレクトリに含まれていません。

1. Lambda関数名、ランタイム、メモリ、タイムアウト、ハンドラー
2. Function URLの `AuthType` とCORS設定
3. DynamoDB 2テーブルのキー定義と課金モード
4. S3の暗号化、CORS、ライフサイクル
5. Lambda実行ロールのIAMポリシー
6. Bedrock profileの種類・対応リージョン
7. CloudWatchログの保持期間

これらは値を文書へ直書きするのではなく、CloudFormation/SAM/Amplifyの構成コードとして管理するのが望ましいです。

## 推奨IAM権限

- CloudWatch Logsへの書き込み
- 対象S3バケットだけへの `GetObject` / `PutObject`
- 対象DynamoDBテーブルだけへの必要操作
- 対象Bedrock model/profileだけへの `InvokeModel`

`Resource: "*"` は初期検証には便利ですが、チーム共有版・本番版では対象ARNへ絞ってください。

