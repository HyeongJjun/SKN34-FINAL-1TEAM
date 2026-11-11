"""입구 관문: 학습 모델 계산, 코드 라우터, Jev 한 번, 되묻기, 가림 (LLM_LIVE=false, 유료 호출 0회)."""

import asyncio
import uuid

import pytest

from app.agent import gate as gate_module
from app.agent import intent, llm
from app.agent.gate import OUT_OF_SCOPE_TEXT, classify, gate
from app.agent.graph import build_graph, default_nodes
from app.agent.schemas import TurnContext

NO_PROJECT = TurnContext(user_id=uuid.uuid4(), chat_id=uuid.uuid4())
WITH_PROJECT = TurnContext(user_id=uuid.uuid4(), chat_id=uuid.uuid4(), project_id=uuid.uuid4())


@pytest.fixture(autouse=True)
def jev_calls(monkeypatch):
    """Jev로 간 문장을 모은다. 스텁이 없으면 Jev 실패."""
    sent: list[str] = []
    real = llm.jev_choice

    async def spy(text, instructions, criteria):
        sent.append(text)
        return await real(text, instructions, criteria)

    monkeypatch.setattr(llm, "jev_choice", spy)
    yield sent
    llm.clear_stubs()


def gate_of(message, ctx=WITH_PROJECT, waiting=None):
    return asyncio.run(gate({"ctx": ctx, "message": message, "waiting": waiting}))["intent"]


def test_model_matches_training_probs():
    model = intent._model()
    for check in model["checks"]:
        got = intent.probs(check["text"])
        assert [got[label] for label in model["labels"]] == pytest.approx(check["probs"], abs=1e-5)


def test_confident_model_skips_jev(jev_calls):
    found = gate_of("공사 날짜 언제로 잡혔어요?")
    assert (found.label, found.source) == ("schedule", "model") and jev_calls == []


def test_out_of_scope_replies_without_llm(jev_calls):
    out = asyncio.run(
        build_graph(default_nodes()).ainvoke(
            {"ctx": NO_PROJECT, "message": "욕실 타일 교체하고 싶어요"}
        )
    )
    assert out["answer"].sections[0].sentences == [OUT_OF_SCOPE_TEXT] and jev_calls == []


def test_low_confidence_asks_jev_once(jev_calls):
    llm.set_jev_stub("orchestrator", 0.8)
    found = gate_of("음")
    assert (found.label, found.source) == ("orchestrator", "jev") and len(jev_calls) == 1


def test_jev_failure_asks_back():
    out = asyncio.run(build_graph(default_nodes()).ainvoke({"ctx": NO_PROJECT, "message": "음"}))
    assert out["intent"] is None and out["answer"].cards[0].kind == "choices"


def test_short_answer_stays_with_waiting_agent(jev_calls):
    found = gate_of("네 두 개요", waiting="schedule")
    assert (found.label, found.source) == ("schedule", "rule") and jev_calls == []


def test_clear_other_intent_leaves_waiting_agent():
    found = gate_of("표준견적서에 철거비가 따로 계산이라고 되어 있는데 왜 그래요?", waiting="trade")
    assert (found.label, found.source) == ("quote_explanation", "model")


@pytest.mark.parametrize("label", ["quote_explanation", "schedule"])
def test_no_project_goes_to_orchestrator(label):
    message = {
        "quote_explanation": "표준견적서에 철거비가 따로 계산이라고 되어 있는데 왜 그래요?",
        "schedule": "공사 날짜 언제로 잡혔어요?",
    }[label]
    assert gate_of(message, ctx=WITH_PROJECT).label == label
    found = gate_of(message, ctx=NO_PROJECT)
    assert (found.label, found.source) == ("orchestrator", "rule")


def test_phone_and_unit_are_masked_before_jev(jev_calls):
    llm.set_jev_stub("orchestrator")
    asyncio.run(classify("010-1234-5678 105동 1203호 음"))
    assert jev_calls == ["<전화> <동호수> 음"]


def test_missing_model_falls_back_to_jev(monkeypatch, jev_calls):
    monkeypatch.setattr(intent, "MODEL", intent.MODEL.with_name("없는_모델.json.gz"))
    intent._model.cache_clear()
    try:
        llm.set_jev_stub("trade")
        found = gate_of("공사 날짜 언제로 잡혔어요?")
        assert (found.label, found.source) == ("trade", "jev") and len(jev_calls) == 1
    finally:
        intent._model.cache_clear()


def test_jev_question_covers_every_label():
    from app.agent.graph import ROUTE

    assert set(gate_module.JEV_CRITERIA) == set(ROUTE)
