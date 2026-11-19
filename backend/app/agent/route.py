"""코드 라우터: 학습 모델 · Jev보다 먼저 또는 뒤에 코드로 정하는 세 가지 (AGENTS.md 4절)."""

from app.agent.schemas import Intent, IntentLabel, TurnContext
from app.agent.trades import has_trade_word

NEED_PROJECT: tuple[IntentLabel, ...] = ("quote_explanation", "schedule")


def keep_waiting(
    waiting: IntentLabel | None, model: Intent | None, threshold: float
) -> Intent | None:
    """담당이 고객 답을 기다리면, 학습 모델이 다른 의도를 확실히 말할 때만 옮긴다. 아니면 그대로 둔다.

    "네", "두 개요" 같은 짧은 답은 신뢰도가 낮아 기다리던 담당이 받는다. 이때 Jev는 부르지 않는다.
    """
    if waiting is None:
        return None
    if model is not None and model.label != waiting and model.confidence >= threshold:
        return None
    # 모델이 다른 라벨을 골랐으면 그 신뢰도는 기다리던 담당의 것이 아니므로 0으로 둔다
    same = model is not None and model.label == waiting
    return Intent(label=waiting, confidence=model.confidence if same else 0.0, source="rule")


def keep_in_scope(message: str, found: Intent | None) -> Intent | None:
    """범위 밖이라는 결과라도 문장에 도배 · 목공 낱말이 있으면 고정 안내로 끝내지 않고 공정 상담으로 보낸다.

    학습 모델은 '추천' · '~해 주세요' 말투를 범위 밖으로 기울여 읽는다 ("벽지 추천해 주세요" 0.91).
    정말 범위 밖(다른 공정 · 믿집이 안 하는 일)이면 공정 상담 역할이 답에서 안내한다.
    """
    if found is None or found.label != "out_of_scope" or not has_trade_word(message):
        return found
    return Intent(label="trade", confidence=0.0, source="rule")


def need_project(intent: Intent, ctx: TurnContext) -> Intent:
    """견적 설명 · 일정인데 프로젝트가 없으면 오케스트레이터로 보낸다."""
    if intent.label in NEED_PROJECT and ctx.project_id is None:
        return Intent(label="orchestrator", confidence=intent.confidence, source="rule")
    return intent
