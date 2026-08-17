import importlib.util
import json
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


MODULE_PATH = Path(__file__).parents[1] / "backend" / "lambda_function.py"


def load_module():
    os.environ.setdefault("QUIZ_TABLE", "quiz-table")
    os.environ.setdefault("SUBMISSION_TABLE", "submission-table")
    os.environ.setdefault("PDF_BUCKET", "pdf-bucket")
    os.environ.setdefault("BEDROCK_PROFILE_ID", "profile-id")

    fake_boto3 = types.ModuleType("boto3")
    fake_boto3.resource = MagicMock(return_value=MagicMock())
    fake_boto3.client = MagicMock(return_value=MagicMock())

    fake_dynamodb = types.ModuleType("boto3.dynamodb")
    fake_conditions = types.ModuleType("boto3.dynamodb.conditions")
    fake_conditions.Key = MagicMock()

    fake_pypdf = types.ModuleType("pypdf")
    fake_pypdf.PdfReader = MagicMock()

    spec = importlib.util.spec_from_file_location("lecture_feedback_lambda", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(
        sys.modules,
        {
            "boto3": fake_boto3,
            "boto3.dynamodb": fake_dynamodb,
            "boto3.dynamodb.conditions": fake_conditions,
            "pypdf": fake_pypdf,
        },
    ):
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
    return module


class HelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_extract_json_from_code_fence(self):
        result = self.module.extract_json('```json\n{"title":"x","questions":[]}\n```')
        self.assertEqual(result["title"], "x")

    def test_validate_quiz_accepts_four_choices(self):
        quiz = {
            "title": "Quiz",
            "questions": [
                {
                    "question_id": "q1",
                    "question": "Question?",
                    "choices": ["a", "b", "c", "d"],
                    "correct_answer": 2,
                    "explanation": "Because.",
                }
            ],
        }
        result = self.module.validate_quiz(quiz)
        self.assertEqual(result["questions"][0]["correct_answer"], 2)

    def test_validate_quiz_rejects_wrong_choice_count(self):
        quiz = {
            "questions": [
                {
                    "question_id": "q1",
                    "question": "Question?",
                    "choices": ["a", "b"],
                    "correct_answer": 0,
                }
            ]
        }
        with self.assertRaises(ValueError):
            self.module.validate_quiz(quiz)

    def test_sanitize_filename(self):
        self.assertEqual(
            self.module.sanitize_filename("../lecture 日本語"),
            "lecture____.pdf",
        )

    def test_unknown_action_lists_supported_actions(self):
        result = self.module.handler({"action": "unknown"}, None)
        body = json.loads(result["body"])

        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(
            set(body["available_actions"]),
            set(self.module.ACTION_HANDLERS),
        )


if __name__ == "__main__":
    unittest.main()
