"""회원 상태 바꾸기 (관리자 정지 · 풀기, A03). users · user_sessions는 auth 표지만 회원 관리 기능이
여기 있어서 상태 칸만 바꾼다(auth.service에 함수가 생기면 그것을 부른다, b1b.md 부탁)."""

import uuid

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserSession


async def set_status(s: AsyncSession, user_id: uuid.UUID, status: str) -> bool:
    """고객 · 업체 회원의 상태를 바꾼다(관리자는 못 바꿈). 이미 그 상태면 False.
    정지하면 로그인 세션을 모두 지운다(다음 요청부터 401, 실시간 줄기는 60초 안에 닫힘)."""
    q = (
        update(User)
        .where(User.id == user_id, User.role != "admin", User.status != status)
        .values(status=status)
        .returning(User.id)
        .execution_options(synchronize_session=False)
    )
    changed = (await s.execute(q)).scalar_one_or_none() is not None
    if changed and status == "suspended":
        await s.execute(delete(UserSession).where(UserSession.user_id == user_id))
    return changed
