"""도배 상담에 쓰는 키워드 검색."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from app.knowledge import bm25, search3

if TYPE_CHECKING:
    from app.agent.v3.answer import KB

_TILE_SURFACE = re.compile(r"타일(?:을 붙인|로 마감한)?\s*(?:벽|바탕|위)")


def _search_query(question: str) -> str:
    # 기존 검색은 앞 80자만 쓰므로 시공 대상 바탕을 앞에 보탠다.
    if _TILE_SURFACE.search(question):
        return f"타일 바탕면 {question}"
    return question


def search(kb: KB, question: str) -> bm25.Result:
    query = _search_query(question)
    # 검색어를 보강해도 출처 제한은 고객의 원래 질문으로 판단한다.
    return search3.search(
        kb.ix,
        query,
        trades=["dobae"],
        tags=kb.tags,
        k=8,
        policy_text=question if query != question else None,
    )
