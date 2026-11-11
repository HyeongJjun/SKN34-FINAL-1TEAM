"""공종 에이전트: 공정별 설정(trades/)을 불러 조건을 묻고 주의점을 안내한다."""

from app.agent.schemas import AgentAnswer, ChatState
from app.agent.trades import match_trades


async def trade(state: ChatState) -> dict:
    """뼈대: 넘길 공정만 고르고 답은 아직 만들지 않는다."""
    return {"trades": match_trades(state.get("message", "")), "answer": AgentAnswer(failed=True)}
