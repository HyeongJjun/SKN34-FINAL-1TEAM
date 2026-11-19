"""E3 답 방식: A 카드만 · B 조각 문장만 · C 카드 → 조각 → 모름(설계안). 코드 채점 + 출력 JSONL. LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e3_answers.py            # dev: 기준값 고르기 + 출력
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e3_answers.py --final    # held-out 한 번(고른 기준값으로)

세트
- 질문 은행(data/v3/questions): 13공종 · expect(answer · ask_back · out_of_scope)
- RAG 질문(evaluation/rag 90 + 300): 정답 조각(gold) · expect(answer · no_source · engine)
코드 채점(뜻 채점은 judge_packs로 하위 에이전트가 따로)
- 답함: 카드 · 조각 묶음이 있음 / 인용: 카드 · 조각 문장마다 조각 번호 / 지어낸 숫자: 인용 원문에 없는 숫자(0이어야)
- 공종 맞음(은행 trade): 내용 묶음 공종 ∈ {정답 공종, 공통} / 범위 밖 처리(은행 out_of_scope): 범위 밖 · 거절 정책 글
- 되묻기 질문(은행 ask_back): 정책 글(우리 집 · 가격 · 기간 · 하자) 또는 '확인하지 못했어요' 또는 되묻기 칸
- 근거 맞음(RAG answer): 인용 조각 ∩ 정답 조각(grade ≥ 1) / 자료 없음(RAG no_source): 내용 묶음 없이 끝남
기준값 고르기(dev만): T_CARD × T_HIGH 격자에서 RAG 근거 맞음 · 답한 비율 · 자료 없음 오답을 보고 고른다.
"""

import argparse
import json
from collections import Counter
from contextlib import contextmanager

from common import RESULTS, ROOT, jsonl, save, utf8_stdout, wilson
from kb3 import bank, kb, turn

from app.agent.v3 import answer as ans_mod
from app.knowledge import extract
from app.v2 import guard

RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
REFUSE_TEXT = ("추천하지 않아요", "도와드리기 어려워요", "법률 판단", "금액을 계산해요")
ASKBACK_TEXT = (
    "직접 봐야",
    "확인하지 못했어요",
    "판정하지 않아요",
    "계산해 드려요",
    "업체가 정해요",
    "견적서에서 확인",
)
GRID_CARD = (0.40, 0.45, 0.50, 0.55)
GRID_BONUS = (0.10, 0.15, 0.20)  # 위 3개 덤(위 8개는 절반)
T_HIGH = 0.62


def rag_questions(split: str) -> list[dict]:
    return [q for p in RAG for q in jsonl(p) if q["split"] == split]


@contextmanager
def variant(name: str, t_card: float | None = None, bonus: float | None = None):
    """A: 조각 문장 끔 · B: 카드 끔 · C: 그대로 · K: C에서 맞물림 후보 · 덤 끔(열쇠 점수만, 이전 방식).
    기준값을 잠깐 바꾼다."""
    old = (
        ans_mod.T_CARD,
        ans_mod.B3,
        ans_mod.B8,
        extract.pick,
        ans_mod.cards.find,
        ans_mod.cards.score,
    )
    if t_card is not None:
        ans_mod.T_CARD, ans_mod.B3, ans_mod.B8 = t_card, bonus, bonus / 2
    if name == "A":
        ans_mod.extract.pick = lambda *a, **k: []
    if name == "B":
        ans_mod.cards.find = lambda *a, **k: []
        ans_mod.cards.score = lambda *a, **k: []
    if name == "K":
        ans_mod.cards.score = lambda *a, **k: []
        ans_mod.B3 = ans_mod.B8 = 0.0
    try:
        yield
    finally:
        (ans_mod.T_CARD, ans_mod.B3, ans_mod.B8, extract.pick, ans_mod.cards.find,
         ans_mod.cards.score) = old  # fmt: skip


def record(q: dict, name: str, res) -> dict:
    a = res.answer
    secs = [
        {"source": s.source, "trade": s.trade, "title": s.title,
         "sentences": [{"text": x.text, "cites": x.cites} for x in s.sentences]}
        for s in a.sections
    ]  # fmt: skip
    return {
        "qid": q["id"], "variant": name, "question": q["text"], "route": a.trace.route,
        "trades": a.trace.trades, "policy": a.trace.policy, "sections": secs, "unknown": a.unknown,
        "calc": [c.model_dump(mode="json", include={"label", "ref", "amount", "note"}) for c in a.calc],
        "cards_ui": [c.kind for c in a.cards], "ask": a.ask.slot if a.ask else None,
        "used_cards": a.trace.cards, "used_chunks": a.trace.chunks,
    }  # fmt: skip


def content(r: dict) -> list[dict]:
    return [s for s in r["sections"] if s["source"] in ("card", "extract", "llm")]


def fabricated(r: dict) -> int:
    ix = kb().ix
    bad = 0
    for s in content(r):
        for x in s["sentences"]:
            refs = [c for c in x["cites"] if c.startswith("K") and c in ix.by_ref]
            if not refs:
                continue
            src = " ".join(ix.by_ref[c].chunk.text + " " + ix.by_ref[c].doc.title for c in refs)
            # 카드 · 조각 문장의 숫자는 인용 조각 원문(+ 문서 이름)에 있어야 한다
            bad += guard._why(x["text"], guard.numbers(src), None) is not None
    return bad


def plain_text(r: dict) -> str:
    return (
        " ".join(x["text"] for s in r["sections"] for x in s["sentences"])
        + " "
        + " ".join(r["unknown"])
    )


def score_bank(rows: list[tuple[dict, dict]]) -> dict:
    c = Counter()
    for q, r in rows:
        c["n"] += 1
        has = bool(content(r))
        c["answered"] += has
        c["fabricated"] += fabricated(r)
        if q["gold_route"] in ("trade", "guide") and q["expect"] == "answer":
            c["n_answer"] += 1
            c["answered_answer"] += has
            if has:
                c["trade_n"] += 1
                c["trade_ok"] += all(s["trade"] in (q["trade"], "common", None) for s in content(r))
        if q["expect"] == "out_of_scope":
            c["n_out"] += 1
            t = plain_text(r)
            c["out_ok"] += r["route"] == "out_of_scope" or any(w in t for w in REFUSE_TEXT)
        if q["expect"] == "ask_back":
            c["n_ask"] += 1
            t = plain_text(r)
            c["ask_ok"] += bool(r["ask"]) or any(w in t for w in ASKBACK_TEXT)
    out = {
        "n": c["n"], "answered_rate": round(c["answered"] / c["n"], 3),
        "answered_rate_on_answerable": f"{c['answered_answer']}/{c['n_answer']}",
        "trade_ok": f"{c['trade_ok']}/{c['trade_n']}", "fabricated_numbers": c["fabricated"],
        "out_of_scope_ok": f"{c['out_ok']}/{c['n_out']}", "ask_back_ok": f"{c['ask_ok']}/{c['n_ask']}",
    }  # fmt: skip
    out["answered_ci95"] = wilson(c["answered_answer"], c["n_answer"])
    return out


def score_rag(rows: list[tuple[dict, dict]]) -> dict:
    c = Counter()
    for q, r in rows:
        has = bool(content(r))
        cited = {
            x for s in content(r) for y in s["sentences"] for x in y["cites"] if x.startswith("K")
        }
        if q["expect"] == "answer" and q.get("gold"):
            gold = {g["ref"] for g in q["gold"] if g["grade"] >= 1}
            c["n"] += 1
            c["answered"] += has
            c["grounded"] += has and bool(cited & gold)
        elif q["expect"] == "no_source":
            c["n_none"] += 1
            c["none_answered"] += has
        elif q["expect"] == "engine":
            c["n_engine"] += 1
            c["engine_answered_text"] += has
        c["fabricated"] += fabricated(r)
    return {
        "n_answer": c["n"], "answered_rate": round(c["answered"] / max(c["n"], 1), 3),
        "grounded_given_answered": round(c["grounded"] / max(c["answered"], 1), 3),
        "grounded_ci95": wilson(c["grounded"], max(c["answered"], 1)),
        "grounded_of_all": round(c["grounded"] / max(c["n"], 1), 3),
        "no_source_answered": f"{c['none_answered']}/{c['n_none']}",
        "engine_answered_with_text": f"{c['engine_answered_text']}/{c['n_engine']}",
        "fabricated_numbers": c["fabricated"],
    }  # fmt: skip


def run(split: str, name: str, t: tuple[float, float] | None = None):
    qs_b = bank(split)
    qs_r = rag_questions(split)
    with variant(name, *(t or (None, None))):
        rb = [(q, record(q, name, turn(q["text"]))) for q in qs_b]
        rr = [(q, record(q, name, turn(q["text"]))) for q in qs_r]
    return rb, rr


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    ap.add_argument("--no-grid", action="store_true", help="격자 없이 제품 기본 기준값으로만")
    ap.add_argument("--t-card", type=float, help="카드 받는 기준을 바꿔 한 번(비교용, 격자 없음)")
    ap.add_argument("--tag", default="", help="결과 파일 이름 뒤에 붙일 말(예: _t045)")
    a = ap.parse_args()
    if a.t_card is not None:
        a.no_grid = True
    split = "heldout" if a.final else "dev"
    out: dict = {
        "split": split,
        "cards": kb().cards.version,
        "corpus": kb().ix.version,
        "grid": [],
        "variants": {},
    }
    chosen = (a.t_card if a.t_card is not None else ans_mod.T_CARD, ans_mod.B3)
    if not a.final and not a.no_grid:
        best = None
        for tc in GRID_CARD:
            for th in GRID_BONUS:
                rb, rr = run("dev", "A", (tc, th))
                sb, sr = score_bank(rb), score_rag(rr)
                row = {"t_card": tc, "bonus3": th, "bank": sb, "rag": sr}
                out["grid"].append(row)
                # 고르는 기준: RAG 근거 맞음(답한 것 중) × 답한 비율이 크고, 자료 없음 질문에 답한 수가 적은 것
                none_bad = int(sr["no_source_answered"].split("/")[0])
                key = (
                    sr["grounded_given_answered"] * 0.6
                    + sr["answered_rate"] * 0.4
                    - 0.01 * none_bad
                )
                if best is None or key > best[0]:
                    best = (key, (tc, th))
                print(f"[A {tc}/{th}] RAG 답함 {sr['answered_rate']} · 근거 맞음 {sr['grounded_given_answered']} · "
                      f"자료 없음에 답함 {sr['no_source_answered']} · 은행 답함 {sb['answered_rate_on_answerable']}")  # fmt: skip
        chosen = best[1]
        out["chosen"] = {"t_card": chosen[0], "bonus3": chosen[1], "t_high": T_HIGH}
    RESULTS.mkdir(parents=True, exist_ok=True)
    path = RESULTS / f"e3_outputs_{split}{a.tag}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for name in ("A", "B", "C", "K"):
            rb, rr = run(split, name, chosen)
            out["variants"][name] = {"bank": score_bank(rb), "rag": score_rag(rr)}
            for _, r in rb + rr:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            sb, sr = out["variants"][name]["bank"], out["variants"][name]["rag"]
            print(f"\n## {split} 변형 {name} (기준 {chosen})")
            print(f"- 은행: {sb}")
            print(f"- RAG: {sr}")
    out["chosen"] = {"t_card": chosen[0], "bonus3": chosen[1], "t_high": T_HIGH}
    p = save(f"e3_answers_{split}{a.tag}.json", out)
    print(f"\n저장: {p.relative_to(ROOT)} · 출력 {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
