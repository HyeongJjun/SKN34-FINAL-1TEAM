"""대화 저장 (#86 1단계): 내 대화만 열고, 번호표(rev)가 다르면 저장하지 않는다."""

import asyncio
import uuid

import pytest

from app.agent.schemas import HISTORY_LIMIT, Intent
from app.chat import service
from app.db import SessionLocal
from app.shared.errors import AppError
from tests.conftest import query
from tests.helpers import signup


def _user_id(email: str) -> uuid.UUID:
    (row,) = query("select id from users where email = $1", email)
    return row["id"]


def _run(fn):
    async def run():
        async with SessionLocal() as s:
            return await fn(s)

    return asyncio.run(run())


def _save(me, chat_id, rev, n, waiting=None, intent=None):
    return _run(
        lambda s: service.save_turn(
            s,
            user_id=me,
            chat_id=chat_id,
            rev=rev,
            question=f"질문 {n}",
            answer=f"답 {n}",
            intent=intent,
            waiting=waiting,
        )
    )


def _history(me, chat_id):
    """실제 쓰는 순서대로: 주인 확인(get_for) → 최근 대화(recent)."""

    async def run(s):
        return await service.recent(s, await service.get_for(s, me, chat_id))

    return _run(run)


@pytest.fixture
def me(api):
    signup(api)
    return _user_id("customer@mitjip.test")


def test_others_or_missing_chat_is_404(api, me):
    chat_id = _run(lambda s: service.create(s, me))
    signup(api, "other@mitjip.test")
    other = _user_id("other@mitjip.test")
    for user, cid in ((other, chat_id), (me, uuid.uuid4())):
        with pytest.raises(AppError) as e:
            _run(lambda s, u=user, c=cid: service.get_for(s, u, c))
        assert e.value.status == 404


def test_save_bumps_rev_and_history_is_oldest_first(me):
    chat_id = _run(lambda s: service.create(s, me))
    intent = Intent(label="trade", confidence=0.83, source="model")
    assert _save(me, chat_id, 1, 1, waiting="trade", intent=intent) == 2
    assert _save(me, chat_id, 2, 2) == 3

    chat = _run(lambda s: service.get_for(s, me, chat_id))
    assert (chat.rev, chat.waiting) == (3, None)  # waiting은 매 턴 덮어쓴다
    history = _history(me, chat_id)
    assert [(t.role, t.text) for t in history] == [
        ("user", "질문 1"),
        ("assistant", "답 1"),
        ("user", "질문 2"),
        ("assistant", "답 2"),
    ]
    # 관문 결과는 고객 질문 줄에만 남는다
    rows = query(
        "select role, intent_label, intent_confidence, intent_source from chat_messages"
        " where turn = 1 order by role"
    )
    assert [tuple(r) for r in rows] == [
        ("assistant", None, None, None),
        ("user", "trade", 0.83, "model"),
    ]


def test_stale_rev_is_409_and_writes_nothing(me):
    """같은 rev로 시작한 두 질문 중 늦게 저장하는 쪽은 아무것도 쓰지 않는다."""
    chat_id = _run(lambda s: service.create(s, me))
    _save(me, chat_id, 1, 1, waiting="trade")
    with pytest.raises(AppError) as e:
        _save(me, chat_id, 1, 2, waiting="schedule")
    assert e.value.status == 409
    assert query("select count(*) from chat_messages")[0][0] == 2
    assert tuple(query("select rev, waiting from chats")[0]) == (2, "trade")


def test_others_rev_cannot_be_saved(api, me):
    """남의 대화 id로 저장하려 해도 바뀌지 않는다 (get_for를 건너뛴 경우의 안전망)."""
    chat_id = _run(lambda s: service.create(s, me))
    signup(api, "other@mitjip.test")
    with pytest.raises(AppError) as e:
        _save(_user_id("other@mitjip.test"), chat_id, 1, 1)
    assert e.value.status == 409
    assert query("select count(*) from chat_messages")[0][0] == 0


def test_history_keeps_only_recent(me):
    chat_id = _run(lambda s: service.create(s, me))
    turns = HISTORY_LIMIT // 2 + 2
    for n in range(1, turns + 1):
        _save(me, chat_id, n, n)
    history = _history(me, chat_id)
    assert len(history) == HISTORY_LIMIT
    assert history[0].text == f"질문 {turns - HISTORY_LIMIT // 2 + 1}"
    assert history[-1].text == f"답 {turns}"
