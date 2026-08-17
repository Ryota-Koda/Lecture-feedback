# Contributing

このリポジトリをチームで安全に変更するための最小ルールです。

## 変更先の選び方

| 変更内容 | 編集先 | デプロイ先 |
| --- | --- | --- |
| 表示、入力欄、ボタン、ブラウザ側処理 | `frontend/` | Amplifyが自動デプロイ |
| クイズ生成、PDF処理、採点、集計 | `backend/` | Lambdaへ別途デプロイ |
| S3、DynamoDB、IAM、Function URL | `infra/template.yaml` | SAM / CloudFormation |
| APIの入出力 | `docs/API_SPEC.md` | 文書。実装変更時は同時更新 |

## 推奨ワークフロー

```bash
git switch main
git pull
git switch -c feature/short-description
```

変更とテストが終わったら、作業ブランチをpushしてPull Requestを作成します。

```bash
git add .
git commit -m "Add short description"
git push -u origin feature/short-description
```

`main`への直接pushは避け、Pull Requestで変更内容を確認してください。

## Pull Requestの確認項目

- [ ] 変更の目的が説明されている
- [ ] `python3 -m unittest discover -s tests -v`が成功する
- [ ] API変更時に`docs/API_SPEC.md`も更新した
- [ ] Access key、Secret key、個人情報を追加していない
- [ ] 大きなPDF、Base64データ、生成済みレスポンスを追加していない
- [ ] フロント変更時にAmplifyのプレビューまたは公開画面を確認した
- [ ] バックエンド変更時にLambdaの反映方法を記載した

## サンプルデータ

Gitへ保存するサンプルは、小さく、架空のデータだけにしてください。PDF本体やBase64化したPDFはコミットせず、各自のローカル環境または許可されたS3オブジェクトを使用します。

## バックエンド変更時の注意

フロントエンドは`docs/API_SPEC.md`の形式に依存しています。既存フィールドの削除・名称変更を行う場合は、影響するフロントエンドとテストを同じPull Requestで更新してください。
