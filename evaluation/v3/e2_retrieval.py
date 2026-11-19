"""E2 검색 기준선과 무료 변형. LLM · DB 없음(무료).

    cd backend && .venv/Scripts/python.exe ../evaluation/rag/corpus.py --out ../evaluation/v3/.cache/corpus.json
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e2_retrieval.py            # dev
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e2_retrieval.py --final    # 지금 설정만 held-out 기록

- 질문: evaluation/rag/questions.jsonl(90) + questions_300.jsonl(300). 정답(gold)이 있는 '자료로 답함' 질문만 잰다
- 지표: evaluation/rag/metrics.py와 같다(hit@1 · hit@5 · recall@5 · MRR · nDCG@5). hit@5에는 Wilson 95% 구간을 붙인다
- 지금 설정(서버 검색 `app/knowledge/bm25.py`, CONF rag7-2026.11.16)
  - server: 키워드만 (무료 모드에서 실제로 도는 것)
  - server_hybrid: 키워드 + 11-13에 만든 의미 검색 순위(.cache/dense_*_20261113.json, text-embedding-3-small) RRF.
    그때 이미 낸 비용으로 만든 사본이라 이번 실행은 0원. 조각 98.8%가 지금과 같은 글이다(나머지는 틀림으로 셈)
- 변형(dev만): 단순 바이그램 BM25 · 예시 질문(hints) 뺌 · 바이그램+트라이그램 · 예시 질문만 찾기(답 카드 흉내)
"""

import argparse
import json
import math
from collections import Counter

from common import CACHE, ROOT, jsonl, save, utf8_stdout, wilson
from metrics import report, scores
from rank_server import load_index

from app.knowledge import bm25

SETS = {
    "90": ROOT / "evaluation/rag/questions.jsonl",
    "300": ROOT / "evaluation/rag/questions_300.jsonl",
}
DENSE = {"90": CACHE / "dense_90_20261113.json", "300": CACHE / "dense_300_20261113.json"}
K1, B = 1.2, 0.75


# ---- 단순 BM25 (서버의 동의어 · 여러 검색어 RRF · 출처 등급 · 공정 무게를 뺀 것) ----
def toks(text: str, ns=(2,)) -> list[str]:
    out: list[str] = []
    for w in bm25._NOT_WORD.sub(" ", (text or "").lower()).split():
        if bm25._ASCII.fullmatch(w) or len(w) == 1:
            out.append(w)
            continue
        for n in ns:
            if len(w) >= n:
                out.extend(w[i : i + n] for i in range(len(w) - n + 1))
    return out


class Plain:
    def __init__(self, docs: list[tuple[str, str]], ns=(2,)):
        """docs: (조각 번호, 글). 같은 번호가 여러 줄이면(예시 질문) 가장 높은 점수로 모은다."""
        self.ns = ns
        self.rows = []
        df: Counter = Counter()
        total = 0
        for ref, text in docs:
            tf = Counter(toks(text, ns))
            n = sum(tf.values())
            self.rows.append((ref, tf, n))
            df.update(tf.keys())
            total += n
        self.df, self.n, self.avg = df, len(self.rows), total / max(len(self.rows), 1)

    def search(self, q: str, k: int = 20) -> list[str]:
        qs = list(dict.fromkeys(toks(q, self.ns)))
        best: dict[str, float] = {}
        for ref, tf, n in self.rows:
            s = 0.0
            for t in qs:
                f = tf.get(t)
                if f:
                    m = self.df[t]
                    idf = math.log(1 + (self.n - m + 0.5) / (m + 0.5))
                    s += idf * f * (K1 + 1) / (f + K1 * (1 - B + B * n / self.avg))
            if s > best.get(ref, 0.0):
                best[ref] = s
        return [r for r, _ in sorted(best.items(), key=lambda p: -p[1])[:k]]


def field_text(x: bm25.Item, hints: bool = True) -> str:
    return " ".join(
        [x.chunk.text, x.chunk.sec, " ".join(x.chunk.hints) if hints else "", x.doc.title]
    )


def no_hints_index(ix: bm25.Index) -> bm25.Index:
    docs = {}
    chunks = []
    for x in ix.items:
        docs[x.chunk.doc] = x.doc
        c = x.chunk
        chunks.append(
            bm25.Chunk(
                ref=c.ref, doc=c.doc, text=c.text, sec=c.sec, hints=(), trades=c.trades, rid=c.rid
            )
        )
    return bm25.build(chunks, docs, ix.version + "-nohints")


def rank_with(fn, qs: list[dict]) -> dict:
    out = {"rankings": {}, "enough": {}}
    for q in qs:
        refs, enough = fn(q)
        out["rankings"][q["id"]] = refs
        out["enough"][q["id"]] = enough
    return out


def hit5_ci(rank: dict, qs: list[dict], splits: set[str]) -> tuple[int, int, tuple]:
    hits = n = 0
    for q in qs:
        if q["split"] not in splits or q["expect"] != "answer" or not q["gold"]:
            continue
        gold = {g["ref"]: g["grade"] for g in q["gold"]}
        hits += int(scores(rank["rankings"].get(q["id"], []), gold)["hit@5"])
        n += 1
    return hits, n, wilson(hits, n)


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--final", action="store_true", help="지금 설정(server · server_hybrid)만 held-out도 잰다"
    )
    a = ap.parse_args()
    ix = load_index(CACHE / "corpus.json")
    qs = [dict(q, set=name) for name, p in SETS.items() for q in jsonl(p)]
    dense = {}
    for p in DENSE.values():
        if p.exists():
            dense.update(json.loads(p.read_text(encoding="utf-8")))

    def trade(q):
        return q["trade"] if q["trade"] != "공통" else None

    def server(q, with_trade=False, use_dense=False, index=ix):
        near = (
            [index.by_ref[r].chunk.rid for r in dense.get(q["id"], []) if r in index.by_ref]
            if use_dense
            else []
        )
        r = bm25.search(index, q["text"], k=20, trade=trade(q) if with_trade else None, dense=near)
        return [h.ref for h in r.hits], r.enough

    nohint = no_hints_index(ix)
    plain = Plain([(x.chunk.ref, field_text(x)) for x in ix.items])
    plain_nh = Plain([(x.chunk.ref, field_text(x, hints=False)) for x in ix.items])
    plain_bt = Plain([(x.chunk.ref, field_text(x)) for x in ix.items], ns=(2, 3))
    qq = Plain([(x.chunk.ref, h) for x in ix.items for h in x.chunk.hints])
    n_hint_chunks = sum(1 for x in ix.items if x.chunk.hints)

    current = {
        "server(키워드만, 무료 모드)": lambda q: server(q),
        "server + 공정 넘김": lambda q: server(q, with_trade=True),
        "server_hybrid(키워드+의미, 11-13 순위)": lambda q: server(q, use_dense=True),
        "server_hybrid + 공정 넘김": lambda q: server(q, with_trade=True, use_dense=True),
    }
    variants = {
        "dense만(11-13 순위)": lambda q: (dense.get(q["id"], [])[:20], True),
        "server, 예시 질문(hints) 뺌": lambda q: server(q, index=nohint),
        "단순 바이그램 BM25": lambda q: (plain.search(q["text"]), True),
        "단순 바이그램, hints 뺌": lambda q: (plain_nh.search(q["text"]), True),
        "단순 바이+트라이그램": lambda q: (plain_bt.search(q["text"]), True),
        "예시 질문만 찾기(답 카드 흉내)": lambda q: (qq.search(q["text"]), True),
    }
    out = {
        "corpus": ix.version,
        "chunks": ix.n,
        "chunks_with_hints": n_hint_chunks,
        "dense_questions": len(dense),
        "conf": bm25.CONF["version"],
        "results": {},
    }
    split_sets = [("dev", {"dev"})] + ([("held-out", {"heldout"})] if a.final else [])
    for label, splits in split_sets:
        todo = dict(current) | (variants if label == "dev" else {})
        for name, fn in todo.items():
            rank = rank_with(fn, qs)
            rep = report(rank, qs, splits)
            k, n, ci = hit5_ci(rank, qs, splits)
            per_set = {}
            for s in SETS:
                sub = [q for q in qs if q["set"] == s]
                per_set[s] = report(rank, sub, splits)["전체"]
            out["results"].setdefault(label, {})[name] = {
                "all": rep["전체"],
                "by_trade": {t: rep[t] for t in ("도배", "목공", "공통") if t in rep},
                "hit5": f"{k}/{n}",
                "hit5_ci95": ci,
                "per_set": per_set,
                "no_source_flagged": rep["답 없음 → 자료 부족 판단"],
            }
            m = rep["전체"]
            print(
                f"[{label}] {name}: hit@5 {m['hit@5']} {ci} · MRR {m['mrr']} · hit@1 {m['hit@1']} · "
                f"recall@5 {m['recall@5']} · nDCG@5 {m['ndcg@5']} (n {m['n']}) · "
                f"90세트 hit@5 {per_set['90']['hit@5']} · 300세트 {per_set['300']['hit@5']} · "
                f"자료 없음 질문 '부족' 판단 {rep['답 없음 → 자료 부족 판단']['rate']}"
            )
    path = save(f"e2_retrieval_{'final' if a.final else 'dev'}.json", out)
    print(
        f"저장: {path.relative_to(ROOT)} · 조각 {ix.n} (예시 질문 있는 조각 {n_hint_chunks}) · 의미 순위 {len(dense)}문항"
    )


if __name__ == "__main__":
    main()
