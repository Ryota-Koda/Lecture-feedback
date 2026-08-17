import unittest
from html.parser import HTMLParser
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[1]
FRONTEND = REPOSITORY_ROOT / "frontend"


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.assets.append(attributes["src"])
        if tag == "link" and attributes.get("rel") == "stylesheet":
            self.assets.append(attributes["href"])


class FrontendStructureTests(unittest.TestCase):
    def test_role_pages_and_shared_assets_exist(self):
        expected = [
            "index.html",
            "teacher.html",
            "student.html",
            "css/style.css",
            "js/config.js",
            "js/api.js",
            "js/teacher.js",
            "js/student.js",
        ]

        for relative_path in expected:
            with self.subTest(path=relative_path):
                self.assertTrue((FRONTEND / relative_path).is_file())

    def test_html_asset_references_resolve(self):
        for page_name in ["index.html", "teacher.html", "student.html"]:
            parser = AssetParser()
            parser.feed((FRONTEND / page_name).read_text(encoding="utf-8"))

            for relative_path in parser.assets:
                with self.subTest(page=page_name, asset=relative_path):
                    self.assertTrue((FRONTEND / relative_path).is_file())

    def test_teacher_and_student_actions_are_separated(self):
        teacher_js = (FRONTEND / "js/teacher.js").read_text(encoding="utf-8")
        student_js = (FRONTEND / "js/student.js").read_text(encoding="utf-8")

        self.assertIn('action: "generate_quiz"', teacher_js)
        self.assertIn('action: "upload_pdf_and_generate_quiz"', teacher_js)
        self.assertIn('action: "get_results"', teacher_js)
        self.assertNotIn('action: "submit_answer"', teacher_js)

        self.assertIn('action: "get_quiz"', student_js)
        self.assertIn('action: "submit_answer"', student_js)
        self.assertNotIn('action: "get_results"', student_js)

    def test_student_share_url_contains_quiz_id(self):
        teacher_js = (FRONTEND / "js/teacher.js").read_text(encoding="utf-8")
        student_js = (FRONTEND / "js/student.js").read_text(encoding="utf-8")

        self.assertIn('searchParams.set("quiz_id"', teacher_js)
        self.assertIn('get("quiz_id")', student_js)


if __name__ == "__main__":
    unittest.main()
