"""견적 설명 에이전트: 계산 엔진이 만든 견적의 차이를 풀이만 한다. 금액을 만들지 않는다."""

from app.agent.schemas import AgentAnswer, ChatState


async def quote_explanation(state: ChatState) -> dict:
    """뼈대: 아직 답을 만들지 않는다."""
    return {"answer": AgentAnswer(failed=True)}
