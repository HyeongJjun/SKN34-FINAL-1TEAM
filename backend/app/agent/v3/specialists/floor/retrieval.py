"""바닥 상담에 쓰는 키워드 검색(바닥 공종 무게)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.knowledge import search3

if TYPE_CHECKING:
    from app.agent.v3.answer import KB
    from app.knowledge.bm25 import Result

K = 8  # 검색 자리


def retrieve(kb: KB, question: str) -> Result:
    return search3.search(kb.ix, question, trades=["floor"], tags=kb.tags, k=K)
