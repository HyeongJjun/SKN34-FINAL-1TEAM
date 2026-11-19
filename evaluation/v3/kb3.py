"""v3 실험 공용: 말뭉치(corpus3) 색인 + 카드 + 질문 은행 + 무료 모드 한 턴. LLM · DB 없음(유료 0회).

- 질문 은행: data/v3/questions/*.jsonl (데이터 담당, dev : held-out ≈ 2 : 1, split 칸). held-out은 고르기에 쓰지 않는다.
- 정답 담당(route): expect=out_of_scope → out_of_scope, 공종이 common → guide, 그 밖 → trade. 정답 공종 = trade 칸.
"""

import asyncio
import uuid
from datetime import date
from functools import cache

from common import ROOT, corpus_path, jsonl
from rank_server import load_index

from app.agent.v3.answer import KB
from app.agent.v3.schemas import TurnContext
from app.agent.v3.turn import run_turn
from app.knowledge import cards

QDIR = ROOT / "data/v3/questions"
TODAY = date(2026, 11, 19)


@cache
def kb() -> KB:
    return KB(ix=load_index(corpus_path()), cards=cards.default())


def bank(split: str | None = None) -> list[dict]:
    rows = [q for f in sorted(QDIR.glob("*.jsonl")) for q in jsonl(f)]
    for q in rows:
        q["gold_route"] = (
            "out_of_scope"
            if q["expect"] == "out_of_scope"
            else ("guide" if q["trade"] == "common" else "trade")
        )
    return [q for q in rows if split is None or q["split"] == split]


def turn(text: str, *, facts=None, view=None, waiting=None, button=None):
    ctx = TurnContext(user_id=uuid.UUID(int=0), today=TODAY, view=view)
    return asyncio.run(run_turn(text, ctx, kb=kb(), facts=facts, waiting=waiting, button=button))
