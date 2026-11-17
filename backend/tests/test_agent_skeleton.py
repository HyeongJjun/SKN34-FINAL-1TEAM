"""에이전트 뼈대: 고정 응답(범위 밖 · 되묻기), 공정 고르기, LLM 스텁 (LLM_LIVE=false, 유료 호출 0회)."""

import asyncio
import uuid
from typing import get_args

import pytest
from pydantic import BaseModel

from app.agent import llm
from app.agent.gate import OUT_OF_SCOPE_TEXT, fixed_reply
from app.agent.schemas import AgentAnswer, Intent, IntentLabel, TurnContext
from app.agent.trade_agent import trade
from app.agent.trades import match_trades

CTX = TurnContext(user_id=uuid.uuid4(), chat_id=uuid.uuid4())


def test_fixed_reply_without_llm():
    ask = asyncio.run(fixed_reply({"ctx": CTX, "intent": None}))["answer"]  # 의도 없음 → 되묻기
    assert ask.cards[0].kind == "choices"
    # 선택지를 누르면 의도가 같이 와서 다시 분류하지 않는다. 범위 밖만 빼고 모두
    assert [c.intent for c in ask.cards[0].options] == list(get_args(IntentLabel))[:-1]
    out_intent = Intent(label="out_of_scope", confidence=0.9, source="model")
    out = asyncio.run(fixed_reply({"ctx": CTX, "intent": out_intent}))["answer"]
    assert out.sections[0].sentences == [OUT_OF_SCOPE_TEXT] and not out.cards


@pytest.mark.parametrize(
    ("text", "trades"),
    [
        ("벽지가 누렇게 떴어요", ["dobae"]),
        ("천장 테두리 나무 바꾸고 싶어요", ["mokgong"]),
        ("도배랑 몰딩 같이 하고 싶어요", ["dobae", "mokgong"]),
        ("집 좀 고치고 싶어요", ["dobae", "mokgong"]),
        ("실측 방문은 언제 오나요", ["dobae", "mokgong"]),  # 방문(visit)은 문이 아니다
        # 다른 공정에도 쓰는 증상은 한 공정으로 좁히지 않는다
        ("장판이 들떠요", ["dobae", "mokgong"]),
        ("욕실 곰팡이 어떻게 해요", ["dobae", "mokgong"]),
        ("싱크대 문짝 바꾸고 싶어요", ["dobae", "mokgong"]),
    ],
)
def test_match_trades_one_when_clear_else_both(text, trades):
    assert match_trades(text) == trades


def test_trade_agent_picks_trades_by_code():
    assert asyncio.run(trade({"ctx": CTX, "message": "몰딩 바꿀래요"}))["trades"] == ["mokgong"]


class Plan(BaseModel):
    reply: str


def test_llm_stub_without_live_call():
    msgs = [("user", "안녕")]
    llm.clear_stubs()
    try:
        assert asyncio.run(llm.structured("orchestrator", AgentAnswer, msgs)) == AgentAnswer()
        with pytest.raises(llm.LLMError):  # 필수 칸이 있는데 스텁이 없으면 실패로 알린다
            asyncio.run(llm.structured("orchestrator", Plan, msgs))
        llm.set_stub("orchestrator", Plan(reply="처음이시군요"))
        assert asyncio.run(llm.structured("orchestrator", Plan, msgs)).reply == "처음이시군요"
    finally:
        llm.clear_stubs()


def test_light_model_only_for_listed_roles(monkeypatch):
    """짧은 구조화 출력 역할만 작은 모델, 나머지와 대화는 기본 모델."""
    from app.agent import llm
    from app.config import settings

    monkeypatch.setattr(settings, "openai_agent_model", "big")
    monkeypatch.setattr(settings, "openai_reasoning_effort", "low")
    monkeypatch.setattr(settings, "openai_light_model", "small")
    monkeypatch.setattr(settings, "openai_light_effort", "none")
    monkeypatch.setattr(settings, "openai_light_roles", "trade, schedule")
    assert llm.model_for("trade") == ("small", "none")
    assert llm.model_for("schedule") == ("small", "none")
    assert llm.model_for("orchestrator") == ("big", "low")
    monkeypatch.setattr(settings, "openai_light_model", "")
    assert llm.model_for("trade") == ("big", "low")
