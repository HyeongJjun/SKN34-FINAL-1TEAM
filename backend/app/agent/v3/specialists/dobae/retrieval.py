"""도배 질문에 쓰는 검색어."""

import re

_TILE_SURFACE = re.compile(r"타일(?:을 붙인|로 마감한)?\s*(?:벽|바탕|위)")


def search_query(question: str) -> str:
    # 기존 검색은 앞 80자만 쓰므로 시공 대상 바탕을 앞에 보탠다.
    if _TILE_SURFACE.search(question):
        return f"타일 바탕면 {question}"
    return question
