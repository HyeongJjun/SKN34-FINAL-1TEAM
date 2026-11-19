"""E3 사전 실험: '답 카드'를 예시 질문으로 찾을 때 비슷함 기준값별로 얼마나 맞는지 (흉내). LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e3_card_proxy.py          # dev만

- 아직 검증된 답 카드가 없어서, 지금 조각에 묶인 예시 질문(hints) 2,035개를 '카드의 찾는 말'로 본다
  (카드 = 그 예시 질문이 묶인 조각). 진짜 카드 세트가 생기면 같은 방식으로 다시 잰다
- 질문 ↔ 예시 질문 비슷함 = 글자 두 개 묶음 TF-IDF 코사인
- 기준값 t 이상이면 '카드로 답함', 아니면 '카드 없음(검색 · 모름으로 넘김)'
  - 답할 질문: 답한 비율, 답한 것 중 카드 조각이 정답(grade≥1) · 직접 답(grade 2)인 비율
  - 자료 없음 질문(no_source): 카드로 잘못 답한 비율 (낮아야 한다)
"""

import math
from collections import Counter

from common import CACHE, ROOT, jsonl, save, utf8_stdout, wilson
from rank_server import load_index

from app.knowledge import bm25

SETS = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]


def vec(text: str, idf: dict[str, float]) -> dict[str, float]:
    tf = Counter(bm25.grams(text))
    v = {t: (1 + math.log(c)) * idf.get(t, 0.0) for t, c in tf.items()}
    norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
    return {t: x / norm for t, x in v.items()}


def main() -> None:
    utf8_stdout()
    ix = load_index(CACHE / "corpus.json")
    bank = [(x.chunk.ref, h) for x in ix.items for h in x.chunk.hints]
    df = Counter(t for _, h in bank for t in set(bm25.grams(h)))
    idf = {t: math.log((len(bank) + 1) / (c + 1)) + 1 for t, c in df.items()}
    vecs = [(ref, h, vec(h, idf)) for ref, h in bank]
    qs = [
        q
        for p in SETS
        for q in jsonl(p)
        if q["split"] == "dev" and q["expect"] in ("answer", "no_source")
    ]
    best = []
    for q in qs:
        qv = vec(q["text"], idf)
        sim, ref, hint = max(
            ((sum(w * qv.get(t, 0.0) for t, w in v.items()), r, h) for r, h, v in vecs),
            default=(0, "", ""),
        )
        gold = {g["ref"]: g["grade"] for g in q.get("gold") or []}
        best.append({"id": q["id"], "expect": q["expect"] if gold or q["expect"] == "no_source" else "no_gold",
                     "sim": round(sim, 3), "ref": ref, "grade": gold.get(ref, 0), "q": q["text"], "hint": hint})  # fmt: skip
    # 맞물림: 카드 조각이 같은 질문의 키워드 검색 위 5개에도 있으면 (두 신호가 같은 곳을 가리킴)
    by_id = {q["id"]: q for q in qs}
    for b in best:
        r = bm25.search(ix, by_id[b["id"]]["text"], k=5)
        b["agree"] = b["ref"] in {h.ref for h in r.hits}
    ans = [b for b in best if b["expect"] == "answer"]
    nos = [b for b in best if b["expect"] == "no_source"]
    curve = []
    for mode in ("비슷함만", "비슷함 + 검색 맞물림"):
        for t in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8):

            def keep(b: dict, t: float = t, mode: str = mode) -> bool:
                return b["sim"] >= t and (mode == "비슷함만" or b["agree"])

            took = [b for b in ans if keep(b)]
            ok1 = sum(1 for b in took if b["grade"] >= 1)
            ok2 = sum(1 for b in took if b["grade"] >= 2)
            wrong = sum(1 for b in nos if keep(b))
            curve.append(
                {
                    "mode": mode,
                    "t": t,
                    "answered": f"{len(took)}/{len(ans)}",
                    "answer_rate": round(len(took) / len(ans), 3),
                    "precision_grade1": round(ok1 / len(took), 3) if took else None,
                    "precision_grade1_ci95": wilson(ok1, len(took)),
                    "precision_grade2": round(ok2 / len(took), 3) if took else None,
                    "no_source_false_answer": f"{wrong}/{len(nos)}",
                }
            )
            c = curve[-1]
            print(
                f"[{mode}] t={t}: 답함 {c['answered']} ({c['answer_rate']}) · 카드 조각이 근거 {c['precision_grade1']} "
                f"{c['precision_grade1_ci95']} · 직접 답 {c['precision_grade2']} · 자료 없음인데 답함 {c['no_source_false_answer']}"
            )
    sample = sorted(ans, key=lambda b: -b["sim"])[:5] + [b for b in nos if b["sim"] >= 0.5][:5]
    path = save("e3_card_proxy_dev.json", {"bank": len(bank), "curve": curve, "sample": sample})
    print(
        f"저장: {path.relative_to(ROOT)} · 예시 질문 {len(bank)}개 · 답할 질문 {len(ans)} · 자료 없음 {len(nos)}"
    )


if __name__ == "__main__":
    main()
