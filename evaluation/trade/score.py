"""공정 담당 답 평가 지표. 무료.

    python evaluation/trade/score.py [--final]   # --final이면 held-out까지

입력
- .cache/answers_<공정>.jsonl (evaluation/answer/run.py --set evaluation/trade/<공정>.jsonl)
- .cache/judged_<공정>.json: {질문 id: {claims, cites, expect, must_not, made_up_numbers, tone_ok, note}}
  - claims · cites · made_up_numbers · tone_ok: evaluation/answer/judge.md와 같다
  - expect: 질문의 expect 줄마다 "yes" / "partial" / "no"
  - must_not: 질문의 must_not 줄마다 어겼으면 true
자기 공정 인용은 코드가 센다: 답에 남은 근거 중 그 공정 표시(bm25.scope_of) 조각이 하나라도 있으면 통과
"""

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.knowledge.bm25 import scope_of

C = HERE / ".cache"
TRADES = {"dobae": "도배", "mokgong": "목공"}


def ratio(a: int, b: int) -> str:
    return f"{a / b:.3f} ({a}/{b})" if b else "-"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    corpus = json.loads((ROOT / "evaluation/rag/.cache/corpus.json").read_text(encoding="utf-8"))
    scope = {c["k"]: scope_of(tuple(c["trades"])) for c in corpus["chunks"]}
    for key, name in TRADES.items():
        path = C / f"answers_{key}.jsonl"
        if not path.exists():
            continue
        rows = [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x]
        jp = C / f"judged_{key}.json"
        judged = json.loads(jp.read_text(encoding="utf-8")) if jp.exists() else {}
        for split in ["dev", "heldout"] if a.final else ["dev"]:
            rs = [r for r in rows if r["split"] == split]
            js = [judged[r["id"]] for r in rs if r["id"] in judged]
            print(f"## {name} 담당 · {split} · {len(rs)}문항 (판정 {len(js)})")
            print("- 담당으로 감:", ratio(sum(r["agent"] == name for r in rs), len(rs)))
            own = [any(name in scope.get(s, ()) for s in r["sources"]) for r in rs]
            print("- 자기 공정 자료 인용:", ratio(sum(own), len(rs)),
                  f"· 근거 0개 {sum(1 for r in rs if not r['sources'])}")  # fmt: skip
            claims = [c["label"] for j in js for c in j["claims"]]
            print("- 근거성:", ratio(claims.count("supported"), len(claims)),
                  f"· 일부 {claims.count('partial')} · 근거 없음 {claims.count('unsupported')}")  # fmt: skip
            cites = [c["ok"] for j in js for c in j["cites"]]
            print("- 인용 정밀도:", ratio(sum(cites), len(cites)))
            ex = [x for j in js for x in j["expect"]]
            print("- 해야 할 행동:", ratio(ex.count("yes"), len(ex)), f"· 일부 {ex.count('partial')}")
            mn = [x for j in js for x in j["must_not"]]
            print("- 하면 안 되는 것 어김:", sum(mn), f"/ {len(mn)}")
            print("- 지어낸 숫자:", sum(j["made_up_numbers"] for j in js))
            print("- 해요체:", ratio(sum(j["tone_ok"] for j in js), len(js)))
            print("- 실패:", sum(r["failed"] for r in rs), "· 숫자 검사로 뺀 문장:",
                  sum(len(r["dropped"]) for r in rs))  # fmt: skip
        print(f"- 비용 ${sum(r['cost'] for r in rows):.4f} · 평균 "
              f"{sum(r['seconds'] for r in rows) / len(rows):.1f}초")  # fmt: skip


if __name__ == "__main__":
    main()
