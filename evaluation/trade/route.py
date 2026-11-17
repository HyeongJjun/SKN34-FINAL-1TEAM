"""공정 담당 고르기(코드, LLM 없이)를 RAG 평가 질문의 공정 표시로 잰다. 무료.

python evaluation/trade/route.py           # dev
python evaluation/trade/route.py --final   # held-out까지

- 맞음: 도배 · 목공 질문이 그 담당으로, 공통 질문이 일반 상담으로 갔다
- 일반 상담으로 감: 공정 질문인데 낱말로 공정을 몰라 일반 상담이 받았다 (답은 하지만 공정 지시문을 못 씀)
- 공통이 담당으로 감: 공통 질문을 담당이 받았다 (담당도 공통 자료를 함께 찾아 해가 작다)
- 다른 공정 담당: 도배 질문을 목공 담당이 받는 경우. 0이어야 한다
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.knowledge.bm25 import trade_of

SETS = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]


def verdict(label: str, got: str | None) -> str:
    if label == "공통":
        return "맞음" if got is None else "공통이 담당으로 감"
    if got == label:
        return "맞음"
    return "일반 상담으로 감" if got is None else "다른 공정 담당"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    qs = [json.loads(x) for p in SETS for x in p.read_text(encoding="utf-8").splitlines() if x]
    for split in ("dev", "heldout") if a.final else ("dev",):
        rows = [q for q in qs if q["split"] == split]
        c = Counter(verdict(q["trade"], trade_of(q["text"])) for q in rows)
        by = Counter((q["trade"], verdict(q["trade"], trade_of(q["text"]))) for q in rows)
        print(f"[{split}] {len(rows)}문항 · " + " · ".join(f"{k} {v}" for k, v in c.most_common()))
        for t in ("도배", "목공", "공통"):
            n = sum(v for (lt, _), v in by.items() if lt == t)
            ok = by[(t, "맞음")]
            print(f"  {t}: 맞음 {ok}/{n} ({ok / n:.0%})")


if __name__ == "__main__":
    main()
