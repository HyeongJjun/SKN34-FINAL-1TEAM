"""채점 묶음 만들기 (뜻 채점은 리드가 독립 하위 에이전트에게 맡김, PLAN 5절). LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/judge_pack.py

만드는 것 (evaluation/v3/judge_packs/)
- e3_c_dev.jsonl: E3 설계안(C) 답 중 내용이 있는 것 전부(문항 · 답 평문 · 보인 근거 원문 · 기대 행동)
- e3_abc_dev.jsonl: 공종별로 고른 30문항 × 비교안 A · B · C(이름을 지운 무작위 id, 섞음)
- e4_pairs_dev.jsonl: 여러 공종 질문 × (단일, 다중) 쌍, 두 순서(AB · BA)
- *_key.jsonl: id → 문항 · 비교안 (판정자에게 주지 않음)
- 답은 형식을 지운 평문(제목 · 굵게 없음, 길이 그대로), 근거는 조각마다 500자까지(책 조각은 '원문 안 보임'만)
"""

import json
import random
from collections import defaultdict

from common import HERE, RESULTS, ROOT, jsonl, utf8_stdout
from kb3 import bank, kb

from app.agent.v3.trades import rules

OUT = HERE / "judge_packs"
RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
SEED = 20261119


def plain(r: dict) -> str:
    lines = [x["text"] for s in r["sections"] for x in s["sentences"]] + r.get("unknown", [])
    return " ".join(lines)


def evidence(r: dict) -> list[dict]:
    """답이 인용한 조각 원문(6개까지) + 계산 엔진 규칙(rule:). 규칙은 판정자가 '근거 없음'으로 잘못 매기지 않게 같이 준다."""
    ix = kb().ix
    cites = [c for s in r["sections"] for x in s["sentences"] for c in x["cites"]]
    refs = list(dict.fromkeys(c for c in cites if c.startswith("K")))
    rs = rules()
    out = [
        {"ref": c, "source": rs[c]["title"], "kind": "rule", "text": rs[c]["text"]}
        for c in dict.fromkeys(cites)
        if c in rs
    ]
    for ref in refs[:6]:
        x = ix.by_ref.get(ref)
        if x is None:
            continue
        text = (
            "(시공 안내서: 원문은 화면에 안 보여요. 요지만 판정에 써요)\n" + x.chunk.text[:500]
            if x.doc.kind == "book"
            else x.chunk.text[:500]
        )
        out.append({"ref": ref, "source": x.doc.title[:60], "kind": x.doc.kind, "text": text})
    return out


def expect_of(qid: str, qmap: dict) -> dict:
    q = qmap.get(qid, {})
    e = {"expect": q.get("expect", "answer")}
    if "gold_route" in q:
        e |= {"trade": q["trade"], "kind": q.get("intent"), "route": q["gold_route"]}
    if q.get("expect") == "out_of_scope":
        e["must"] = (
            "믿집이 하지 않는 일이면 거절하고 할 수 있는 일로 안내해야 해요(업체 · 제품 하나 골라 주기, 대신 해 주기, 10공종 금액 계산)"
        )
    if q.get("expect") == "ask_back":
        e["must"] = (
            "고객 집을 직접 봐야 판단할 수 있으면 판정하지 말고 확인할 기준 · 실측 때 확인을 말해야 해요"
        )
    if q.get("expect") == "no_source":
        e["must"] = "믿집 자료에 없는 내용이면 지어내지 말고 '확인하지 못했어요'라고 해야 해요"
    return e


def main() -> None:
    utf8_stdout()
    rnd = random.Random(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    qmap = {q["id"]: q for q in bank()} | {q["id"]: q for p in RAG for q in jsonl(p)}
    rows = jsonl(RESULTS / "e3_outputs_dev.jsonl")
    by_q = defaultdict(dict)
    for r in rows:
        by_q[r["qid"]][r["variant"]] = r
    # 1) C 전부(내용 있는 답)
    c_items, c_key = [], []
    for qid, vs in by_q.items():
        r = vs.get("C")
        if r and any(s["source"] in ("card", "extract") for s in r["sections"]):
            pid = f"c{rnd.randrange(16**8):08x}"
            c_items.append({"pid": pid, "question": r["question"], "answer": plain(r), "evidence": evidence(r),
                            **expect_of(qid, qmap)})  # fmt: skip
            c_key.append({"pid": pid, "qid": qid, "variant": "C"})
    rnd.shuffle(c_items)
    # 2) A · B · C 비교: 공종별 고루 30문항(셋이 서로 다른 답을 낸 것)
    pool = defaultdict(list)
    for qid, vs in by_q.items():
        if len({plain(v) for v in vs.values() if v["variant"] in "ABC"}) >= 2:
            pool[qmap.get(qid, {}).get("trade", "rag")].append(qid)
    picked = []
    while len(picked) < 30 and any(pool.values()):
        for t in sorted(pool):
            if pool[t] and len(picked) < 30:
                picked.append(pool[t].pop(rnd.randrange(len(pool[t]))))
    abc_items, abc_key = [], []
    for qid in picked:
        for v in "ABC":
            r = by_q[qid][v]
            pid = f"m{rnd.randrange(16**8):08x}"
            abc_items.append({"pid": pid, "question": r["question"], "answer": plain(r), "evidence": evidence(r),
                              **expect_of(qid, qmap)})  # fmt: skip
            abc_key.append({"pid": pid, "qid": qid, "variant": v})
    rnd.shuffle(abc_items)
    # 3) E4 쌍: 단일 vs 다중, 두 순서
    e4 = jsonl(RESULTS / "e4_outputs_dev.jsonl")
    pairs, pair_key = [], []
    by4 = defaultdict(dict)
    for r in e4:
        by4[r["qid"]][r["variant"]] = r
    for qid, vs in by4.items():
        if vs["단일"]["single"]:
            continue
        s, m = vs["단일"], vs["다중"]
        for first, second, order in ((s, m, "단일-다중"), (m, s, "다중-단일")):
            pid = f"p{rnd.randrange(16**8):08x}"
            pairs.append({"pid": pid, "question": s["question"], "expected_parts": s["parts"],
                          "answer_1": plain(first), "answer_2": plain(second),
                          "evidence": evidence(first) + evidence(second)})  # fmt: skip
            pair_key.append({"pid": pid, "qid": qid, "order": order})
    rnd.shuffle(pairs)
    for name, items in (("e3_c_dev", c_items), ("e3_abc_dev", abc_items), ("e4_pairs_dev", pairs)):
        (OUT / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in items) + "\n", encoding="utf-8"
        )
    for name, items in (
        ("e3_c_dev_key", c_key),
        ("e3_abc_dev_key", abc_key),
        ("e4_pairs_dev_key", pair_key),
    ):
        (OUT / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in items) + "\n", encoding="utf-8"
        )
    print(
        f"e3_c_dev {len(c_items)} · e3_abc_dev {len(abc_items)}({len(picked)}문항) · e4_pairs_dev {len(pairs)} → {OUT.relative_to(ROOT)}"
    )


def main_c2() -> None:
    """개선 1회차 묶음 e3_c2_dev(90): 지난 판정(e3_c_dev)과 같은 질문 — 판정자 B가 본 72개 전부 + 나머지에서 18개(씨앗 고정).
    답은 지금 코드로 다시 돌린 results/e3_outputs_dev.jsonl의 C. 열쇠에 지난 pid를 남겨 같은 질문끼리 비교해요."""
    utf8_stdout()
    rnd = random.Random(SEED + 2)
    qmap = {q["id"]: q for q in bank()} | {q["id"]: q for p in RAG for q in jsonl(p)}
    key = {r["pid"]: r for r in jsonl(OUT / "e3_c_dev_key.jsonl")}
    sub = [r["pid"] for r in jsonl(OUT / "chunks" / "e3_c_dev_sub_b.jsonl")]
    rest = sorted(set(key) - set(sub))
    chosen = sub + rnd.sample(rest, 90 - len(sub))
    now = {r["qid"]: r for r in jsonl(RESULTS / "e3_outputs_dev.jsonl") if r["variant"] == "C"}
    items, keys = [], []
    for prev in chosen:
        qid = key[prev]["qid"]
        r = now[qid]
        pid = f"n{rnd.randrange(16**8):08x}"
        items.append({"pid": pid, "question": r["question"], "answer": plain(r), "evidence": evidence(r),
                      **expect_of(qid, qmap)})  # fmt: skip
        keys.append(
            {
                "pid": pid,
                "qid": qid,
                "variant": "C2",
                "prev_pid": prev,
                "judged_by_b_before": prev in sub,
            }
        )
    rnd.shuffle(items)
    for name, rows in (("e3_c2_dev", items), ("e3_c2_dev_key", keys)):
        (OUT / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8"
        )
    print(
        f"e3_c2_dev {len(items)}(지난 B 판정 {len(sub)} + 나머지 {90 - len(sub)}) → {OUT.relative_to(ROOT)}"
    )


def main_c3() -> None:
    """개선 2회차 묶음 e3_c3_dev(90): e3_c2_dev와 같은 90문항. 열쇠 prev_pid = c2의 pid(그 판정과 짝)."""
    utf8_stdout()
    rnd = random.Random(SEED + 3)
    qmap = {q["id"]: q for q in bank()} | {q["id"]: q for p in RAG for q in jsonl(p)}
    prev_rows = jsonl(OUT / "e3_c2_dev_key.jsonl")
    now = {r["qid"]: r for r in jsonl(RESULTS / "e3_outputs_dev.jsonl") if r["variant"] == "C"}
    items, keys = [], []
    for k in prev_rows:
        r = now[k["qid"]]
        pid = f"r{rnd.randrange(16**8):08x}"
        items.append({"pid": pid, "question": r["question"], "answer": plain(r), "evidence": evidence(r),
                      **expect_of(k["qid"], qmap)})  # fmt: skip
        keys.append({"pid": pid, "qid": k["qid"], "variant": "C3", "prev_pid": k["pid"]})
    rnd.shuffle(items)
    for name, rows in (("e3_c3_dev", items), ("e3_c3_dev_key", keys)):
        (OUT / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8"
        )
    print(f"e3_c3_dev {len(items)}(e3_c2_dev와 같은 문항) → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    import sys

    if "--c3" in sys.argv:
        main_c3()
    elif "--c2" in sys.argv:
        main_c2()
    else:
        main()
