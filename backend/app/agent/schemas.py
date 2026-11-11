"""에이전트 입출력과 한 턴의 상태. 금액 · 수량 · 날짜는 담지 않는다 (calc가 만든다)."""

import uuid
from typing import Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

# 입구 관문 의도: 공정이 아니라 보낼 곳으로 나눈다 (AGENTS.md 4절)
IntentLabel = Literal["orchestrator", "trade", "quote_explanation", "schedule", "out_of_scope"]
IntentSource = Literal["rule", "model", "jev", "button"]
Trade = Literal["dobae", "mokgong"]

FAILED_TEXT = "설명을 만들지 못했어요"


class TurnContext(BaseModel):
    """서버가 로그인 세션으로 정한 값. LLM 출력이나 도구 인자로 바꾸지 않는다."""

    model_config = ConfigDict(frozen=True)

    user_id: uuid.UUID
    chat_id: uuid.UUID
    project_id: uuid.UUID | None = None  # 가이드 대화는 프로젝트 없이 돈다


class Intent(BaseModel):
    label: IntentLabel
    confidence: float = Field(ge=0, le=1)
    source: IntentSource


class Choice(BaseModel):
    text: str
    intent: IntentLabel | None = None  # 있으면 누를 때 버튼 경로(source="button")로 보낸다


class Card(BaseModel):
    """문장 밖으로 보내는 화면 조각. 숫자는 넣지 않고 화면이 API 값으로 채운다."""

    # standard_quote: 예상 비용. 화면이 표준견적서(calc) 금액으로 채운다
    kind: Literal["choices", "next_step", "caution", "standard_quote"]
    title: str
    options: list[Choice] = []


class Section(BaseModel):
    """답 한 묶음: 제목 → 결론 → 주의 → 팁. 전문가 하나가 한 묶음을 낸다."""

    title: str = ""  # 예: "[도배] 셀프 난이도: 전문가 필요". 공정 없는 안내면 비운다
    sentences: list[str] = []  # 결론 1~3문장
    caution: str = ""  # 화면이 "주의:"를 붙인다
    tip: str = ""  # 화면이 "팁:"을 붙인다


class AgentAnswer(BaseModel):
    """복합 요청이면 안내원이 전문가들의 묶음을 이어 붙인다."""

    sections: list[Section] = []
    cards: list[Card] = []
    failed: bool = False  # LLM 실패 · 아직 없는 노드. 출력 검사가 FAILED_TEXT로 바꾼다


class ChatState(TypedDict, total=False):
    """한 턴 동안만 사는 값. 턴 시작에 chat.service가 DB에서 채우고 끝나면 버린다."""

    ctx: TurnContext
    message: str
    intent: Intent | None  # 관문 결과. None이면 되묻기
    trades: list[Trade]  # 공종 전문가가 match_trades로 고른 공정
    answer: AgentAnswer | None
