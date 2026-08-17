# Amplify Hostingへのデプロイ

## 前提

Amplify Hostingは静的フロントエンドを配信します。クイズ生成処理は既存Lambdaまたは `infra/template.yaml` で作成したバックエンドを利用します。

## GitHub連携（推奨）

1. このリポジトリをGitHubへpushする。
2. AWS Amplifyの「新しいアプリを作成」でGitHubを選ぶ。
3. AWS Amplify GitHub Appへ、このリポジトリだけのアクセスを許可する。
4. リポジトリと`main`ブランチを選ぶ。
5. リポジトリ直下の`amplify.yml`が検出されたことを確認する。
6. 「保存してデプロイ」を実行する。
7. 発行された`https://...amplifyapp.com`のOriginをLambda Function URLのCORSへ追加する。

`amplify.yml`は`frontend/`の全ファイルを`dist/`へコピーします。CSS、JavaScript、画像を追加した場合も同じフォルダ内であればデプロイ対象になります。

`main`へのpushまたはPull Requestのマージ後にAmplifyの新しいビルドが開始されます。

## 手動デプロイ

GitHubを使用しない場合は、`frontend/`の**中身**をZIP化します。ZIP直下に`index.html`が必要です。

```text
frontend.zip
├─ index.html
├─ teacher.html
├─ student.html
├─ css/
│  └─ style.css
└─ js/
   ├─ config.js
   ├─ api.js
   ├─ teacher.js
   └─ student.js
```

このZIPをAmplifyの「Gitを使用せずにデプロイ」からアップロードします。リポジトリ全体のZIPはアップロードしません。

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

1. 入口画面から教員用・学生用の両方を開ける。
2. 教員用画面でテキストから3問生成できる。
3. 小さいテキストPDFから3問生成できる。
4. 生成後に学生用URLをコピーできる。
5. 学生用URLを開くと、対象の小テストが自動的に読み込まれる。
6. 回答を送信し、個人の採点結果と解説が表示される。
7. 教員用画面で回答結果と分析を取得できる。
8. ブラウザの開発者ツールにCORSエラーがない。
9. CloudWatch Logsに500エラーがない。

## 更新対象の違い

| 変更 | 反映方法 |
| --- | --- |
| `frontend/` | GitHubの`main`へ反映するとAmplifyが自動デプロイ |
| `backend/` | Lambdaへ別途デプロイ |
| `infra/template.yaml` | SAM / CloudFormationで反映 |
| `docs/`、`samples/`、`tests/` | Webアプリの挙動には直接影響しない |

## 公開範囲

認証なしFunction URLを利用する間は、短期のチーム内MVPとして扱ってください。Amplifyページの公開制限だけではAPI自体の認証にはなりません。
