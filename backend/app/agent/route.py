"""코드 라우터: 학습 모델 · Jev보다 먼저 또는 뒤에 코드로 정하는 세 가지 (AGENTS.md 4절)."""

import re

from app.agent.schemas import Intent, IntentLabel, TurnContext
from app.agent.trades import has_trade_word

NEED_PROJECT: tuple[IntentLabel, ...] = ("quote_explanation", "schedule")
# 대답 · 부탁 말. 문장이 이런 낱말로만 되어 있으면 새 주제가 없다 ("네 그렇게 해 주세요", "추천해 주세요")
REPLY_WORD = re.compile(
    r"^(?:네|넵|예|응|어|음|아니요|아뇨|ㅇㅇ|ㅇㅋ|ㄴㄴ|좋아요?|그래요?|괜찮아요|맞아요|알겠어요|알겠습니다"
    r"|그렇게|그걸로|그거|그건|그게|그대로|이대로|이걸로|이거|둘|다|전부|아무거나|알아서"
    r"|더|좀|다시|계속|꼭|그럼|그러면|일단|한번"
    r"|(?:해|알려|말해|설명해|보여|추천해|진행해|부탁해|부탁드려)?(?:주세요|줘요?|주실래요|줄래요|주시면|드려요|요)?"
    r"|할게요|할래요|좋겠어요)[.!~?…]*$"
)


def reply_only(message: str) -> bool:
    """문장이 대답 · 부탁 말로만 되어 있는지. 주제 낱말이 하나라도 있으면 아니다 ("주식 추천해줘")"""
    words = message.split()
    return bool(words) and all(REPLY_WORD.match(w) for w in words)


def keep_waiting(
    waiting: IntentLabel | None, model: Intent | None, threshold: float, message: str = ""
) -> Intent | None:
    """담당이 고객 답을 기다리면, 학습 모델이 다른 의도를 확실히 말할 때만 옮긴다. 아니면 그대로 둔다.

    "네", "두 개요" 같은 짧은 답은 신뢰도가 낮아 기다리던 담당이 받는다. 이때 Jev는 부르지 않는다.
    범위 밖으로 옮기려면 새 주제가 있어야 한다: 학습 모델은 '~해 주세요' 말투를 범위 밖으로 확신하는데,
    대답 · 부탁 말로만 된 답("추천해 주세요")은 되물음의 답이라 기다리던 담당이 받는다.
    """
    if waiting is None:
        return None
    sure_other = model is not None and model.label != waiting and model.confidence >= threshold
    if sure_other and not (model.label == "out_of_scope" and reply_only(message)):
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
