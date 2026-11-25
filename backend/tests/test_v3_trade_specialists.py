"""공종별 검색·프롬프트 연결. DB와 유료 호출 없이 검증한다."""

import asyncio
import uuid
from dataclasses import replace
from datetime import date

from v3_kb import repo_kb

from app.agent import llm
from app.agent.v3 import answer, llm_mode, orchestrator
from app.agent.v3.schemas import Section, Sentence, TurnContext
from app.agent.v3.specialists import registered
from app.agent.v3.turn import run_turn


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


def test_dobae_turn_dispatches_to_specialist_and_mokgong_keeps_common_flow(monkeypatch):
    kb = repo_kb()
    ctx = TurnContext(user_id=uuid.UUID(int=0), today=date(2026, 11, 19))
    specialist = registered()["dobae"]
    run_dobae = specialist.run
    assert run_dobae is not None
    calls = []

    def run(task, kb, run_common):
        calls.append(task.trades[0])
        return run_dobae(task, kb, run_common)

    monkeypatch.setitem(registered(), "dobae", replace(specialist, run=run))
    dobae = asyncio.run(run_turn("합지랑 실크 중에 뭐로 해야 해요?", ctx, kb=kb))
    mokgong = asyncio.run(run_turn("목공 몰딩은 어떤 종류가 있어요?", ctx, kb=kb))

    assert calls == ["dobae"]
    assert dobae.answer.ask is not None and dobae.answer.ask.slot == "dobae.grade"
    assert mokgong.answer.trace.trades == ["mokgong"]
    assert mokgong.answer.sections


def test_dobae_search_returns_specialist_results(monkeypatch):
    kb = repo_kb()
    result = answer.bm25.Result([], False, [])

    def retrieve(current_kb, question):
        assert current_kb is kb
        assert question == "타일 벽에 도배할 수 있어요?"
        return result

    monkeypatch.setitem(registered(), "dobae", replace(registered()["dobae"], retrieve=retrieve))
    assert answer.search(kb, "타일 벽에 도배할 수 있어요?", "dobae") is result


def test_new_trade_folder_is_routable_without_shared_registration(tmp_path, monkeypatch):
    from app.agent.v3 import specialists, trades
    from app.agent.v3.schemas import Button

    folder = tmp_path / "waterproofing"
    folder.mkdir()
    (folder / "spec.py").write_text(
        "def build(spec_type, slot_type):\n"
        '    return spec_type("waterproofing", "방수", "knowledge", "방수막", ("방수",), 5, route_priority=1)\n'
    )
    (folder / "prompt_v1.md").write_text("방수 전용 지침", encoding="utf-8")
    monkeypatch.setattr(specialists, "__path__", [*specialists.__path__, str(tmp_path)])
    specs = specialists.load_specs(tmp_path, trades.TradeSpec, trades.Slot)
    monkeypatch.setattr(trades, "SPECS", (*trades.SPECS, *specs))
    monkeypatch.setitem(trades.BY_CODE, specs[0].code, specs[0])
    registered = specialists.load_specialists(tmp_path, trades.BY_CODE)
    assert "waterproofing" in registered
    assert registered["waterproofing"].prompt_path == folder / "prompt_v1.md"
    assert trades.trades_in("방수막은 어떻게 관리해요?")[0] == "waterproofing"
    assert Button(route="trade", trade="waterproofing").trade == "waterproofing"


def test_vector_lookup_is_used_only_for_opted_in_trade(monkeypatch):
    kb = repo_kb()
    ctx = TurnContext(user_id=uuid.UUID(int=0), today=date(2026, 11, 19), mode="llm")
    calls = []

    async def lookup(question):
        calls.append(question)
        return ()

    async def no_rewrite(*args, **kwargs):
        raise llm.LLMError("test")

    monkeypatch.setattr(llm, "structured", no_rewrite)
    question = "곰팡이가 있는 벽지는 어떻게 도배해요?"
    dobae = asyncio.run(run_turn(question, ctx, kb=kb, load_vectors=lookup))
    assert dobae.answer.trace.trades == ["dobae"]
    assert not calls

    specialist = registered()["dobae"]
    monkeypatch.setitem(registered(), "dobae", replace(specialist, vector_query=lambda text: text))
    asyncio.run(run_turn(question, ctx, kb=kb, load_vectors=lookup))
    asyncio.run(run_turn("목공 몰딩은 어떤 종류가 있어요?", ctx, kb=kb, load_vectors=lookup))
    asyncio.run(
        run_turn(question, ctx.model_copy(update={"mode": "free"}), kb=kb, load_vectors=lookup)
    )
    assert calls == [question]

    calls.clear()
    combined = asyncio.run(run_turn("몰딩 바꾸고 도배도 새로 하려는데 순서가 어떻게 돼요?", ctx,
                                    kb=kb, load_vectors=lookup))  # fmt: skip
    assert combined.answer.trace.parts == ["trade:mokgong", "trade:dobae"]
    assert len(calls) == 1 and "도배" in calls[0]

    calls.clear()
    waiting = {"route": "trade", "trade": "dobae", "slot": "dobae.mold", "q": question}
    from app.agent.v3.schemas import Button

    button = Button(route="trade", trade="dobae", slot="dobae.mold", value="있어요")
    asyncio.run(run_turn("있어요", ctx, kb=kb, waiting=waiting, button=button, load_vectors=lookup))
    assert calls == [f"{question} 있어요"]
