"""도배 상담에 필요한 자료를 키워드로 찾는다."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.agent.v3.specialists.dobae import keyword_search

if TYPE_CHECKING:
    from app.agent.v3.answer import KB
    from app.knowledge.bm25 import Result


def retrieve(kb: KB, question: str) -> Result:
    return keyword_search.search(kb, question)
