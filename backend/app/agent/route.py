"""코드 라우터: 학습 모델 · Jev보다 먼저 또는 뒤에 코드로 정하는 두 가지 (AGENTS.md 4절)."""

from app.agent.schemas import Intent, IntentLabel, TurnContext

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


def need_project(intent: Intent, ctx: TurnContext) -> Intent:
    """견적 설명 · 일정인데 프로젝트가 없으면 오케스트레이터로 보낸다."""
    if intent.label in NEED_PROJECT and ctx.project_id is None:
        return Intent(label="orchestrator", confidence=intent.confidence, source="rule")
    return intent
