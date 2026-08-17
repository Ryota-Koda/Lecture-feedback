"""Lecture feedback MVP Lambda handler.

The Lambda exposes one Function URL and dispatches requests by the JSON
``action`` field. AWS resource names and the Bedrock profile are supplied via
environment variables; this module does not create infrastructure.
"""

import base64
import json
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO

import boto3
from boto3.dynamodb.conditions import Key
from pypdf import PdfReader


REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
QUIZ_TABLE = os.environ["QUIZ_TABLE"]
SUBMISSION_TABLE = os.environ["SUBMISSION_TABLE"]
PDF_BUCKET = os.environ["PDF_BUCKET"]
BEDROCK_PROFILE_ID = os.environ["BEDROCK_PROFILE_ID"]

dynamodb = boto3.resource("dynamodb", region_name=REGION)
quiz_table = dynamodb.Table(QUIZ_TABLE)
submission_table = dynamodb.Table(SUBMISSION_TABLE)
s3 = boto3.client("s3", region_name=REGION)
bedrock = boto3.client("bedrock-runtime", region_name=REGION)


# HTTP and JSON helpers


def json_default(obj):
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    raise TypeError


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(body, ensure_ascii=False, default=json_default),
    }


def parse_event(event):
    if isinstance(event, dict) and "body" in event:
        body = event["body"]
        if body is None:
            return {}
        if isinstance(body, str):
            return json.loads(body)
        return body
    return event


def extract_json(text):
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON object was not found in Bedrock output.")

    return json.loads(text[start:end + 1])


def validate_quiz(quiz):
    if "title" not in quiz:
        quiz["title"] = "Generated Quiz"

    if "questions" not in quiz or not isinstance(quiz["questions"], list):
        raise ValueError("questions must be a list.")

    validated_questions = []

    for i, q in enumerate(quiz["questions"], start=1):
        question_id = q.get("question_id") or f"q{i}"
        question = q.get("question")
        choices = q.get("choices")
        correct_answer = q.get("correct_answer")
        explanation = q.get("explanation", "")

        if not question or not isinstance(question, str):
            raise ValueError(f"{question_id}: question is missing.")

        if not isinstance(choices, list) or len(choices) != 4:
            raise ValueError(f"{question_id}: choices must have exactly 4 items.")

        try:
            correct_answer = int(correct_answer)
        except Exception:
            raise ValueError(f"{question_id}: correct_answer must be an integer.")

        if correct_answer < 0 or correct_answer > 3:
            raise ValueError(f"{question_id}: correct_answer must be 0, 1, 2, or 3.")

        validated_questions.append({
            "question_id": question_id,
            "question": question,
            "choices": [str(c) for c in choices],
            "correct_answer": correct_answer,
            "explanation": str(explanation),
        })

    quiz["questions"] = validated_questions
    return quiz


# Bedrock calls


def call_bedrock_for_quiz(title, lecture_text, num_questions):
    prompt = f"""
あなたは大学講義の小テストを作成する教育支援AIです。

以下の講義内容に基づいて、4択問題を{num_questions}問作成してください。

条件:
- 日本語で作成する
- 各問題の選択肢は必ず4つ
- correct_answer は正解選択肢の番号を 0, 1, 2, 3 の整数で表す
- explanation には、正解の理由を簡潔に書く
- 出力はJSONのみ
- Markdownのコードブロックは使わない

JSON形式:
{{
  "title": "string",
  "questions": [
    {{
      "question_id": "q1",
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "correct_answer": 0,
      "explanation": "string"
    }}
  ]
}}

講義タイトル:
{title}

講義内容:
{lecture_text}
""".strip()

    res = bedrock.converse(
        modelId=BEDROCK_PROFILE_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": 2500,
            "temperature": 0.2,
        },
    )

    text = res["output"]["message"]["content"][0]["text"]
    quiz = extract_json(text)
    return validate_quiz(quiz)


def call_bedrock_for_analysis(title, questions, question_stats, average_score, num_submissions):
    prompt = f"""
あなたは大学講義の改善を支援する教育分析AIです。

以下の小テスト結果から、学生が理解できていない可能性がある点と、次回講義で改善すべき点を日本語で簡潔に分析してください。

講義タイトル:
{title}

提出人数:
{num_submissions}

平均点:
{average_score}

問題ごとの統計:
{json.dumps(question_stats, ensure_ascii=False, default=json_default)}

問題一覧:
{json.dumps(questions, ensure_ascii=False, default=json_default)}

出力形式:
- 全体傾向
- 理解が弱そうな内容
- 次回講義で補足すべき内容
""".strip()

    res = bedrock.converse(
        modelId=BEDROCK_PROFILE_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": 1200,
            "temperature": 0.2,
        },
    )

    return res["output"]["message"]["content"][0]["text"]


# PDF ingestion


def extract_text_from_pdf_bytes(pdf_bytes):
    reader = PdfReader(BytesIO(pdf_bytes))
    texts = []

    for i, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        page_text = page_text.strip()
        if page_text:
            texts.append(f"[page {i}]\n{page_text}")

    return "\n\n".join(texts).strip()


def generate_quiz_from_pdf(payload):
    title = payload.get("title", "Untitled Lecture")
    s3_key = payload.get("s3_key")
    num_questions = int(payload.get("num_questions", 3))

    if not s3_key:
        return response(400, {"error": "s3_key is required."})

    obj = s3.get_object(Bucket=PDF_BUCKET, Key=s3_key)
    pdf_bytes = obj["Body"].read()

    lecture_text = extract_text_from_pdf_bytes(pdf_bytes)

    if not lecture_text:
        return response(400, {
            "error": "Could not extract text from PDF.",
            "hint": "This may be a scanned or image-only PDF. OCR is not included in this MVP."
        })

    max_chars = int(payload.get("max_chars", 12000))
    lecture_text_for_quiz = lecture_text[:max_chars]

    new_payload = dict(payload)
    new_payload["title"] = title
    new_payload["lecture_text"] = lecture_text_for_quiz
    new_payload["num_questions"] = num_questions

    result = generate_quiz(new_payload)
    body = json.loads(result["body"])

    if result["statusCode"] == 200:
        quiz_id = body["quiz_id"]

        quiz_table.update_item(
            Key={"quiz_id": quiz_id},
            UpdateExpression="SET source_pdf_s3_key = :s3_key, extracted_text_chars = :chars",
            ExpressionAttributeValues={
                ":s3_key": s3_key,
                ":chars": len(lecture_text)
            }
        )

        body["source_pdf_s3_key"] = s3_key
        body["extracted_text_chars"] = len(lecture_text)
        result["body"] = json.dumps(body, ensure_ascii=False, default=json_default)

    return result


def sanitize_filename(filename):
    filename = filename or "upload.pdf"
    filename = filename.split("/")[-1].split("\\")[-1]
    filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    return filename


def upload_pdf_and_generate_quiz(payload):
    title = payload.get("title", "Untitled Lecture")
    filename = sanitize_filename(payload.get("filename", "upload.pdf"))
    pdf_base64 = payload.get("pdf_base64")
    num_questions = int(payload.get("num_questions", 3))
    max_chars = int(payload.get("max_chars", 12000))

    if not pdf_base64:
        return response(400, {"error": "pdf_base64 is required."})

    # data:application/pdf;base64,... の形式でも受け取れるようにする
    if "," in pdf_base64:
        pdf_base64 = pdf_base64.split(",", 1)[1]

    try:
        pdf_bytes = base64.b64decode(pdf_base64)
    except Exception as e:
        return response(400, {
            "error": "Invalid base64 PDF data.",
            "detail": str(e)
        })

    if len(pdf_bytes) == 0:
        return response(400, {"error": "Uploaded PDF is empty."})

    # デモ用途の簡易制限。大きすぎるPDFは別方式にする
    max_pdf_bytes = 5 * 1024 * 1024
    if len(pdf_bytes) > max_pdf_bytes:
        return response(400, {
            "error": "PDF is too large for this demo upload method.",
            "pdf_size_bytes": len(pdf_bytes),
            "max_size_bytes": max_pdf_bytes,
            "hint": "Use a smaller PDF, or use an S3 presigned upload URL in the production version."
        })

    upload_id = uuid.uuid4().hex[:12]
    s3_key = f"pdfs/browser-upload/{upload_id}-{filename}"

    s3.put_object(
        Bucket=PDF_BUCKET,
        Key=s3_key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )

    new_payload = {
        "title": title,
        "s3_key": s3_key,
        "num_questions": num_questions,
        "max_chars": max_chars,
    }

    return generate_quiz_from_pdf(new_payload)


# Quiz lifecycle


def generate_quiz(payload):
    title = payload.get("title", "Untitled Lecture")
    lecture_text = payload.get("lecture_text", "")
    num_questions = int(payload.get("num_questions", 3))

    if not lecture_text.strip():
        return response(400, {"error": "lecture_text is required."})

    if num_questions < 1 or num_questions > 10:
        return response(400, {"error": "num_questions must be between 1 and 10."})

    quiz_id = "quiz_" + uuid.uuid4().hex[:12]
    created_at = datetime.now(timezone.utc).isoformat()

    quiz = call_bedrock_for_quiz(title, lecture_text, num_questions)

    source_text_key = f"lecture_texts/{quiz_id}.txt"
    s3.put_object(
        Bucket=PDF_BUCKET,
        Key=source_text_key,
        Body=lecture_text.encode("utf-8"),
        ContentType="text/plain; charset=utf-8",
    )

    item = {
        "quiz_id": quiz_id,
        "title": quiz.get("title", title),
        "created_at": created_at,
        "source_text_s3_key": source_text_key,
        "questions": quiz["questions"],
    }

    quiz_table.put_item(Item=item)

    return response(200, {
        "quiz_id": quiz_id,
        "title": item["title"],
        "created_at": created_at,
        "questions": item["questions"],
    })


def get_quiz(payload):
    quiz_id = payload.get("quiz_id")
    if not quiz_id:
        return response(400, {"error": "quiz_id is required."})

    res = quiz_table.get_item(Key={"quiz_id": quiz_id})
    item = res.get("Item")

    if not item:
        return response(404, {"error": "quiz not found."})

    student_questions = []
    for q in item["questions"]:
        student_questions.append({
            "question_id": q["question_id"],
            "question": q["question"],
            "choices": q["choices"],
        })

    return response(200, {
        "quiz_id": item["quiz_id"],
        "title": item["title"],
        "questions": student_questions,
    })


def submit_answer(payload):
    quiz_id = payload.get("quiz_id")
    student_id = payload.get("student_id")
    student_name = payload.get("student_name", "")
    answers = payload.get("answers", {})

    if not quiz_id:
        return response(400, {"error": "quiz_id is required."})
    if not student_id:
        return response(400, {"error": "student_id is required."})
    if not isinstance(answers, dict):
        return response(400, {"error": "answers must be an object."})

    res = quiz_table.get_item(Key={"quiz_id": quiz_id})
    quiz = res.get("Item")

    if not quiz:
        return response(404, {"error": "quiz not found."})

    score = 0
    details = []

    for q in quiz["questions"]:
        qid = q["question_id"]
        correct = int(q["correct_answer"])
        selected = answers.get(qid)

        try:
            selected_int = int(selected)
        except Exception:
            selected_int = None

        is_correct = selected_int == correct
        if is_correct:
            score += 1

        details.append({
            "question_id": qid,
            "selected_answer": selected_int,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })

    max_score = len(quiz["questions"])
    submitted_at = datetime.now(timezone.utc).isoformat()

    submission_table.put_item(Item={
        "quiz_id": quiz_id,
        "student_id": student_id,
        "student_name": student_name,
        "answers": answers,
        "score": score,
        "max_score": max_score,
        "details": details,
        "submitted_at": submitted_at,
    })

    return response(200, {
        "quiz_id": quiz_id,
        "student_id": student_id,
        "score": score,
        "max_score": max_score,
        "details": details,
    })


def get_results(payload):
    quiz_id = payload.get("quiz_id")
    if not quiz_id:
        return response(400, {"error": "quiz_id is required."})

    quiz_res = quiz_table.get_item(Key={"quiz_id": quiz_id})
    quiz = quiz_res.get("Item")

    if not quiz:
        return response(404, {"error": "quiz not found."})

    sub_res = submission_table.query(
        KeyConditionExpression=Key("quiz_id").eq(quiz_id)
    )
    submissions = sub_res.get("Items", [])

    while "LastEvaluatedKey" in sub_res:
        sub_res = submission_table.query(
            KeyConditionExpression=Key("quiz_id").eq(quiz_id),
            ExclusiveStartKey=sub_res["LastEvaluatedKey"],
        )
        submissions.extend(sub_res.get("Items", []))

    num_submissions = len(submissions)
    max_score = len(quiz["questions"])

    if num_submissions == 0:
        return response(200, {
            "quiz_id": quiz_id,
            "title": quiz["title"],
            "num_submissions": 0,
            "average_score": 0,
            "question_stats": [],
            "analysis": "まだ提出がありません。",
        })

    total_score = sum(int(s.get("score", 0)) for s in submissions)
    average_score = total_score / num_submissions

    question_stats = []
    for q in quiz["questions"]:
        qid = q["question_id"]
        correct_count = 0

        for s in submissions:
            for d in s.get("details", []):
                if d.get("question_id") == qid and d.get("is_correct"):
                    correct_count += 1

        accuracy = correct_count / num_submissions

        question_stats.append({
            "question_id": qid,
            "question": q["question"],
            "correct_count": correct_count,
            "num_submissions": num_submissions,
            "accuracy": accuracy,
        })

    analysis = call_bedrock_for_analysis(
        quiz["title"],
        quiz["questions"],
        question_stats,
        average_score,
        num_submissions,
    )

    student_scores = []
    for s in submissions:
        student_scores.append({
            "student_id": s.get("student_id"),
            "student_name": s.get("student_name", ""),
            "score": int(s.get("score", 0)),
            "max_score": int(s.get("max_score", max_score)),
            "submitted_at": s.get("submitted_at"),
        })

    return response(200, {
        "quiz_id": quiz_id,
        "title": quiz["title"],
        "num_submissions": num_submissions,
        "average_score": average_score,
        "max_score": max_score,
        "question_stats": question_stats,
        "student_scores": student_scores,
        "analysis": analysis,
    })


# Lambda entry point


ACTION_HANDLERS = {
    "upload_pdf_and_generate_quiz": upload_pdf_and_generate_quiz,
    "generate_quiz_from_pdf": generate_quiz_from_pdf,
    "generate_quiz": generate_quiz,
    "get_quiz": get_quiz,
    "submit_answer": submit_answer,
    "get_results": get_results,
}


def handler(event, context):
    try:
        payload = parse_event(event)

        if payload.get("httpMethod") == "OPTIONS":
            return response(200, {"message": "ok"})

        action = payload.get("action")

        action_handler = ACTION_HANDLERS.get(action)
        if action_handler:
            return action_handler(payload)

        return response(400, {
            "error": "Unknown action.",
            "available_actions": list(ACTION_HANDLERS),
        })

    except Exception as e:
        return response(500, {
            "error": str(e),
            "type": type(e).__name__,
        })
