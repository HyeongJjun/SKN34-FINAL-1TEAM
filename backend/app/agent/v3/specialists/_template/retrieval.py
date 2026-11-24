"""공종 키워드 검색의 시작점."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from app.knowledge import search3

if TYPE_CHECKING:
    from app.agent.v3.answer import KB
    from app.knowledge.bm25 import Result


def retrieve(kb: KB, question: str) -> Result:
    code = Path(__file__).parent.name
    return search3.search(kb.ix, question, trades=[code], tags=kb.tags, k=8)
