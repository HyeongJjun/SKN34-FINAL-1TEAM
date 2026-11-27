"""도배 상담 시작점."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agent.v3.answer import KB, Part, Task
    from app.agent.v3.specialists import TradeRunner


def run(task: Task, kb: KB, run_common: TradeRunner) -> Part:
    # 분기 없는 공통 상담을 받아 기존 도배 답변·되묻기 동작을 이어간다.
    return run_common(task, kb)
