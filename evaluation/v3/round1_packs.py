"""개선 1회차 쓰기 묶음 (dev만 씀, held-out 안 봄). LLM · DB 없음.

    cd backend && uv run --no-sync python ../evaluation/v3/round1_packs.py

1. 카드 보강 묶음 `.cache/packs_r1/cards_<묶음>.md`: 판정에서 '카드 없음 · 아깝게 놓침'이 난 dev 질문을 공종별로,
   질문마다 검색 위 8조각(+ RAG 정답 조각) 원문과 그 공종의 지금 카드 목록. 카드 쓰는 하위 에이전트는 이 파일만 본다.
2. 해요체 요약 묶음 `.cache/summ_r1/batch_<n>.jsonl`: 자주 뽑히는 화면 표시 조각 상위 400개(dev 질문 + 카드 열쇠로 검색한
   위 8개에 든 횟수) + v3 지식 조각(표시 none 빼고). 요약 쓰는 하위 에이전트가 한 줄에 하나씩 summary_haeyo를 단다.
"""

import hashlib
import json
from collections import Counter, defaultdict

from common import CACHE, HERE, RESULTS, ROOT, jsonl, utf8_stdout
from kb3 import bank, kb

from app.agent.v3.answer import search
from app.agent.v3.trades import BY_CODE, trades_in
from app.knowledge import extract

RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
KO = {"도배": "dobae", "목공": "mokgong", "공통": "common"}
GROUPS = {
    "dobae": ("dobae",),
    "mokgong_common": ("mokgong", "common"),
}  # 나머지 공종은 'others' 한 묶음
TOP_SUMMARY = 400
BATCHES = 6
CUT = 600


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def first_trade(q: str) -> str | None:
    t = trades_in(q)
    return t[0] if t else None


def main() -> None:
    utf8_stdout()
    K = kb()
    pack = {r["pid"]: r for r in jsonl(HERE / "judge_packs/e3_c_dev.jsonl")}
    fail = json.loads((RESULTS / "judge_fail_dev.json").read_text(encoding="utf-8"))
    rag = {q["id"]: q for p in RAG for q in jsonl(p)}
    # 1) 카드 보강 묶음
    todo: dict[str, list[dict]] = defaultdict(list)
    for r in fail["A"]:
        if not ({"카드 없음", "맞추기 기준(아깝게 놓침)"} & set(r["causes"])):
            continue
        it = pack[r["pid"]]
        rq = rag.get(r["qid"], {})
        trade = it.get("trade") or KO.get(rq.get("trade", ""), "common")
        group = next((g for g, ts in GROUPS.items() if trade in ts), "others")
        hits = search(K, it["question"], trade if trade != "common" else None).hits[:8]
        refs = [h.ref for h in hits] + [
            g["ref"] for g in rq.get("gold", []) if g["ref"] not in {h.ref for h in hits}
        ]
        todo[group].append(
            {"trade": trade, "question": it["question"], "topic": rq.get("topic", ""), "refs": refs}
        )
    out = CACHE / "packs_r1"
    out.mkdir(parents=True, exist_ok=True)
    for group, items in todo.items():
        lines = [
            f"# 카드 보강 묶음: {group} (개선 1회차, dev 판정에서 카드가 없거나 아깝게 놓친 질문)",
            "",
        ]
        trades = sorted({x["trade"] for x in items})
        lines += ["## 지금 있는 카드(같은 주제를 또 만들지 말아요)", ""]
        for c in K.cards.cards:
            if c.trade in trades:
                lines.append(f"- `{c.id}`: {c.keys[0]}")
        lines += ["", "## 주제 후보와 근거 조각", ""]
        for n, x in enumerate(items, 1):
            lines += [
                f"### {n}. [{x['trade']}] {x['question']}"
                + (f" (주제: {x['topic']})" if x["topic"] else ""),
                "",
            ]
            for ref in x["refs"]:
                item = K.ix.by_ref.get(ref)
                if item is None:
                    continue
                book = " ⚠책" if item.doc.kind == "book" else ""
                text = item.chunk.text.replace("\n", " ")[:CUT]
                lines.append(f"- **{ref}**{book} ({item.doc.kind} · {item.doc.title[:40]}): {text}")
            lines.append("")
        (out / f"cards_{group}.md").write_text("\n".join(lines), encoding="utf-8")
        print(f"카드 묶음 {group}: {len(items)}주제 · 공종 {trades}")
    # 2) 요약 묶음: dev 질문 + 카드 열쇠로 검색한 위 8개 빈도
    qs = [q["text"] for q in bank("dev")] + [
        q["text"] for p in RAG for q in jsonl(p) if q.get("split") == "dev"
    ]
    qs += [k for c in K.cards.cards for k in c.keys]
    freq: Counter = Counter()
    for q in qs:
        for h in search(K, q, first_trade(q)).hits[:8]:
            item = K.ix.by_ref.get(h.ref)
            if item and extract.display_of(item.doc.kind) != "none":
                freq[h.ref] += 1
    top = [r for r, _ in freq.most_common(TOP_SUMMARY)]
    v3 = [
        it.chunk.ref
        for it in K.ix.items
        if it.chunk.ref.startswith("K2")
        and len(it.chunk.ref) == 6
        and extract.display_of(it.doc.kind) != "none"
    ]
    refs = list(dict.fromkeys(top + v3))
    rows = []
    for ref in refs:
        it = K.ix.by_ref[ref]
        rows.append({"ref": ref, "sha": sha(it.chunk.text), "kind": it.doc.kind, "display": extract.display_of(it.doc.kind),
                     "title": it.doc.title[:60], "text": it.chunk.text})  # fmt: skip
    sdir = CACHE / "summ_r1"
    sdir.mkdir(parents=True, exist_ok=True)
    size = -(-len(rows) // BATCHES)
    for b in range(BATCHES):
        part = rows[b * size : (b + 1) * size]
        (sdir / f"batch_{b + 1}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in part) + "\n", encoding="utf-8"
        )
    print(
        f"요약 대상 {len(rows)}개(상위 {len(top)} + v3 {len(v3)}, 겹침 {len(top) + len(v3) - len(rows)}) → {BATCHES}묶음 × {size}"
    )
    print(
        "공종 표시:",
        Counter(
            BY_CODE[t].ko for g in todo.values() for x in g for t in [x["trade"]] if t in BY_CODE
        ),
    )


if __name__ == "__main__":
    main()
