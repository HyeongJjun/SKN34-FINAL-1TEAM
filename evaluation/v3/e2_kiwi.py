"""E2-5 Kiwi 형태소 BM25 vs 글자 두 개 묶음 BM25 (실험만, 제품에는 넣지 않음 — L20 · ADR agent-05).

    cd backend && uv run --with kiwipiepy python ../evaluation/v3/e2_kiwi.py

- kiwipiepy는 uv 임시 환경에만 들어가요(pyproject · uv.lock 그대로). 모델 패키지(kiwipiepy_model)도 같이 받아요.
- 같은 말뭉치(corpus3) · 같은 질문(RAG dev, 정답 조각)으로 두 낱말 나누기만 바꿔 BM25를 잰다(동의어 · 출처 등급 · 무게 없음).
- 형태소: 체언 · 용언 어간 · 외국어 · 숫자(NN* · VV · VA · XR · SL · SN · SH)만 쓴다.
"""

import json
import math
import time
from collections import Counter

from common import ROOT, corpus_path, jsonl, save, utf8_stdout, wilson
from metrics import scores

from app.knowledge import bm25

RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
K1, B = 1.2, 0.75
KEEP = ("NNG", "NNP", "NNB", "NR", "VV", "VA", "XR", "SL", "SN", "SH")


class BM25:
    def __init__(self, docs: list[tuple[str, list[str]]]):
        self.rows = [(ref, Counter(t), len(t)) for ref, t in docs]
        self.df = Counter(g for _, tf, _ in self.rows for g in tf)
        self.n = len(self.rows)
        self.avg = sum(n for *_, n in self.rows) / max(self.n, 1)

    def search(self, q: list[str], k: int = 10) -> list[str]:
        qs = list(dict.fromkeys(q))
        out = []
        for ref, tf, n in self.rows:
            s = 0.0
            for t in qs:
                f = tf.get(t)
                if f:
                    m = self.df[t]
                    s += (
                        math.log(1 + (self.n - m + 0.5) / (m + 0.5))
                        * f
                        * (K1 + 1)
                        / (f + K1 * (1 - B + B * n / self.avg))
                    )
            if s > 0:
                out.append((s, ref))
        return [r for _, r in sorted(out, reverse=True)[:k]]


def main() -> None:
    utf8_stdout()
    from kiwipiepy import Kiwi  # uv run --with kiwipiepy 로만

    kiwi = Kiwi()

    def morph(text: str) -> list[str]:
        return [f"{t.form}/{t.tag[:2]}" for t in kiwi.tokenize(text or "") if t.tag in KEEP]

    c = json.loads(corpus_path().read_text(encoding="utf-8"))
    docs = c["docs"]
    texts = [(x["k"], " ".join([x["text"], x["sec"], " ".join(x["hints"]), docs.get(x["doc"], {}).get("title", "")]))
             for x in c["chunks"]]  # fmt: skip
    t0 = time.time()
    kiwi_ix = BM25([(r, morph(t)) for r, t in texts])
    t_kiwi = time.time() - t0
    bi_ix = BM25([(r, bm25.grams(t)) for r, t in texts])
    qs = [
        q
        for p in RAG
        for q in jsonl(p)
        if q["split"] == "dev" and q["expect"] == "answer" and q.get("gold")
    ]
    out = {
        "corpus": c["version"],
        "n": len(qs),
        "kiwi_index_seconds": round(t_kiwi, 1),
        "results": {},
    }
    for name, ix, tok in (("글자 두 개 묶음 BM25", bi_ix, bm25.grams), ("Kiwi 형태소 BM25", kiwi_ix, morph),
                          ("두 점수 RRF", None, None)):  # fmt: skip
        agg = Counter()
        for q in qs:
            gold = {g["ref"]: g["grade"] for g in q["gold"]}
            if ix is None:
                fused: Counter = Counter()
                for r, ref in enumerate(bi_ix.search(bm25.grams(q["text"]), 30)):
                    fused[ref] += 1 / (60 + r + 1)
                for r, ref in enumerate(kiwi_ix.search(morph(q["text"]), 30)):
                    fused[ref] += 1 / (60 + r + 1)
                ranked = [r for r, _ in fused.most_common(10)]
            else:
                ranked = ix.search(tok(q["text"]), 10)
            s = scores(ranked, gold)
            for k in ("hit@1", "hit@5", "mrr"):
                agg[k] += s[k]
        n = len(qs)
        out["results"][name] = {"hit@1": round(agg["hit@1"] / n, 3), "hit@5": round(agg["hit@5"] / n, 3),
                                "hit5_ci95": wilson(int(agg["hit@5"]), n), "mrr": round(agg["mrr"] / n, 3)}  # fmt: skip
        print(f"[dev] {name}: {out['results'][name]} (n {n})")
    p = save("e2_kiwi_dev.json", out)
    print(f"저장: {p.relative_to(ROOT)} · Kiwi 색인 {t_kiwi:.1f}초")


if __name__ == "__main__":
    main()
