from dataclasses import dataclass

from app.agent.schemas import Trade


@dataclass(frozen=True)
class TradeConfig:
    """공정 하나의 설정. 값은 출발값이고 시방서(knowledge)를 정리하며 채운다."""

    trade: Trade
    name: str
    symptom_words: tuple[str, ...]  # 고객 말(공정 이름 · 증상 · 일상어)에서 공정을 알아보는 단어
    cautions: tuple[str, ...]  # 공정별 주의점
    survey_vars: tuple[str, ...]  # 실측 때 확정하는 것
    prep: tuple[str, ...]  # 고객 준비 사항
