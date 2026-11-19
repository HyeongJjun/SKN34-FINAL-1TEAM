"""E4 단일 vs 다중: 여러 공종이 섞인 질문을 한 번에 답할지, 오케스트레이터가 나눠 합칠지. 코드 채점 + 출력 JSONL.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e4_multi.py            # dev
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e4_multi.py --final    # held-out 한 번

세트: evaluation/v3/sets/multi.jsonl (B5가 씀, 45문항, 글자 sha1 % 3 == 0이면 held-out). parts = 답해야 할 공종들,
single = 한 공종 질문(나누면 안 됨).
비교안
- 단일: 공종 담당 한 번(관문 첫 공종 하나, 오케스트레이터 없음)
- 다중: 오케스트레이터(나누기 → 공종마다 담당 → 공정 순서로 합치기 + 순서 문장)
- 관문: 실제 제품 한 턴(관문이 단일 · 다중을 고름)
지표(코드): 조각 덮기(기대 공종마다 내용이 있는 묶음), 실패 조각, 한 공종 질문을 나눈 수, 공정 순서 위반, 묶음 수.
"""

import argparse
import itertools
import json
import uuid
from collections import Counter

from common import RESULTS, ROOT, jsonl, save, utf8_stdout, wilson
from kb3 import TODAY, kb, turn

from app.agent.v3 import orchestrator, templates, trade_agent
from app.agent.v3.answer import Task
from app.agent.v3.policy import policy_of
from app.agent.v3.schemas import TurnContext
from app.agent.v3.trades import BY_CODE, trades_in

SET = ROOT / "evaluation/v3/sets/multi.jsonl"
CTX = TurnContext(user_id=uuid.UUID(int=0), today=TODAY)


def sections_of(part_or_answer) -> list[dict]:
    return [
        {"source": s.source, "trade": s.trade, "title": s.title,
         "sentences": [{"text": x.text, "cites": x.cites} for x in s.sentences]}
        for s in part_or_answer.sections
    ]  # fmt: skip


def run_single(text: str) -> tuple[list[dict], int]:
    tr = trades_in(text)[:1]
    t = Task(text=text, route="trade", trades=tr, policy=policy_of(text), ctx=CTX)
    return sections_of(trade_agent.run(t, kb())), 0


def run_multi(text: str) -> tuple[list[dict], int]:
    t = Task(text=text, route="multi", trades=trades_in(text), policy=policy_of(text), ctx=CTX)
    part, _, failed = orchestrator.run(t, kb())
    return sections_of(part), failed


def run_gate(text: str) -> tuple[list[dict], str, int]:
    a = turn(text).answer
    return sections_of(a), a.trace.route, a.trace.failed_parts


def judge(q: dict, secs: list[dict], failed: int) -> dict:
    """failed: 오케스트레이터가 센 못 찾은 조각 수. 합칠 때 '확인하지 못했어요'를 한 줄로 모아서 글로 세지 않아요."""
    ok_trades = {
        s["trade"]
        for s in secs
        if s["trade"] and s["sentences"] and s["sentences"][0]["text"] != templates.PART_FAILED
        and s["title"] != "[순서]"
    }  # fmt: skip
    covered = sum(1 for p in q["parts"] if p in ok_trades)
    order = [
        s["trade"]
        for s in secs
        if s["trade"] in BY_CODE and s["trade"] != "common" and s["title"] != "[순서]"
    ]
    seq = list(dict.fromkeys(order))
    viol = sum(1 for a, b in itertools.pairwise(seq) if BY_CODE[a].order > BY_CODE[b].order)
    split_single = q["single"] and len({t for t in ok_trades if t != "common"}) > 1
    return {"covered": covered, "parts": len(q["parts"]), "failed": failed, "order_violations": viol,
            "split_single": split_single, "sections": len(secs),
            "order_sentence": any(s["title"] == "[순서]" for s in secs)}  # fmt: skip


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    split = "heldout" if a.final else "dev"
    qs = [q for q in jsonl(SET) if q["split"] == split]
    out: dict = {"split": split, "n": len(qs), "variants": {}}
    RESULTS.mkdir(parents=True, exist_ok=True)
    path = RESULTS / f"e4_outputs_{split}.jsonl"
    rows = []
    for q in qs:
        g_secs, g_route, g_failed = run_gate(q["text"])
        for name, (secs, failed) in (
            ("단일", run_single(q["text"])),
            ("다중", run_multi(q["text"])),
            ("관문", (g_secs, g_failed)),
        ):
            j = judge(q, secs, failed)
            rows.append({"qid": q["id"], "variant": name, "question": q["text"], "parts": q["parts"],
                         "single": q["single"], "sections": secs, "score": j,
                         "gate_route": g_route if name == "관문" else None})  # fmt: skip
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    for name in ("단일", "다중", "관문"):
        rs = [r for r in rows if r["variant"] == name]
        multi = [r for r in rs if not r["single"]]
        c = Counter()
        for r in multi:
            c["covered"] += r["score"]["covered"]
            c["parts"] += r["score"]["parts"]
            c["full"] += r["score"]["covered"] == r["score"]["parts"]
        out["variants"][name] = {
            "multi_questions": len(multi),
            "part_coverage": round(c["covered"] / max(c["parts"], 1), 3),
            "part_coverage_ci95": wilson(c["covered"], max(c["parts"], 1)),
            "all_parts_answered": f"{c['full']}/{len(multi)}",
            "failed_parts": sum(r["score"]["failed"] for r in rs),
            "order_violations": sum(r["score"]["order_violations"] for r in rs),
            "single_questions_split": f"{sum(r['score']['split_single'] for r in rs if r['single'])}/{sum(1 for r in rs if r['single'])}",
            "mean_sections": round(sum(r["score"]["sections"] for r in rs) / max(len(rs), 1), 2),
            "order_sentence_rate": round(sum(r["score"]["order_sentence"] for r in multi) / max(len(multi), 1), 3),
        }  # fmt: skip
        print(f"[{split}] {name}: {out['variants'][name]}")
    gate_routes = Counter(r["gate_route"] for r in rows if r["variant"] == "관문")
    out["gate_routes"] = dict(gate_routes)
    print(f"관문이 고른 길: {dict(gate_routes)}")
    p = save(f"e4_multi_{split}.json", out)
    print(f"저장: {p.relative_to(ROOT)} · 출력 {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
