"""판정 결과 채점 스크립트(evaluation/v3/judge_score.py)를 작은 가짜 입력으로 시험한다 (LLM · DB 없음)."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evaluation" / "v3"))

import judge_score as js


def _write(path: Path, rows: list, extra: tuple[str, ...] = ()) -> None:
    lines = [json.dumps(r, ensure_ascii=False) for r in rows] + list(extra)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _e3(pid, labels, answered, **fail):
    return {
        "pid": pid,
        "sentences": [{"i": i, "label": x} for i, x in enumerate(labels)],
        "fail": fail,
        "answered": answered,
        "why": "",
    }


def _fake(tmp_path: Path) -> tuple[Path, Path]:
    packs, results = tmp_path / "packs", tmp_path / "results"
    packs.mkdir()
    results.mkdir()
    c = [("c1", "answer"), ("c2", "no_source"), ("c3", "answer")]
    _write(
        packs / "e3_c_dev.jsonl",
        [{"pid": p, "question": "q", "answer": "a", "expect": e} for p, e in c],
    )
    _write(
        packs / "e3_c_dev_key.jsonl", [{"pid": p, "qid": f"q-{p}", "variant": "C"} for p, _ in c]
    )
    _write(packs / "e3_abc_dev.jsonl", [{"pid": f"m{v}", "expect": "answer"} for v in "ABC"])
    _write(
        packs / "e3_abc_dev_key.jsonl", [{"pid": f"m{v}", "qid": "q1", "variant": v} for v in "ABC"]
    )
    order = [
        ("p1", "q1", "단일-다중"),
        ("p2", "q1", "다중-단일"),
        ("p3", "q2", "단일-다중"),
        ("p4", "q2", "다중-단일"),
        ("p5", "q3", "단일-다중"),
        ("p6", "q3", "다중-단일"),
        ("p7", "q4", "단일-다중"),
    ]
    _write(
        packs / "e4_pairs_dev.jsonl",
        [{"pid": p, "expected_parts": ["dobae", "floor"]} for p, _, _ in order],
    )
    _write(
        packs / "e4_pairs_dev_key.jsonl", [{"pid": p, "qid": q, "order": o} for p, q, o in order]
    )
    # 판정자 A: part3 · abc 없음. 못 읽는 줄 · 열쇠에 없는 pid · 겹친 pid를 하나씩 넣는다
    _write(
        results / "A_e3_c_part1.jsonl",
        [
            _e3("c1", ["supported", "policy", "supported"], "yes"),
            _e3("c2", ["unsupported"], "partial", unsupported=True, no_source_fail=True),
            _e3("zz", ["supported"], "yes"),
        ],
        extra=("```json", "판정이 아닌 글"),
    )
    _write(
        results / "A_e3_c_part2.jsonl",
        [
            _e3("c3", ["supported", "partial"], "yes", made_up_number=True),
            _e3("c1", ["unsupported"], "no"),
        ],
    )
    _write(
        results / "B_e3_c_sub.jsonl",
        [_e3("c1", ["supported", "policy", "supported"], "yes"), _e3("c3", ["supported"], "no")],
    )
    _write(
        results / "A_e4_pairs.jsonl",
        [
            {"pid": "p1", "better": "2", "parts_covered_1": 1, "parts_covered_2": 2},
            {"pid": "p2", "better": "1", "parts_covered_1": 2, "parts_covered_2": 1},
            {"pid": "p3", "better": "1"},
            {"pid": "p4", "better": "1"},
            {"pid": "p5", "better": "tie"},
            {"pid": "p6", "better": "tie"},
            {"pid": "p7", "better": "2"},
        ],
    )
    return packs, results


def test_kappa_matches_hand_count():
    pairs = [("yes", "yes"), ("yes", "no"), ("no", "no"), ("no", "no")]
    assert js.kappa(pairs) == 0.5  # po 0.75 · pe 0.5
    assert js.kappa([(False, False), (False, False)]) is None  # 둘 다 한 값만
    assert js.kappa([]) is None


def test_fake_judgements_are_scored_and_missing_files_are_listed(tmp_path):
    packs, results = _fake(tmp_path)
    out = tmp_path / "out"
    s = js.main(["--results", str(results), "--packs", str(packs), "--out", str(out)])

    assert {
        "A_e3_abc.jsonl",
        "A_e3_c_part3.jsonl",
        "B_e3_abc.jsonl",
        "A_e3_c2.jsonl",
        "B_e3d.jsonl",
    } <= set(s["missing"])
    assert "A_e3_c_part1.jsonl" not in s["missing"]
    f1 = s["files"]["A_e3_c_part1.jsonl"]
    assert (f1["rows"], f1["bad_lines"], f1["unknown_pid"], f1["used"]) == (3, 1, 1, 2)
    assert s["files"]["A_e3_c_part2.jsonl"]["dup"] == 1  # c1은 part1 것만 쓴다

    c = s["e3"]["e3_c"]["A"]["variants"]["C"]
    assert c["n"] == 3
    assert (c["sentences"]["supported"]["k"], c["sentences"]["supported"]["n"]) == (
        3,
        5,
    )  # policy 뺌
    assert c["sentences"]["policy"] == 1
    assert c["items_all_supported"]["k"] == 1
    assert c["fail"]["unsupported"]["k"] == 1
    assert (c["fail"]["no_source_fail"]["k"], c["fail"]["no_source_fail"]["n"]) == (
        1,
        1,
    )  # 자료 없음 항목 안에서
    assert c["made_up_number"] == 1 and c["made_up_number_zero"] is False
    assert (c["answered"]["yes"]["k"], c["answered"]["yes"]["n"]) == (2, 3)
    assert "e3_abc" not in s["e3"]  # 판정 파일이 없으면 건너뜀

    g = s["agreement"]["e3_c"]
    assert g["overlap"] == 2
    assert g["answered"]["kappa"] == 0.0 and g["answered"]["agree"] == 0.5
    assert g["fail"]["made_up_number"]["kappa"] == 0.0
    assert g["fail"]["unsupported"]["kappa"] is None
    assert g["sentences"]["agree"] == 1.0 and g["sentences"]["split_mismatch"] == 1
    assert "e3_abc" not in s["agreement"]

    e = s["e4"]["A"]
    assert (e["questions"], e["complete"], e["incomplete"]) == (4, 3, 1)
    assert (e["win_multi"], e["win_single"], e["tie"], e["order_effect"]) == (1, 0, 1, 1)
    assert e["parts_covered_mean"] == {"단일": 0.5, "다중": 1.0}

    saved = json.loads((out / "judge_summary.json").read_text(encoding="utf-8"))
    assert saved["e4"]["A"]["order_effect"] == 1
    md = (out / "judge_summary.md").read_text(encoding="utf-8")
    assert "E4 단일 vs 다중" in md and "아직 없음(건너뜀)" in md


def test_doc_block_is_replaced_only_between_marks(tmp_path):
    doc = tmp_path / "b5.md"
    doc.write_text(f"앞\n{js.MARK_START}\n옛 표\n{js.MARK_END}\n뒤\n", encoding="utf-8")
    assert js.write_doc(doc, "새 표\n")
    t = doc.read_text(encoding="utf-8")
    assert "새 표" in t and "옛 표" not in t and t.startswith("앞\n") and t.endswith("뒤\n")
    bare = tmp_path / "bare.md"
    bare.write_text("표시 줄 없음\n", encoding="utf-8")
    assert not js.write_doc(bare, "새 표\n")


def test_round1_before_after_and_llm_sim_are_paired_by_question(tmp_path):
    packs, results = _fake(tmp_path)
    # 개선 C(e3_c2): 열쇠 prev_pid로 지난 판정(c1 · c3)과 짝. n3는 이제 '모름'
    _write(
        packs / "e3_c2_dev.jsonl",
        [
            {"pid": "n1", "answer": "a", "expect": "answer"},
            {"pid": "n3", "answer": "이 질문은 믿집 자료로 확인하지 못했어요.", "expect": "answer"},
        ],
    )
    _write(
        packs / "e3_c2_dev_key.jsonl",
        [
            {"pid": "n1", "qid": "q-c1", "variant": "C2", "prev_pid": "c1"},
            {"pid": "n3", "qid": "q-c3", "variant": "C2", "prev_pid": "c3"},
        ],
    )
    _write(
        results / "A_e3_c2.jsonl",
        [_e3("n1", ["supported", "supported"], "yes"), _e3("n3", ["policy"], "no")],
    )
    # D(LLM 흉내): abc와 같은 질문 q1
    _write(packs / "e3d_dev.jsonl", [{"pid": "dq1", "answer": "a", "expect": "answer"}])
    _write(packs / "e3d_dev_key.jsonl", [{"pid": "dq1", "qid": "q1", "variant": "D"}])
    _write(
        results / "A_e3_abc.jsonl",
        [
            _e3("mA", ["supported"], "partial"),
            _e3("mB", ["unsupported"], "no", unsupported=True),
            _e3("mC", ["supported"], "partial"),
        ],
    )
    _write(results / "A_e3d.jsonl", [_e3("dq1", ["supported", "supported"], "yes")])
    # 개선 2회차(e3_c3): 같은 문항, prev_pid = c2 pid
    _write(packs / "e3_c3_dev.jsonl", [{"pid": "r1", "answer": "a", "expect": "answer"}])
    _write(
        packs / "e3_c3_dev_key.jsonl",
        [{"pid": "r1", "qid": "q-c1", "variant": "C3", "prev_pid": "n1"}],
    )
    _write(results / "A_e3_c3.jsonl", [_e3("r1", ["supported"], "partial")])
    s = js.main(["--results", str(results), "--packs", str(packs), "--out", str(tmp_path / "o")])

    c3 = s["before_after_c3"]["A"]
    assert c3["pairs"] == 1 and (c3["better"], c3["worse"]) == (0, 1)  # n1 yes → r1 partial
    b = s["before_after"]["A"]
    assert b["pairs"] == 2 and (b["better"], b["same"], b["worse"]) == (0, 1, 1)  # c3 yes → n3 no
    assert b["fail"]["made_up_number"] == {"before": 1, "after": 0, "fixed": 1, "new": 0}
    assert b["now_unknown"] == 1 and b["now_unknown_answered"] == {"no": 1}
    assert (b["supported_before"]["k"], b["supported_after"]["k"]) == (3, 2)
    assert "B" not in s["before_after"]  # B_e3_c2가 아직 없음
    d = s["d_vs_abc"]["A"]
    assert d["questions"] == 1 and d["d_vs_c"] == {"d_better": 1}
    assert set(d["per_variant"]) == {"A", "B", "C", "D"}
    assert d["per_variant"]["B"]["unsupported"] == 1
    md = (tmp_path / "o" / "judge_summary.md").read_text(encoding="utf-8")
    assert "E3 개선 전후" in md and "E3-D(LLM 흉내)" in md
