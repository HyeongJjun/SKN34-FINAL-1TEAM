"""에이전트 뼈대: 관문 분기, 출력 검사, 공정 고르기, LLM 스텁 (LLM_LIVE=false, 유료 호출 0회)."""

import asyncio
import uuid

import pytest
from pydantic import BaseModel

from app.agent import llm
from app.agent.graph import AGENT_NODES, NODES, ROUTE, build_graph, default_nodes
from app.agent.schemas import FAILED_TEXT, AgentAnswer, Intent, TurnContext
from app.agent.trades import match_trades

CTX = TurnContext(user_id=uuid.uuid4(), chat_id=uuid.uuid4())


def run(nodes, label=None, message=""):
    state = {"ctx": CTX, "message": message}
    if label:
        state["intent"] = Intent(label=label, confidence=0.9, source="model")
    return asyncio.run(build_graph(nodes).ainvoke(state))


@pytest.mark.parametrize(("label", "node"), ROUTE.items())
def test_gate_sends_each_intent_to_one_agent(label, node):
    visited: list[str] = []

    def make(name):
        async def fake(state):
            visited.append(name)
            return {"answer": AgentAnswer(sentences=[name])} if name in AGENT_NODES else {}

        return fake

    out = run({name: make(name) for name in NODES}, label)
    assert visited == ["gate", node, "output_check"]
    assert out["answer"].sentences == [node]


def test_default_nodes_reply_without_llm():
    ask = run(default_nodes())["answer"]  # 의도 없음(None) → 되묻기
    assert ask.cards[0].kind == "choices"
    # 선택지를 누르면 의도가 같이 와서 다시 분류하지 않는다. 범위 밖만 빼고 모두
    assert [c.intent for c in ask.cards[0].options] == list(ROUTE)[:-1]
    out = run(default_nodes(), "out_of_scope")["answer"]
    assert out.sentences == ["지금은 아파트 도배와 목공만 도와드려요."] and not out.cards
    # 아직 답을 만들지 않는 에이전트는 실패 문구로 알린다
    out = run(default_nodes(), "orchestrator")["answer"]
    assert out.sentences == [FAILED_TEXT] and out.failed


def test_build_graph_needs_every_node():
    nodes = default_nodes()
    del nodes["schedule"]
    with pytest.raises(ValueError, match="schedule"):
        build_graph(nodes)


@pytest.mark.parametrize(
    ("text", "trades"),
    [
        ("벽지가 누렇게 떴어요", ["dobae"]),
        ("천장 테두리 나무 바꾸고 싶어요", ["mokgong"]),
        ("도배랑 몰딩 같이 하고 싶어요", ["dobae", "mokgong"]),
        ("집 좀 고치고 싶어요", ["dobae", "mokgong"]),
        ("실측 방문은 언제 오나요", ["dobae", "mokgong"]),  # 방문(visit)은 문이 아니다
    ],
)
def test_match_trades_one_when_clear_else_both(text, trades):
    assert match_trades(text) == trades


def test_consult_passes_trades_to_interior_agent():
    assert run(default_nodes(), "consult", "문짝 바꿀래요")["trades"] == ["mokgong"]


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
