"""대화 저장 · 복원 (#86 1단계). 한 턴 순서는 협약 8절.

열기(get_for) → 최근 대화(recent) → [에이전트 실행: 여기서 하지 않음] → 저장(save_turn).
동시 요청은 기한 잠금 대신 번호표(rev)로 막는다: 시작할 때 본 rev와 저장할 때 rev가 다르면 409.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.schemas import HISTORY_LIMIT, Intent, IntentLabel, Turn
from app.chat import repository
from app.chat.models import Chat
from app.shared.errors import AppError

NOT_FOUND = "대화를 찾을 수 없어요."
CONFLICT = "다른 질문이 먼저 저장됐어요. 다시 물어봐 주세요."


async def create(s: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    """새 대화방. 만든 대화 id를 돌려준다."""
    chat = await repository.insert_chat(s, user_id)
    await s.commit()
    return chat.id


async def get_for(s: AsyncSession, user_id: uuid.UUID, chat_id: uuid.UUID) -> Chat:
    """내 대화를 연다. 남의 대화 · 없는 대화는 똑같이 404 (있는지 없는지 알려 주지 않는다)."""
    chat = await repository.get_owned(s, user_id, chat_id)
    if chat is None:
        raise AppError(404, "not_found", NOT_FOUND)
    return chat


async def recent(s: AsyncSession, chat: Chat) -> list[Turn]:
    """에이전트에 넘길 지난 메시지. 오래된 것부터 HISTORY_LIMIT줄 (ChatState.history).

    chat은 get_for()가 돌려준 것만 넘긴다. 주인 확인을 건너뛰고 id로 남의 대화를 읽지 못하게.
    """
    rows = await repository.recent_messages(s, chat.id, HISTORY_LIMIT)
    return [Turn(role=m.role, text=m.text) for m in rows]


async def save_turn(
    s: AsyncSession,
    *,
    user_id: uuid.UUID,
    chat_id: uuid.UUID,
    rev: int,
    question: str,
    answer: str,
    intent: Intent | None,
    waiting: IntentLabel | None,
) -> int:
    """한 턴을 저장하고 새 rev를 돌려준다.

    rev: get_for() 때 본 번호표. 그사이 다른 질문이 먼저 저장했으면 아무것도 쓰지 않고 409.
    순서: 번호표 확인 · 올리기(조건부 UPDATE) → 질문 · 답 두 줄 → commit. 한 트랜잭션이다.
    """
    if not await repository.bump_rev(s, user_id, chat_id, rev, waiting):
        await s.rollback()
        raise AppError(409, "conflict", CONFLICT)
    repository.add_turn(s, chat_id, rev, question, answer, intent.model_dump() if intent else None)
    await s.commit()
    return rev + 1
