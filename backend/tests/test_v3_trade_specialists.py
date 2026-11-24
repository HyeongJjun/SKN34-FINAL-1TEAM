"""공종별 검색·프롬프트 연결. DB와 유료 호출 없이 검증한다."""

import asyncio
import uuid
from datetime import date

from app.agent import llm
from app.agent.v3 import answer, llm_mode, orchestrator
from app.agent.v3.schemas import Section, Sentence, TurnContext
from app.agent.v3.turn import run_turn
from v3_kb import repo_kb


def test_tile_surface_search_only_expands_dobae_query(monkeypatch):
    kb = repo_kb()
    original_search = answer.search3.search
    calls = []

    def record(ix, q, **kwargs):
        calls.append((q, kwargs.get("policy_text"), kwargs["trades"]))
        return original_search(ix, q, **kwargs)

    monkeypatch.setattr(answer.search3, "search", record)
    q = "타일 벽 위에도 실크벽지를 바를 수 있어요?"
    answer.search(kb, q, "dobae")
    answer.search(kb, q, "mokgong")
    assert "타일 바탕면" in calls[0][0]
    assert calls[0][1:] == (q, ["dobae"])
    assert calls[1] == (q, None, ["mokgong"])


def test_dobae_turn_uses_specialist_prompt(monkeypatch):
    kb = repo_kb()
    ref = "K2073"
    q = "타일 위에 도배할 수 있나요?"
    sec = Section(
        source="extract", route="trade", trade="dobae",
        sentences=[Sentence(text="바탕면을 확인해요.", cites=[ref])],
    )  # fmt: skip
    monkeypatch.setitem(orchestrator.AGENTS, "trade", lambda task, kb: answer.Part(sections=[sec]))
    calls = []

    async def fake(role, schema, messages):
        calls.append(messages)
        return schema.model_validate(
            {"sentences": [{"text": "바탕면을 확인해요.", "cites": [ref]}]}
        )

    monkeypatch.setattr(llm, "structured", fake)
    ctx = TurnContext(user_id=uuid.UUID(int=0), today=date(2026, 11, 19), mode="llm")
    result = asyncio.run(run_turn(q, ctx, kb=kb))

    assert result.answer.sections[0].source == "llm"
    assert "도배 전용" in calls[0][0][1]
    assert llm_mode.prompt("trade", "mokgong") == llm_mode.prompt("trade")
