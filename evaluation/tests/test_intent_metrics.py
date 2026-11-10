import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import run
from intent_metrics import (
    Example,
    confusion_matrix,
    evaluate,
    load_examples,
    macro_f1,
    parse_novice,
    per_label_scores,
    percentile,
)


class Fixed:
    """문장마다 정해 둔 답을 낸다. 부른 횟수를 센다."""

    name = "fixed"

    def __init__(self, answers, confidence=0.9):
        self.answers = answers
        self.confidence = confidence
        self.calls = 0

    def predict(self, text):
        self.calls += 1
        label = self.answers[text]
        return label, {label: self.confidence}


class MetricsTest(unittest.TestCase):
    def test_scores_by_hand(self):
        gold = ["consult", "consult", "schedule", "orchestrator"]
        pred = ["consult", "schedule", "schedule", "orchestrator"]
        matrix = confusion_matrix(gold, pred)
        scores = per_label_scores(matrix)

        self.assertEqual(matrix["consult"]["schedule"], 1)
        self.assertAlmostEqual(scores["consult"]["precision"], 1.0)
        self.assertAlmostEqual(scores["consult"]["recall"], 0.5)
        self.assertAlmostEqual(scores["schedule"]["precision"], 0.5)
        # consult 2/3, schedule 2/3, orchestrator 1 → 평균 7/9. 안 나온 라벨은 빼고 평균
        self.assertAlmostEqual(macro_f1(scores, matrix), 7 / 9)

    def test_evaluate_counts_novice_wrong_and_confidence(self):
        examples = [
            Example("a", "consult", novice=True),
            Example("b", "schedule", novice=True),
            Example("c", "out_of_scope"),
        ]
        clf = Fixed({"a": "consult", "b": "consult", "c": "out_of_scope"}, confidence=0.7)
        report = evaluate(clf, examples)

        self.assertAlmostEqual(report.accuracy, 2 / 3)
        self.assertEqual(report.novice_count, 2)
        self.assertAlmostEqual(report.novice_accuracy, 0.5)
        self.assertEqual(
            report.wrong, [{"text": "b", "gold": "schedule", "pred": "consult", "kind": ""}]
        )
        self.assertEqual(len(report.predictions), 3)
        self.assertEqual(report.predictions[1]["pred"], "consult")
        self.assertAlmostEqual(report.predictions[1]["confidence"], 0.7)
        self.assertNotIn("text", report.predictions[0])

    def test_warmup_calls_once_more_and_can_be_off(self):
        examples = [Example("a", "consult"), Example("b", "consult")]
        with_warmup = Fixed({"a": "consult", "b": "consult"})
        evaluate(with_warmup, examples)
        self.assertEqual(with_warmup.calls, 3)

        without = Fixed({"a": "consult", "b": "consult"})
        evaluate(without, examples, warmup=False)
        self.assertEqual(without.calls, 2)

    def test_unknown_label_from_classifier_stops(self):
        with self.assertRaises(ValueError):
            evaluate(Fixed({"a": "guide"}), [Example("a", "consult")], warmup=False)

    def test_probs_without_predicted_label_stops(self):
        class NumberKeys:
            name = "number_keys"

            def predict(self, text):
                return "consult", {"1": 0.9}

        with self.assertRaisesRegex(ValueError, "확률"):
            evaluate(NumberKeys(), [Example("a", "consult")], warmup=False)

    def test_percentile_nearest_rank(self):
        self.assertEqual(percentile([], 50), 0.0)
        self.assertEqual(percentile([3.0, 1.0, 2.0, 4.0], 50), 2.0)
        # 5개의 p50은 가운데인 3번째. round(2.5)=2로 내리면 틀림
        self.assertEqual(percentile([1.0, 2.0, 3.0, 4.0, 5.0], 50), 3.0)
        self.assertEqual(percentile([float(i) for i in range(1, 21)], 95), 19.0)


class LoadTest(unittest.TestCase):
    def write_lines(self, lines, name="eval.jsonl"):
        folder = Path(tempfile.mkdtemp())
        path = folder / name
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self.addCleanup(lambda: (path.unlink(), folder.rmdir()))
        return path

    def write(self, rows, name="eval.jsonl"):
        return self.write_lines([json.dumps(r, ensure_ascii=False) for r in rows], name)

    def test_loads_and_skips_blank(self):
        path = self.write_lines(
            [json.dumps({"text": "몰딩이 뭐예요?", "label": "orchestrator", "novice": True}), ""]
        )
        self.assertEqual(load_examples(path), [Example("몰딩이 뭐예요?", "orchestrator", True)])

    def test_bom_and_null_kind(self):
        folder = Path(tempfile.mkdtemp())
        path = folder / "bom.jsonl"
        row = {"text": "벽이 누래요", "label": "consult", "kind": None}
        path.write_text(json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8-sig")
        self.addCleanup(lambda: (path.unlink(), folder.rmdir()))
        self.assertEqual(load_examples(path), [Example("벽이 누래요", "consult")])

    def test_kind_must_be_text(self):
        path = self.write([{"text": "a", "label": "consult", "kind": 3}])
        with self.assertRaisesRegex(ValueError, "1번째 줄.*kind"):
            load_examples(path)

    def test_old_six_labels_rejected(self):
        path = self.write([{"text": "처음이에요", "label": "guide"}])
        with self.assertRaisesRegex(ValueError, "1번째 줄"):
            load_examples(path)

    def test_novice_words_from_sheet(self):
        self.assertFalse(parse_novice("false"))
        self.assertFalse(parse_novice("0"))
        self.assertFalse(parse_novice(None))
        self.assertTrue(parse_novice("TRUE"))
        self.assertTrue(parse_novice(True))
        path = self.write([{"text": "벽이 누래요", "label": "consult", "novice": "false"}])
        self.assertFalse(load_examples(path)[0].novice)

    def test_bad_novice_value_has_line_number(self):
        path = self.write(
            [
                {"text": "a", "label": "consult"},
                {"text": "b", "label": "consult", "novice": "maybe"},
            ]
        )
        with self.assertRaisesRegex(ValueError, "2번째 줄"):
            load_examples(path)

    def test_broken_line_has_line_number(self):
        ok = json.dumps({"text": "a", "label": "consult"})
        cases = [
            ('{"text": "b", "label": "consult"', "JSON"),
            ('["b", "consult"]', "한 줄"),
            ('{"txt": "b", "label": "consult"}', "text"),
            ('{"text": "  ", "label": "consult"}', "text"),
        ]
        for line, reason in cases:
            with self.subTest(line=line):
                path = self.write_lines([ok, line])
                with self.assertRaisesRegex(ValueError, f"2번째 줄.*{reason}"):
                    load_examples(path)


class RunnerTest(unittest.TestCase):
    example = Path(run.__file__).parent / "intent" / "example.jsonl"

    def run_quiet(self, argv):
        out = io.StringIO()  # 노트북처럼 reconfigure가 없는 stdout
        with contextlib.redirect_stdout(out):
            code = run.main(argv)
        return code, out.getvalue()

    def test_heldout_needs_final(self):
        code, out = self.run_quiet(["intent", "--split", "heldout"])
        self.assertEqual(code, 2)
        self.assertIn("--final", out)

    def test_heldout_by_data_path_also_needs_final(self):
        for name in ("heldout.jsonl", "held_out.jsonl", "Held-Out.jsonl"):
            with self.subTest(name=name):
                folder = Path(tempfile.mkdtemp())
                path = folder / name
                path.write_text(self.example.read_text(encoding="utf-8"), encoding="utf-8")
                self.addCleanup(lambda p=path, d=folder: (p.unlink(), d.rmdir()))

                self.assertEqual(self.run_quiet(["intent", "--data", str(path)])[0], 2)
                argv = ["intent", "--data", str(path), "--final"]
                self.assertEqual(self.run_quiet(argv)[0], 0)

    def test_bad_eval_file_gives_message_not_traceback(self):
        folder = Path(tempfile.mkdtemp())
        path = folder / "dev.jsonl"
        path.write_text('{"text": "a", "label": "guide"}\n', encoding="utf-8")
        self.addCleanup(lambda: (path.unlink(), folder.rmdir()))

        code, out = self.run_quiet(["intent", "--data", str(path)])
        self.assertEqual(code, 2)
        self.assertIn("1번째 줄", out)

    def test_example_runs_and_json_folder_is_made(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "new" / "dir" / "report.json"
            code, out = self.run_quiet(
                ["intent", "--data", str(self.example), "--json", str(out_path)]
            )
            self.assertEqual(code, 0)
            self.assertIn("all_orchestrator", out)
            saved = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(len(saved["predictions"]), 6)


if __name__ == "__main__":
    unittest.main()
