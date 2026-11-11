"""입구 관문과 LLM 없는 고정 응답. 순서(#72): route.py → intent.py → 낮으면 Jev → 되묻기."""

from app.agent import intent as intent_model
from app.agent import llm, route
from app.agent.schemas import AgentAnswer, Card, ChatState, Choice, Intent, IntentLabel, Section
from app.config import settings

# Jev에 보내는 질문. #70에서 이 문구로 쟀다. 바꾸면 의도 eval을 다시 돌린다
JEV_INSTRUCTIONS = """아파트 도배 · 목공 인테리어 서비스 '믿집'의 고객 문장을 보낼 곳 하나로 고른다.
- 증상이 앞에 붙어도 실제로 묻는 것이 견적 금액 · 줄이면 quote_explanation
- 일정 + 견적 설명처럼 두 담당이 필요하면 orchestrator
- 일반 지식을 "알려 달라"면 orchestrator, 믿집이 그 일을 "해 주는지" 물으면 out_of_scope"""
JEV_CRITERIA = {
    "orchestrator": "처음 고객 안내(서비스 흐름, 시작 순서, 용어 뜻, 일반 시세, 기본 정보 · 제출 서류), 인사, "
    "고객이 챙길 것 · 계약 전 확인 · 현장 준비 · 검수 같은 일반 지식, 두 담당 이상이 섞인 복합 요청",
    "trade": "도배 · 목공 상담. 증상 · 원하는 작업 · 조건을 말하는 문장",
    "quote_explanation": "내 표준견적서 · 가견적 · 실측 견적서의 금액 · 줄 · 차이 풀이, "
    "견적서 규칙(유효기간, 계산 방식, 실측 견적서의 공사 기간 칸)",
    "schedule": "내 공정표 · 공사 날짜 · 순서 · 연기 · 일정 변경, 공정표 확정 절차와 변경 신청 방법",
    "out_of_scope": "도배 · 목공 밖 공정(바닥 · 욕실 · 전기 등), 믿집이 해 주지 않는 일"
    "(계약서 작성, 결제, 서류 대행, 다른 업체 연결 등), 서비스와 무관한 잡담",
}

# 되묻기 선택지. 화면에는 쉬운 말만 보이고, 누르면 의도가 같이 와서 다시 분류하지 않는다
ASK_CHOICES = (
    Choice(text="처음이라 순서를 알고 싶어요", intent="orchestrator"),
    Choice(text="우리 집에 뭘 해야 할지 모르겠어요", intent="trade"),
    Choice(text="금액이 왜 이런지 궁금해요", intent="quote_explanation"),
    Choice(text="공사 날짜가 궁금해요", intent="schedule"),
)
OUT_OF_SCOPE_TEXT = "지금은 아파트 도배와 목공만 도와드려요."


async def gate(state: ChatState) -> dict:
    """버튼처럼 의도가 정해져 오면 그대로 쓰고, 아니면 분류한다. 끝에 프로젝트 유무를 본다."""
    found = state.get("intent") or await classify(state.get("message", ""), state.get("waiting"))
    return {"intent": found and route.need_project(found, state["ctx"])}


async def classify(message: str, waiting: IntentLabel | None = None) -> Intent | None:
    """학습 모델 → 기다리던 담당 유지 → 신뢰도 낮으면 Jev 한 번 → 실패면 None(되묻기)."""
    threshold = settings.intent_confidence_threshold
    model = intent_model.predict(message)
    kept = route.keep_waiting(waiting, model, threshold)
    if kept is not None:
        return kept
    if model is not None and model.confidence >= threshold:
        return model
    # Jev 신뢰도로는 되묻지 않는다: #70에서 되묻기 기준으로 약했음 (conf<0.5 9개 중 5개 정답)
    try:
        label, confidence = await llm.jev_choice(
            intent_model.clean(message), JEV_INSTRUCTIONS, JEV_CRITERIA
        )
    except llm.LLMError:
        return None
    return Intent(label=label, confidence=confidence, source="jev")


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
