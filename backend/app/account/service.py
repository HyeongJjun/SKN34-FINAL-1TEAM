"""회원 탈퇴 · 관리자 회원 상태(정지 · 풀기). 여러 기능에 흩어진 내 데이터를 한 번에 지운다.

- 진행 중인 프로젝트가 있어도 막지 않는다 (가입보다 어려운 절차를 만들지 않음, 개인정보 보호법 제38조④).
- DB 행은 회원 행 하나를 지우면 함께 지워진다(ON DELETE CASCADE). 디스크의 파일은 commit 뒤에 지운다.
- v3: 지우기 전에 내 대화를 읽기만(withdrawn)으로 바꾼다. 대화 · 글 · 이름표는 남고(C53) 고객 칸은 DB가
  비운다(SET NULL). 리뷰는 남고 이름은 '탈퇴한 고객'으로 보인다(L08).
- 관리자 계정은 여기서 지우지 않는다 (다른 관리자가 정리).
"""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.account import repository as repo
from app.auth import service as auth_service
from app.auth.models import User
from app.files import service as files_service
from app.files import storage
from app.shared.errors import AppError
from app.thread import service as thread_service

log = logging.getLogger(__name__)


async def withdraw(s: AsyncSession, user: User, password: str, ip: str) -> None:
    if user.role == "admin":
        raise AppError(403, "admin_withdraw", "관리자 계정은 여기서 탈퇴할 수 없어요.")
    await auth_service.confirm_password(user, password, ip)
    parties = await thread_service.close_for_user(s, user)
    keys = await files_service.storage_keys_of(s, user.id)
    await auth_service.delete_user(s, user)
    await s.commit()
    # 상대 화면이 다시 읽게 (떠난 사람의 줄기에는 보내지 않는다)
    gone = user.id
    await thread_service.push_parties(
        [
            (tid, None if c == gone else c, None if v == gone else v, None if c == gone else p)
            for tid, c, v, p in parties
        ]
    )
    failed = 0
    for key in keys:
        try:
            storage.remove(key)
        except OSError:
            failed += 1
    if failed:  # DB에는 이미 없다. 디스크에 남은 파일은 정리 작업이 지운다
        log.error("탈퇴 뒤 파일 %d개를 지우지 못했어요", failed)


async def set_status(s: AsyncSession, user_id: uuid.UUID, status: str) -> bool:
    """관리자 회원 정지(suspended) · 풀기(active). 부르는 쪽 트랜잭션 안(commit은 부르는 쪽).
    이미 그 상태 · 관리자 계정이면 False. 정지하면 세션을 모두 지운다."""
    if status not in ("active", "suspended"):
        raise ValueError(f"알 수 없는 상태: {status}")
    return await repo.set_status(s, user_id, status)
