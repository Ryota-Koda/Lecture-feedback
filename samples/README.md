# Samples

`events/`にはLambdaコンソールやHTTPクライアントで使用する小さいJSON例だけを置きます。

## 使い方

1. `event_generate.json`でクイズを生成する。
2. 返された`quiz_id`を、取得・回答・結果用イベントの`quiz_REPLACE_ME`へ設定する。
3. PDFをS3から処理する場合は、`event_generate_pdf.json`の`s3_key`を実在する許可済みキーへ変更する。

## コミットしないもの

- PDFをBase64化した巨大なJSON
- 実在する学生の氏名、ID、回答
- Bedrockが生成した一時的なレスポンス一式
- 再配布条件を確認していないPDF

レスポンス形式は[`docs/API_SPEC.md`](../docs/API_SPEC.md)を正とします。実行結果を固定ファイルとして保存すると実装とずれやすいため、原則としてコミットしません。
