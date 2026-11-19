"""held-out 최종 뜻 채점 묶음 (한 번만 만든다, 이 묶음으로 아무것도 고르지 않는다). LLM · DB 없음.

    cd backend && uv run --no-sync python ../evaluation/v3/heldout_pack.py   # judge_packs/e3_c3_heldout.jsonl + 열쇠

- 문항: held-out 질문 은행에서 공종마다 4개(13 × 4 = 52) + RAG held-out(도배 · 목공 · 공통)에서 8개 = 60개, 씨앗 고정.
  기대 행동(답 · 되묻기 · 범위 밖 · 자료 없음)은 고르지 않고 뽑힌 그대로 둔다.
- 답: 지금 제품 코드(무료 모드 C, 카드 416 · 요약 624 · iter2 조각)를 run_turn으로 한 번 돌린 것. 코드 채점 숫자는 내지 않는다.
- 판정 모양은 e3_c 묶음과 같다(rubric.md 판 2). 열쇠: pid → qid · 공종 · split.
"""

import asyncio
import json
import random
import uuid
from collections import defaultdict

from common import ROOT, jsonl, utf8_stdout
from judge_pack import OUT, RAG, evidence, expect_of, plain
from kb3 import TODAY, bank, kb

from app.agent.v3.schemas import TurnContext
from app.agent.v3.turn import run_turn

SEED = 20261121
PER_TRADE = 4
RAG_N = 8


def record(a) -> dict:
    """AgentAnswer → E3 출력과 같은 모양(plain · evidence가 읽는 칸만)."""
    return {
        "sections": [
            {
                "source": s.source,
                "title": s.title,
                "sentences": [{"text": x.text, "cites": x.cites} for x in s.sentences],
            }
            for s in a.sections
        ],
        "unknown": list(a.unknown),
    }


def main() -> None:
    utf8_stdout()
    rnd = random.Random(SEED)
    K = kb()
    by_trade: dict[str, list[dict]] = defaultdict(list)
    for q in bank("heldout"):
        by_trade[q["trade"]].append(q)
    picked = []
    for t in sorted(by_trade):
        qs = sorted(by_trade[t], key=lambda q: q["id"])
        picked += [(q, t) for q in rnd.sample(qs, min(PER_TRADE, len(qs)))]
    rag = sorted(
        (q for p in RAG for q in jsonl(p) if q.get("split") == "heldout"), key=lambda q: q["id"]
    )
    picked += [(q, "rag") for q in rnd.sample(rag, min(RAG_N, len(rag)))]
    qmap = {q["id"]: q for q in bank()} | {q["id"]: q for p in RAG for q in jsonl(p)}
    items, keys = [], []
    for q, group in picked:
        ctx = TurnContext(user_id=uuid.uuid4(), today=TODAY)
        r = record(asyncio.run(run_turn(q["text"], ctx, kb=K)).answer)
        pid = f"h{rnd.randrange(16**8):08x}"
        items.append({"pid": pid, "question": q["text"], "answer": plain(r), "evidence": evidence(r),
                      **expect_of(q["id"], qmap)})  # fmt: skip
        keys.append(
            {"pid": pid, "qid": q["id"], "variant": "C3", "split": "heldout", "group": group}
        )
    rnd.shuffle(items)
    for name, rows in (("e3_c3_heldout", items), ("e3_c3_heldout_key", keys)):
        (OUT / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8"
        )
    groups = defaultdict(int)
    for k in keys:
        groups[k["group"]] += 1
    print(f"e3_c3_heldout {len(items)}문항 → {OUT.relative_to(ROOT)} · 묶음별 {dict(groups)}")


if __name__ == "__main__":
    main()
