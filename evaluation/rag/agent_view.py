"""공정 에이전트가 보는 검색 범위를 dev 질문으로 고른다. DB · LLM 없이.

질문의 공정(도배 · 목공)을 그 공정 에이전트가 받았다고 보고 검색에 넘긴다. 공통 질문은 공정 없이 찾는다.
견주는 것: 지금(공정을 질문 낱말로만 고름) · 공정만 넘김 · 공정 + 공통 우선 · 범위 밖 낮춤

python evaluation/rag/agent_view.py            # dev 격자 탐색 (90 + 300 세트)
python evaluation/rag/agent_view.py --final '{"trade_w": 0.004}'   # 고른 설정으로 held-out 한 번
"""

import argparse
import itertools
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from hybrid import rank
from metrics import load_questions, report
from rank_server import load_index

SETS = (("questions.jsonl", "dense.json"), ("questions_300.jsonl", "dense_300.json"))
GRID = {
    "trade_w": [0.002, 0.004, 0.008, 0.012],
    "common_w": [0.0, 0.002, 0.004],
    "out_w": [0.0, 0.002, 0.004, 0.008],
}
KEYS = ("hit@5", "mrr", "ndcg@5", "hit@1", "recall@5")


def run(ix, sets, conf: dict, with_trade: bool, splits: set[str]) -> dict:
    """두 세트 결과를 질문 수로 합친다"""
    acc: dict[str, dict] = {}
    for qs, dense in sets:
        r = report(rank(ix, qs, dense, conf, with_trade=with_trade), qs, splits)
        for g, v in r.items():
            if "n" not in v or not isinstance(v.get("n"), int) or g.startswith("답 없음"):
                continue
            a = acc.setdefault(g, {k: 0.0 for k in KEYS} | {"n": 0})
            for k in KEYS:
                a[k] += v[k] * v["n"]
            a["n"] += v["n"]
    return {g: {k: round(a[k] / a["n"], 3) for k in KEYS} | {"n": a["n"]} for g, a in acc.items()}


def line(name: str, r: dict) -> str:
    parts = [
        f"{g} {r[g]['hit@5']:.3f}/{r[g]['mrr']:.3f}/{r[g]['ndcg@5']:.3f} (n={r[g]['n']})"
        for g in ("전체", "도배", "목공", "공통")
        if g in r
    ]
    return f"{name:<28} " + " · ".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", help="고른 설정 JSON. held-out까지 한 번 본다")
    a = ap.parse_args()
    ix = load_index(HERE / ".cache" / "corpus.json")
    sets = [
        (load_questions(HERE / q), json.loads((HERE / ".cache" / d).read_text(encoding="utf-8")))
        for q, d in SETS
    ]
    print("hit@5 / mrr / ndcg@5 (공정별)")
    if a.final:
        conf = json.loads(a.final)
        for label, splits in (("dev", {"dev"}), ("held-out", {"heldout"})):
            print(f"[{label}]")
            print(line("지금(낱말로 공정)", run(ix, sets, {}, False, splits)))
            print(line("공정만 넘김", run(ix, sets, {}, True, splits)))
            print(line("고른 설정 " + json.dumps(conf), run(ix, sets, conf, True, splits)))
        return
    print(line("지금(낱말로 공정)", run(ix, sets, {}, False, {"dev"})))
    print(line("공정만 넘김", run(ix, sets, {}, True, {"dev"})))
    rows = []
    for vals in itertools.product(*GRID.values()):
        conf = dict(zip(GRID, vals, strict=True))
        r = run(ix, sets, conf, True, {"dev"})
        own = {k: (r["도배"][k] * r["도배"]["n"] + r["목공"][k] * r["목공"]["n"]) for k in KEYS}
        n = r["도배"]["n"] + r["목공"]["n"]
        rows.append(((own["hit@5"] / n, own["mrr"] / n, own["ndcg@5"] / n), conf, r))
    rows.sort(key=lambda x: (-x[0][0], -x[0][1], -x[0][2]))
    for _, conf, r in rows[:8]:
        print(line(json.dumps(conf), r))


if __name__ == "__main__":
    main()
