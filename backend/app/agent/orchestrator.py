"""오케스트레이터(안내원): 가이드 직접 답 · 담당 에이전트 호출 · 취합 · 되묻기 (#73)."""

from app.agent.schemas import AgentAnswer, ChatState


async def orchestrator(state: ChatState) -> dict:
    """뼈대: 아직 답을 만들지 않는다. 출력 검사가 FAILED_TEXT로 알린다."""
    return {"answer": AgentAnswer(failed=True)}
