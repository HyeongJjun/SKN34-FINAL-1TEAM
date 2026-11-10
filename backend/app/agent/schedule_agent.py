"""공정표 에이전트: 말을 일정 제약으로 바꾸고 결과 · 연기 영향을 설명만 한다. 일정 MCP는 여기서만."""

from app.agent.schemas import AgentAnswer, ChatState


async def schedule(state: ChatState) -> dict:
    """뼈대: 아직 답을 만들지 않는다."""
    return {"answer": AgentAnswer(failed=True)}
