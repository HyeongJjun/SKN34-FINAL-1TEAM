"""공종 답변을 만드는 시작점."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agent.v3.answer import KB, Part, Task
    from app.agent.v3.specialists import TradeRunner


def run(task: Task, kb: KB, run_common: TradeRunner) -> Part:
    return run_common(task, kb)
