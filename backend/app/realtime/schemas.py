"""실시간 줄기(GET /stream) 이벤트 몸통 (api.md 8장). 모두 JSON이고 개인정보가 없다."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class StreamMsgOut(BaseModel):
    """event: msg — 새 글. 화면이 GET /threads/{tid}/messages?after_seq=로 채운다"""

    thread_id: uuid.UUID
    seq: int


class StreamReadOut(BaseModel):
    """event: read — 내 다른 기기에서 읽음"""

    thread_id: uuid.UUID
    seq: int


class StreamNotifOut(BaseModel):
    """event: notif — 안 읽은 알림 수"""

    unread: int


class StreamStateOut(BaseModel):
    """event: state — 그 화면이 다시 읽을 신호 (router.refresh())"""

    kind: Literal["visit", "deal", "quote", "extra", "review", "vendor_app", "thread"]
    project_id: uuid.UUID | None
    id: uuid.UUID


class StreamResyncOut(BaseModel):
    """event: resync — 놓친 것이 잘렸어요. 화면은 모두 다시 읽는다"""


class StreamEventsDoc(BaseModel):
    """OpenAPI 문서용: text/event-stream으로 오는 이벤트 이름 → data 몸통.
    처음 `event: ready`, 15초마다 `: ping`, `retry: 5000`, `id:` = 줄기 id(Last-Event-ID로 이어 받음)."""

    ready: dict = Field(description="연결됨 (몸통 {})")
    msg: StreamMsgOut
    read: StreamReadOut
    notif: StreamNotifOut
    state: StreamStateOut
    resync: StreamResyncOut
