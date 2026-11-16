"""v2 상담 한 턴을 대화 표(chat)에 잇는다 (C안, #111). 한 턴 순서는 협약 8절.

열기(get_for · recent) → ask.start / resume(LLM ↔ 도구, DB 세션을 쥐지 않음) → 끝난 턴만 저장(save_turn).
- 열 때 본 rev · 질문은 ask 턴 정보("chat")에 같이 둔다. 화면 도구를 기다리는 동안에도 남는다
- 새 대화는 첫 턴을 저장할 때 만든다. 범위 밖 · 실패로 끝난 질문 때문에 빈 대화가 남지 않게
- 실패한 답은 저장하지 않는다. rev가 그대로라 다음 질문은 그대로 이어진다
- waiting은 아직 늘 비운다. 되물었는지 판단하는 방법은 협약 9절에서 정한다
- 대화 표에는 일반 상담(kind=chat)만 쌓는다. 견적서 · 공정표 화면 버튼의 설명은 한 번으로 끝난다
"""

import uuid
from datetime import date

from app.agent.schemas import Intent
from app.chat import service as chat_service
from app.db import SessionLocal
from app.v2 import ask
from app.v2 import schemas as v2


async def start(user_id: uuid.UUID, b: v2.V2AskIn, today: date) -> v2.V2AskOut:
    history: list[dict] = []
    rev, waiting = 1, None
    keep = b.kind == "chat"
    if keep and b.chat_id is not None:
        async with SessionLocal() as s:  # 짧게 열고 닫는다. LLM을 기다리는 동안 쥐지 않는다
            chat = await chat_service.get_for(s, user_id, b.chat_id)
            turns = await chat_service.recent(s, chat)
            rev, waiting = chat.rev, chat.waiting
        history = [{"role": t.role, "content": t.text} for t in turns]
    meta = {
        "keep": keep,
        "id": str(b.chat_id) if keep and b.chat_id else None,
        "rev": rev,
        "question": b.message,
    }
    out = await ask.start(str(user_id), b, today, history, waiting, meta)
    return await _finish(user_id, out, meta)


async def resume(user_id: uuid.UUID, turn_id: str, b: v2.V2AskResumeIn) -> v2.V2AskOut:
    turn = await ask.take(turn_id, str(user_id))  # 같은 턴 재개가 겹치면 늦은 쪽은 여기서 404
    out = await ask.resume(str(user_id), turn_id, b, turn)
    meta = turn["chat"]
    return await _finish(user_id, out, meta)


async def _finish(user_id: uuid.UUID, out: v2.V2AskOut, meta: dict) -> v2.V2AskOut:
    chat_id = uuid.UUID(meta["id"]) if meta["id"] else None
    if not out.done or out.failed or not meta["keep"]:
        return out.model_copy(update={"chat_id": chat_id})
    intent = Intent.model_validate(out.intent.model_dump()) if out.intent else None
    async with SessionLocal() as s:
        if chat_id is None:
            chat_id = await chat_service.create(s, user_id)
        await chat_service.save_turn(
            s,
            user_id=user_id,
            chat_id=chat_id,
            rev=meta["rev"],
            question=meta["question"],
            answer=out.text,
            intent=intent,
            waiting=None,
        )
    return out.model_copy(update={"chat_id": chat_id})
