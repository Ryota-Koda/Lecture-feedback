# セキュリティ・運用レビュー

## 公開前に対応する項目

### 1. 認証なしFunction URL

現行HTMLは認証なしFunction URLを直接呼び出します。URLを知る第三者がBedrock呼び出しを繰り返すと、課金・リソース消費につながります。

推奨:

- 本番ではCognito + API Gateway、または `AWS_IAM` 認証を利用する。
- MVP期間は公開範囲を限定し、AWS Budgets、CloudWatch Alarm、Lambda reserved concurrencyを設定する。
- デモ終了後はFunction URLを無効化するか認証方式を変更する。

### 2. CORS

CORSはブラウザからのアクセス元を制御しますが、認証ではありません。Amplify公開時は実際のAmplify Originだけを許可し、ローカル開発が必要な期間だけ`http://localhost:PORT`を追加してください。

新しいAmplifyアプリやブランチを追加するとOriginが変わるため、Function URLのCORS設定も確認します。

### 3. 学生情報

`get_results` は学生ID、名前、点数を返します。教員権限のみに制限し、不要な氏名保存を避け、保存期間を決めてください。

### 4. 任意S3キー

`generate_quiz_from_pdf` は入力された `s3_key` を直接利用します。統合版では、許可prefix、所有者、document IDを検証してください。

### 5. ファイル検証

- 拡張子だけでなくPDFマジックバイトを確認する。
- ページ数・展開後サイズ・処理時間を制限する。
- Base64送信ではHTTPリクエストサイズが増えるため、大きいPDFはpresigned uploadを使う。

### 6. エラー情報

現行コードは `str(e)` と例外型をクライアントへ返します。公開版では詳細をCloudWatchへ記録し、クライアントには一般化したエラーコードを返してください。

### 7. 入力制限と費用

- テキスト長、問題数、呼び出し頻度をサーバー側で制限する。
- `get_results` のAI分析は提出内容が変わった場合だけ再計算し、結果をキャッシュする。
- Bedrock usageとLambda durationにアラームを設定する。

### 8. GitHub

- Access key、Secret key、個人情報、実在学生の回答をコミットしない。
- PDF本体やBase64化したPDFをサンプルとしてコミットしない。
- 認証を導入するまでは、リポジトリと公開URLの共有範囲を限定する。
- Function URL自体はブラウザから確認できるため、URLを隠すことを認証対策と考えない。
