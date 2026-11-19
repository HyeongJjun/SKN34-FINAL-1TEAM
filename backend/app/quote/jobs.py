"""quote 기한 일 처리 함수 (quote_valid_soon).

worker.JOB_HANDLERS가 이 HANDLERS를 모은다. 계약은 jobs.service.JobHandler:
새 세션에서 '아직 그 상태 · 기한이 지났을 때만' 바꾼다 → 바꿨으면 changed=True, 아니면 False.
commit은 worker.sweep_jobs가 하고, 돌려준 Outcome.unread의 사람에게 commit 뒤 안 읽은 알림 수를 보낸다.
"""

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.models import Job
from app.jobs.service import JobHandler, Outcome
from app.quote import service


async def quote_valid_soon(s: AsyncSession, job: Job, now: datetime) -> Outcome:
    """견적서 유효기간 3일 · 1일 전 18:00 (D20): 아직 고를 수 있는 최신 견적서면 고객 알림.
    이미 알렸거나 다시 올림 · 확정 · 닫힘 · 지남이면 아무것도 안 한다(두 번 불려도 한 번만)."""
    if job.ref_id is None:
        return Outcome(changed=False)
    owner = await service.on_valid_soon(s, job.ref_id, job.run_at, now)
    return Outcome(changed=owner is not None, unread=[owner] if owner else [])


HANDLERS: dict[str, JobHandler] = {service.VALID_SOON: quote_valid_soon}
