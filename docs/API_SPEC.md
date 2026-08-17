# API仕様

すべてLambda Function URLへ `POST` し、`Content-Type: application/json` を使用します。ルートは1つで、JSONの `action` により処理を切り替えます。

## `generate_quiz`

```json
{
  "action": "generate_quiz",
  "title": "生成AI入門",
  "lecture_text": "講義本文",
  "num_questions": 3
}
```

成功時: `quiz_id`, `title`, `created_at`, `questions`。

## `upload_pdf_and_generate_quiz`

```json
{
  "action": "upload_pdf_and_generate_quiz",
  "title": "PDF Lecture",
  "filename": "lecture.pdf",
  "pdf_base64": "...",
  "num_questions": 3,
  "max_chars": 8000
}
```

成功時はクイズ情報に加えて `source_pdf_s3_key`, `extracted_text_chars` を返します。

## `generate_quiz_from_pdf`

```json
{
  "action": "generate_quiz_from_pdf",
  "title": "PDF Lecture",
  "s3_key": "pdfs/example.pdf",
  "num_questions": 3,
  "max_chars": 12000
}
```

既存S3オブジェクトを利用します。外部入力の任意S3キーをそのまま許可しないよう、統合版ではprefixまたは所有者を検証してください。

## `get_quiz`

```json
{
  "action": "get_quiz",
  "quiz_id": "quiz_xxxxxxxxxxxx"
}
```

学生向けレスポンスからは `correct_answer` と `explanation` が除外されます。

## `submit_answer`

```json
{
  "action": "submit_answer",
  "quiz_id": "quiz_xxxxxxxxxxxx",
  "student_id": "student_001",
  "student_name": "Student",
  "answers": {
    "q1": 0,
    "q2": 2,
    "q3": 1
  }
}
```

成功時: `score`, `max_score`, 問題別の正誤・正解・解説。

## `get_results`

```json
{
  "action": "get_results",
  "quiz_id": "quiz_xxxxxxxxxxxx"
}
```

成功時: 提出人数、平均点、問題別正答率、学生別得点、Bedrockによる講義改善分析。

## エラー

HTTP 400/404/500で、原則として次の形式を返します。

```json
{
  "error": "message"
}
```

現行コードは例外詳細をクライアントへ返すため、公開版では内部例外をログだけに残し、利用者には一般化したエラーを返すことを推奨します。

