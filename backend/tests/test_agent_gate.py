"""입구 관문: 학습 모델 계산, 코드 라우터, Jev 한 번, 되묻기, 가림 (LLM_LIVE=false, 유료 호출 0회)."""

import asyncio
import json
import uuid
from typing import get_args

import httpx
import pytest

from app.agent import gate as gate_module
from app.agent import intent, llm, route
from app.agent.gate import OUT_OF_SCOPE_TEXT, classify, fixed_reply, gate
from app.agent.schemas import Intent, IntentLabel, TurnContext

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


def reply_of(message, ctx=NO_PROJECT):
    """관문 → LLM 없는 고정 응답(범위 밖 · 되묻기)."""
    state = {"ctx": ctx, "message": message}
    found = asyncio.run(gate(state))
    return found["intent"], asyncio.run(fixed_reply({**state, **found}))["answer"]


def test_model_matches_training_probs():
    model = intent._model()
    for check in model["checks"]:
        got = intent.probs(check["text"])
        assert [got[label] for label in model["labels"]] == pytest.approx(check["probs"], abs=1e-5)


def test_confident_model_skips_jev(jev_calls):
    found = gate_of("공사 날짜 언제로 잡혔어요?")
    assert (found.label, found.source) == ("schedule", "model") and jev_calls == []


def test_out_of_scope_replies_without_llm(jev_calls):
    _, answer = reply_of("욕실 타일 교체하고 싶어요")
    assert answer.sections[0].sentences == [OUT_OF_SCOPE_TEXT] and jev_calls == []


def test_low_confidence_asks_jev_once(jev_calls):
    llm.set_jev_stub("orchestrator", 0.8)
    found = gate_of("음")
    assert (found.label, found.source) == ("orchestrator", "jev") and len(jev_calls) == 1


def test_jev_disabled_uses_model_label(monkeypatch, jev_calls):
    monkeypatch.setattr(gate_module.settings, "jev_enabled", False)
    llm.set_jev_stub("orchestrator", 0.8)
    found = asyncio.run(classify("음"))
    assert found.source == "model" and found.confidence < 0.7 and jev_calls == []
    # 기다리던 담당 유지는 그대로
    kept = asyncio.run(classify("네 두 개요", "schedule"))
    assert (kept.label, kept.source) == ("schedule", "rule") and jev_calls == []


def test_jev_failure_asks_back():
    found, answer = reply_of("음")
    assert found is None and answer.cards[0].kind == "choices"


def test_short_answer_stays_with_waiting_agent(jev_calls):
    found = gate_of("네 두 개요", waiting="schedule")
    assert (found.label, found.source) == ("schedule", "rule") and jev_calls == []


def test_kept_waiting_does_not_borrow_other_label_confidence():
    other = Intent(label="trade", confidence=0.4, source="model")
    same = Intent(label="schedule", confidence=0.4, source="model")
    assert route.keep_waiting("schedule", other, 0.7).confidence == 0.0
    assert route.keep_waiting("schedule", same, 0.7).confidence == 0.4


def test_gate_clears_waiting():
    # 관문은 지난 waiting을 읽고 비운다. 이번 턴에 되묻는 역할만 다시 넣는다
    state = {"ctx": WITH_PROJECT, "message": "공사 날짜 언제로 잡혔어요?", "waiting": "trade"}
    assert asyncio.run(gate(state))["waiting"] is None


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


@pytest.mark.parametrize(
    "phone", ["010\u20131234\u20135678", "010\u20141234\u20145678", "\uff10\uff11\uff10-1234-5678"]
)
def test_phone_with_other_dashes_is_masked(phone):
    assert intent.clean(f"{phone} 음") == "<전화> 음"


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
    assert set(gate_module.JEV_CRITERIA) == set(get_args(IntentLabel))


@pytest.mark.parametrize(
    ("reply", "expected"),
    [
        (
            httpx.Response(
                200, json={"answers": {"intent": {"choice": "trade", "confidence": 1.7}}}
            ),
            ("trade", 1.0),
        ),
        (httpx.Response(200, json={"answers": {"intent": {"choice": "bathroom"}}}), None),
        (httpx.Response(200, json={"answers": {"intent": {"choice": ["trade"]}}}), None),
        (
            httpx.Response(
                200, text='{"answers": {"intent": {"choice": "trade", "confidence": NaN}}}'
            ),
            None,
        ),
        (httpx.Response(200, text="not json"), None),
        (httpx.Response(500), None),
    ],
)
def test_jev_live_reply_is_read_or_failed(monkeypatch, reply, expected):
    """실호출 경로를 가짜 응답으로 확인한다. 모르는 답 · 깨진 응답 · 오류는 LLMError(→ 되묻기)."""
    sent = []

    def answer(request):
        sent.append(request)
        return reply

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(answer), **kw)
    )
    monkeypatch.setattr(llm.settings, "llm_live", True)
    call = llm.jev_choice("<전화> 음", "지시", gate_module.JEV_CRITERIA)
    if expected is None:
        with pytest.raises(llm.LLMError):
            asyncio.run(call)
    else:
        assert asyncio.run(call) == expected
    assert str(sent[0].url) == llm.JEV_URL
    # 가린 문장만 나간다
    assert json.loads(sent[0].content)["state"] == "<전화> 음"
