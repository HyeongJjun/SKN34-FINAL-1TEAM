"""입구 관문과 LLM 없는 고정 응답. 순서(#72): route.py → intent.py → 낮으면 Jev → 되묻기."""

from app.agent.schemas import AgentAnswer, Card, ChatState, Choice, Section

# 되묻기 선택지. 화면에는 쉬운 말만 보이고, 누르면 의도가 같이 와서 다시 분류하지 않는다
ASK_CHOICES = (
    Choice(text="처음이라 순서를 알고 싶어요", intent="orchestrator"),
    Choice(text="우리 집에 뭘 해야 할지 모르겠어요", intent="trade"),
    Choice(text="금액이 왜 이런지 궁금해요", intent="quote_explanation"),
    Choice(text="공사 날짜가 궁금해요", intent="schedule"),
)
OUT_OF_SCOPE_TEXT = "지금은 아파트 도배와 목공만 도와드려요."


async def gate(state: ChatState) -> dict:
    """뼈대: 버튼처럼 의도가 이미 정해져 오면 그대로, 아니면 되묻기. 분류는 #72에서."""
    return {"intent": state.get("intent")}


async def fixed_reply(state: ChatState) -> dict:
    """범위 밖이면 안내 문구, 의도를 못 정했으면 되묻기. LLM을 부르지 않는다."""
    intent = state.get("intent")
    if intent is not None and intent.label == "out_of_scope":
        return {"answer": AgentAnswer(sections=[Section(sentences=[OUT_OF_SCOPE_TEXT])])}
    return {
        "answer": AgentAnswer(
            sections=[Section(sentences=["어떤 걸 물어보신 건지 골라 주세요."])],
            cards=[Card(kind="choices", title="궁금한 것", options=list(ASK_CHOICES))],
        )
    }
