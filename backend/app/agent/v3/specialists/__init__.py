"""공종별 검색과 프롬프트 등록. 등록하지 않은 항목은 공통 동작을 쓴다."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.agent.v3.specialists.dobae import retrieval


@dataclass(frozen=True)
class Specialist:
    search_query: Callable[[str], str] | None = None
    prompt_path: Path | None = None


SPECIALISTS = {
    "dobae": Specialist(
        search_query=retrieval.search_query,
        prompt_path=Path(__file__).parent / "dobae" / "prompt_v1.md",
    ),
}
