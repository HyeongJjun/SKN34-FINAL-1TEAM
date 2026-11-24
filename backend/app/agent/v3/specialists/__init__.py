"""공종별 상담 실행·검색·프롬프트 등록. 등록하지 않은 항목은 공통 동작을 쓴다."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from app.agent.v3.specialists.dobae import agent, retrieval

if TYPE_CHECKING:
    from app.agent.v3.answer import KB, Part, Task
    from app.knowledge.bm25 import Result

type TradeRunner = Callable[[Task, KB], Part]


@dataclass(frozen=True)
class Specialist:
    retrieve: Callable[[KB, str], Result] | None = None
    prompt_path: Path | None = None
    run: Callable[[Task, KB, TradeRunner], Part] | None = None


SPECIALISTS = {
    "dobae": Specialist(
        retrieve=retrieval.retrieve,
        prompt_path=Path(__file__).parent / "dobae" / "prompt_v1.md",
        run=agent.run,
    ),
}
