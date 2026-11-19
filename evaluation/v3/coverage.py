"""지금 지식 자료가 v3 공종을 얼마나 덮는지 센다 (조각 · 예시 질문 수). LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/coverage.py

- 조각의 공정 표시(trades, 16가지 낱말)를 v3 공종 코드로 모은다. 한 조각이 여러 공종이면 모두 센다
- 예시 질문(hints)은 답 카드의 '찾는 말' 후보다
"""

from collections import Counter

from common import CACHE, ROOT, save, utf8_stdout
from rank_server import load_index
from trades_v3 import TRADE_KO

# 조각 공정 표시 → v3 공종. 가구는 주방 · 붙박이장이라 주방으로, 중문은 창호로, 마감 · 전체 · 공통은 공통
TAG = {
    "도배": "dobae", "목공": "mokgong", "바닥재": "floor", "타일": "tile", "욕실": "bath", "가구": "kitchen",
    "주방": "kitchen", "도장": "paint", "필름": "film", "조명": "electric", "전기": "electric", "창호": "window",
    "중문": "window", "철거": "demolition", "설비": "plumbing", "마감": "common", "전체": "common", "공통": "common",
}  # fmt: skip


def main() -> None:
    utf8_stdout()
    ix = load_index(CACHE / "corpus.json")
    chunks, hints, kinds = Counter(), Counter(), {}
    unknown = Counter()
    for x in ix.items:
        tags = {TAG.get(t) for t in x.chunk.trades} - {None}
        unknown.update(t for t in x.chunk.trades if t not in TAG)
        if not tags:
            tags = {"common"}
        for t in tags:
            chunks[t] += 1
            hints[t] += len(x.chunk.hints)
            kinds.setdefault(t, Counter())[x.doc.kind or "?"] += 1
    rows = []
    for code in [*TRADE_KO, "common"]:
        rows.append(
            {
                "trade": code,
                "ko": TRADE_KO.get(code, "공통"),
                "chunks": chunks[code],
                "hints": hints[code],
                "top_sources": dict(kinds.get(code, Counter()).most_common(4)),
            }
        )
        print(
            f"- {rows[-1]['ko']}({code}): 조각 {chunks[code]} · 예시 질문 {hints[code]} · 출처 {rows[-1]['top_sources']}"
        )
    if unknown:
        print("- 모르는 표시:", dict(unknown))
    path = save("coverage_corpus.json", {"corpus": ix.version, "chunks": ix.n, "rows": rows})
    print(f"저장: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
