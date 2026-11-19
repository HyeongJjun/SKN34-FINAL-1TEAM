"""E2 v3 검색 변형 (무료): 지금 서버 키워드 검색 vs 12공종 무게(search3) vs + 카드 열쇠 색인. LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e2_v3.py            # dev
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e2_v3.py --final    # 고른 것만 held-out 한 번

- RAG 질문(90 + 300, 정답 조각): hit@1 · hit@5 · MRR (evaluation/rag/metrics.scores)
- 질문 은행(13공종, 정답 조각 없음): 공종 맞물림@5 = 위 5개 중 정답 공종 조각이 하나라도 있음(대리 지표) · '부족' 판단 비율
- 카드 열쇠 색인: 카드가 인용한 조각의 예시 질문(hints)에 그 카드 열쇠를 더해 다시 색인(PLAN E2-4)
- 말뭉치: corpus3(v3 지식 요지 K20001~ 포함)
"""

import argparse
from collections import Counter

from common import ROOT, corpus_path, jsonl, save, utf8_stdout, wilson
from kb3 import bank
from metrics import scores
from rank_server import load_index

from app.agent.v3.trades import TAG_TO_CODE, trades_in
from app.knowledge import bm25, cards, search3

RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
KO = {"도배": "dobae", "목공": "mokgong", "공통": None}


def with_card_keys(ix: bm25.Index) -> bm25.Index:
    keys: dict[str, list[str]] = {}
    for c in cards.default().cards:
        for r in c.cites():
            keys.setdefault(r, []).extend(c.keys)
    docs = {x.chunk.doc: x.doc for x in ix.items}
    chunks = [
        bm25.Chunk(ref=x.chunk.ref, doc=x.chunk.doc, text=x.chunk.text, sec=x.chunk.sec,
                   hints=x.chunk.hints + tuple(keys.get(x.chunk.ref, [])), trades=x.chunk.trades, rid=x.chunk.rid)
        for x in ix.items
    ]  # fmt: skip
    return bm25.build(chunks, docs, ix.version + "+cardkeys")


def methods(ix: bm25.Index, ixk: bm25.Index) -> dict:
    def server(q, trade=None):
        return bm25.search(ix, q, k=10).hits

    def v3(q, trade=None, index=ix):
        tr = [trade] if trade else trades_in(q)[:1]
        return search3.search(index, q, trades=tr, tags=TAG_TO_CODE, k=10).hits

    return {
        "서버 키워드(지금 무료 모드)": server,
        "v3 12공종 무게(search3)": v3,
        "v3 + 카드 열쇠 색인": lambda q, trade=None: v3(q, trade, ixk),
    }


def rag_eval(split: str, fns: dict) -> dict:
    qs = [
        q
        for p in RAG
        for q in jsonl(p)
        if q["split"] == split and q["expect"] == "answer" and q.get("gold")
    ]
    out = {}
    for name, fn in fns.items():
        agg = Counter()
        for q in qs:
            gold = {g["ref"]: g["grade"] for g in q["gold"]}
            s = scores([h.ref for h in fn(q["text"], KO.get(q["trade"]))], gold)
            for k in ("hit@1", "hit@5", "mrr"):
                agg[k] += s[k]
        n = len(qs)
        out[name] = {"n": n, "hit@1": round(agg["hit@1"] / n, 3), "hit@5": round(agg["hit@5"] / n, 3),
                     "hit5_ci95": wilson(int(agg["hit@5"]), n), "mrr": round(agg["mrr"] / n, 3)}  # fmt: skip
    return out


def bank_eval(split: str, ix: bm25.Index, fns: dict) -> dict:
    sc = search3.scopes(ix, TAG_TO_CODE)
    qs = [q for q in bank(split) if q["expect"] == "answer" and q["trade"] != "common"]
    out = {}
    for name, fn in fns.items():
        ok = Counter()
        for q in qs:
            hits = fn(q["text"])[:5]
            good = any(q["trade"] in sc.get(h.ref, ()) for h in hits)
            ok[q["trade"]] += good
            ok["all"] += good
        out[name] = {"n": len(qs), "trade_match@5": round(ok["all"] / len(qs), 3),
                     "ci95": wilson(ok["all"], len(qs)),
                     "by_trade": {t: ok[t] for t in sorted({q["trade"] for q in qs})}}  # fmt: skip
    return out


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    ix = load_index(corpus_path())
    ixk = with_card_keys(ix)
    fns = methods(ix, ixk)
    out: dict = {"corpus": ix.version, "cards": cards.default().version, "splits": {}}
    for split in ("dev", "heldout") if a.final else ("dev",):
        r = {"rag": rag_eval(split, fns), "bank_10trades_proxy": bank_eval(split, ix, fns)}
        out["splits"][split] = r
        for name, m in r["rag"].items():
            print(
                f"[{split}] RAG {name}: hit@5 {m['hit@5']} {m['hit5_ci95']} · hit@1 {m['hit@1']} · MRR {m['mrr']} (n {m['n']})"
            )
        for name, m in r["bank_10trades_proxy"].items():
            print(
                f"[{split}] 은행 공종 맞물림@5 {name}: {m['trade_match@5']} {m['ci95']} (n {m['n']})"
            )
    p = save(f"e2_v3_{'final' if a.final else 'dev'}.json", out)
    print(f"저장: {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
