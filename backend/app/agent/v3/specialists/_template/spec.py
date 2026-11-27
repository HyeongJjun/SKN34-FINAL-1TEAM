"""새 공종의 표시 이름, 분류 단어, 검색 태그를 설정한다."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agent.v3.trades import Slot, TradeSpec


def build(spec_type: type[TradeSpec], slot_type: type[Slot]) -> TradeSpec:
    return spec_type(
        code=Path(__file__).parent.name,
        ko="공종 이름",
        depth="knowledge",
        words=r"공종명|관련 단어",  # 질문에서 공종을 찾을 단어
        tags=(),  # 적재 자료의 공종 태그 예시: ("공종명",)
        order=10,  # 팀에서 정한 공정 순서로 바꾼다.
    )
