"""공유 가능한 가이드북과 공유 금지 시공일지 CSV를 구분한다."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_repo import PRIVATE_SOURCE_SHA256, check_file


class PrivateDataTests(unittest.TestCase):
    def test_private_csv_names_are_rejected(self):
        for name in ("14_sigong_ilji_rag.csv", "SIGONG_ILJI.CSV", "시공일지.csv"):
            with self.subTest(name=name):
                self.assertTrue(check_file(Path(name)))

    def test_renamed_private_csv_is_rejected_without_printing_body(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "renamed.csv"
            path.write_bytes(b"source_sha256,content\n" + PRIVATE_SOURCE_SHA256 + b",private-test-text\n")
            problems = check_file(path)
            self.assertEqual(len(problems), 1)
            self.assertNotIn("private-test-text", problems[0])

    def test_allowed_guide_csv_is_not_rejected(self):
        path = Path(__file__).resolve().parents[3] / "data/processed/13_interior_guide_book_rag.csv"
        self.assertTrue(path.is_file())
        self.assertEqual(check_file(path), [])


if __name__ == "__main__":
    unittest.main()
