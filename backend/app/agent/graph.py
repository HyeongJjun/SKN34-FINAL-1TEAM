"""한 턴의 실행 순서: 입구 관문 → 담당 에이전트 → 출력 검사.

LangGraph는 순서만 맡는다. 대화 기록 · 상태 원본은 PostgreSQL(chat 표), 저장은 chat.service가 한다.
"""

from collections.abc import Awaitable, Callable

from langgraph.graph import END, START, StateGraph

from app.agent.gate import fixed_reply, gate
from app.agent.orchestrator import orchestrator
from app.agent.quote_explanation_agent import quote_explanation
from app.agent.schedule_agent import schedule
from app.agent.schemas import FAILED_TEXT, AgentAnswer, ChatState, IntentLabel, Section
from app.agent.trade_agent import trade

Node = Callable[[ChatState], Awaitable[dict]]

# 관문 의도 → 노드. 범위 밖과 의도 못 정함(None)은 LLM 없는 고정 응답
ROUTE: dict[IntentLabel, str] = {
    "orchestrator": "orchestrator",
    "trade": "trade",
    "quote_explanation": "quote_explanation",
    "schedule": "schedule",
    "out_of_scope": "fixed",
}
AGENT_NODES = ("fixed", "orchestrator", "trade", "quote_explanation", "schedule")
NODES = ("gate", *AGENT_NODES, "output_check")


def route_after_gate(state: ChatState) -> str:
    intent = state.get("intent")
    return "fixed" if intent is None else ROUTE[intent.label]


async def output_check(state: ChatState) -> dict:
    """뼈대: 답이 없거나 비었거나 실패면 FAILED_TEXT만 보낸다. 숫자 대조는 #73에서."""
    answer = state.get("answer")
    if answer is None or answer.failed or not (answer.sections or answer.cards):
        return {"answer": AgentAnswer(sections=[Section(sentences=[FAILED_TEXT])], failed=True)}
    return {"answer": answer}


def build_graph(nodes: dict[str, Node]):
    """nodes에 NODES 이름이 모두 있어야 한다. 테스트는 가짜 노드를 넣는다."""
    missing = set(NODES) - nodes.keys()
    if missing:
        raise ValueError(f"노드 없음: {sorted(missing)}")
    g = StateGraph(ChatState)
    for name in NODES:
        g.add_node(name, nodes[name])
    g.add_edge(START, "gate")
    g.add_conditional_edges("gate", route_after_gate, list(AGENT_NODES))
    for name in AGENT_NODES:
        g.add_edge(name, "output_check")
    g.add_edge("output_check", END)
    return g.compile()  # 체크포인터 없음: 한 턴 안에서 끝난다


def default_nodes() -> dict[str, Node]:
    return {
        "gate": gate,
        "fixed": fixed_reply,
        "orchestrator": orchestrator,
        "trade": trade,
        "quote_explanation": quote_explanation,
        "schedule": schedule,
        "output_check": output_check,
    }
