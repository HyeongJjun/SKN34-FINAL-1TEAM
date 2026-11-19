"""공정별 설정 한 곳. 공종(인테리어) · 견적 설명 · 공정표 에이전트가 같이 읽는다 (AGENTS.md 4절).

범위 밖 공정(바닥 · 욕실 · 전기) 설정은 미리 만들지 않는다.
"""

from app.agent.schemas import Trade
from app.agent.trades.base import TradeConfig
from app.agent.trades.dobae import DOBAE
from app.agent.trades.mokgong import MOKGONG

TRADES: dict[Trade, TradeConfig] = {c.trade: c for c in (DOBAE, MOKGONG)}


# 일상에서도 쓰는 낱말: 이것만으로는 범위 안이라고 보지 않는다 ("실크 스카프", "사진 테두리")
EVERYDAY = frozenset({"실크", "낙서", "테두리"})


def has_trade_word(text: str) -> bool:
    """문장에 도배 · 목공을 알아보는 낱말이 하나라도 있는지 (입구 관문이 범위 밖 판단을 다시 볼 때 쓴다)"""
    return any(w in text for c in TRADES.values() for w in c.symptom_words if w not in EVERYDAY)


def match_trades(text: str) -> list[Trade]:
    """공정이 분명하면 그 공정만, 둘 다 나오거나 모르면 둘 다 넘긴다 (에이전트가 말로 나눈다)."""
    found = [c.trade for c in TRADES.values() if any(w in text for w in c.symptom_words)]
    return found if len(found) == 1 else list(TRADES)
