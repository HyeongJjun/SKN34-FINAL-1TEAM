"""v2 상담 한 턴을 대화 표에 잇기 (C안, #111): 지난 대화 · 남의 대화 404 · 번호표(rev) 409 · 재개 한 번만(#119)."""

import pytest
import redis

from app.agent import llm
from app.v2 import ask, ask_chat
from tests.conftest import REDIS_URL, query
from tests.helpers import signup
from tests.test_v2_ask import FakeLLM, call

ASK = "합지랑 실크 벽지는 뭐가 달라요?"


@pytest.fixture
def fake(monkeypatch):
    def make(*answers):
        f = FakeLLM(*answers)
        monkeypatch.setattr(llm, "chat_tools", f)
        return f

    return make


def _messages(chat_id):
    return query(
        "select role, text from chat_messages where chat_id = $1 order by turn, role desc",
        chat_id,
    )


def test_first_answer_makes_chat_and_next_question_gets_history(api, fake):
    f = fake({"text": "합지는 종이 벽지예요."}, {"text": "실크는 닦기 쉬워요."})
    signup(api)
    first = api.post("/v2/ask", json={"message": ASK}).json()
    assert first["done"] and first["chat_id"]
    assert [(m["role"], m["text"]) for m in _messages(first["chat_id"])] == [
        ("user", ASK),
        ("assistant", "합지는 종이 벽지예요."),
    ]

    second = api.post("/v2/ask", json={"message": "그럼 뭐가 나아요?", "chat_id": first["chat_id"]})
    assert second.json()["chat_id"] == first["chat_id"]
    sent = f.seen[1]["messages"]
    assert sent[0] == {"role": "user", "content": ASK}
    assert sent[1] == {"role": "assistant", "content": "합지는 종이 벽지예요."}
    assert sent[2]["role"] == "user" and sent[2]["content"][-1]["text"] == "그럼 뭐가 나아요?"
    assert len(_messages(first["chat_id"])) == 4


def test_number_from_last_answer_can_be_said_again(api, fake):
    fake({"text": "32평 기준으로 볼게요."}, {"text": "32평이라고 하셨어요."})
    signup(api)
    chat_id = api.post("/v2/ask", json={"message": "우리 집은 32평이에요"}).json()["chat_id"]
    again = api.post("/v2/ask", json={"message": "아까 몇 평이라고 했죠?", "chat_id": chat_id})
    out = again.json()
    assert out["text"] == "32평이라고 하셨어요." and out["dropped"] == []


def _waiting(chat_id):
    return query("select waiting from chats where id = $1", chat_id)[0]["waiting"]


def test_asked_back_answer_keeps_role_for_next_turn(api, fake):
    f = fake(
        {"text": "도배할 방이 몇 개예요?\n[되물음]"},
        {"text": "알겠어요. 그 기준으로 볼게요."},
    )
    signup(api)
    first = api.post("/v2/ask", json={"message": ASK}).json()
    chat_id = first["chat_id"]
    # 표시는 화면 · 저장 글에서 뗀다
    assert first["text"] == "도배할 방이 몇 개예요?"
    assert _messages(chat_id)[1]["text"] == "도배할 방이 몇 개예요?"
    assert _waiting(chat_id) == ((first["intent"] or {}).get("label") or "orchestrator")

    # 공정 상담이 되물은 상태에서 짧은 답이 오면 같은 역할(출처 rule)로 가고 역할 힌트가 붙는다
    query("update chats set waiting = 'trade' where id = $1", chat_id)
    second = api.post("/v2/ask", json={"message": "두 개요", "chat_id": chat_id}).json()
    assert second["intent"]["label"] == "trade" and second["intent"]["source"] == "rule"
    assert ask.HINTS["trade"] in f.seen[1]["system"]
    assert _waiting(chat_id) is None  # 이번에는 되묻지 않았다


def test_answer_without_mark_leaves_no_waiting(api, fake):
    fake({"text": "합지는 종이 벽지예요."})
    signup(api)
    chat_id = api.post("/v2/ask", json={"message": ASK}).json()["chat_id"]
    assert _waiting(chat_id) is None


OUT = "주식 추천해줘"  # 학습 모델이 범위 밖으로 확신하는 문장 (기다리던 역할이 있어도 옮긴다)


def test_out_of_scope_first_question_makes_no_chat(api, fake):
    f = fake()
    signup(api)
    out = api.post("/v2/ask", json={"message": OUT}).json()
    assert out["gate"] == "out" and out["chat_id"] is None and f.seen == []
    assert query("select count(*) as n from chats")[0]["n"] == 0


def test_out_of_scope_in_chat_saves_nothing(api, fake):
    """범위 밖 안내는 대화 이력에 남지 않고 rev · waiting도 그대로다 (#128)."""
    fake({"text": "합지는 종이 벽지예요."})
    signup(api)
    chat_id = api.post("/v2/ask", json={"message": ASK}).json()["chat_id"]
    query("update chats set waiting = 'trade' where id = $1", chat_id)
    state = "select rev, waiting from chats where id = $1"
    before = dict(query(state, chat_id)[0])
    out = api.post("/v2/ask", json={"message": OUT, "chat_id": chat_id}).json()
    assert out["gate"] == "out" and out["chat_id"] == chat_id
    assert dict(query(state, chat_id)[0]) == before
    assert len(_messages(chat_id)) == 2


def test_wallpaper_request_reaches_llm(api, fake):
    """학습 모델이 범위 밖으로 읽는 말투('추천해 주세요')여도 도배 낱말이 있으면 고정 안내로 끝내지 않는다 (#147)."""
    f = fake({"text": "실크와 합지 중에서 골라 보세요."})
    signup(api)
    out = api.post("/v2/ask", json={"message": "벽지 추천해 주세요"}).json()
    assert out["gate"] is None and out["intent"]["label"] == "trade" and len(f.seen) == 1


@pytest.mark.parametrize(
    "answer",
    [
        "[되물음]",  # 표시만 온 답
        "방이 7개 맞나요?\n[되물음]",  # 출력 검사가 질문(없는 숫자)을 빼면 표시만 남는다
    ],
)
def test_mark_only_answer_is_failed_and_not_saved(api, fake, answer):
    fake({"text": answer})
    signup(api)
    out = api.post("/v2/ask", json={"message": ASK}).json()
    assert out["failed"] and out["text"] == ask.FAILED["chat"] and out["chat_id"] is None
    assert query("select count(*) as n from chats")[0]["n"] == 0


def test_mark_in_middle_is_not_asked_and_hidden(api, fake):
    fake({"text": "방이 몇 개예요?\n[되물음]\n합지는 종이 벽지예요."})
    signup(api)
    out = api.post("/v2/ask", json={"message": ASK}).json()
    assert out["text"] == "방이 몇 개예요?\n\n합지는 종이 벽지예요."
    assert _waiting(out["chat_id"]) is None


def test_mark_on_question_line_is_asked(api, fake):
    fake({"text": "도배할 방이 몇 개예요? [되물음]"})
    signup(api)
    out = api.post("/v2/ask", json={"message": ASK}).json()
    assert out["text"] == "도배할 방이 몇 개예요?"
    assert _waiting(out["chat_id"]) == ((out["intent"] or {}).get("label") or "orchestrator")


def test_guard_dropped_question_leaves_no_waiting(api, fake):
    fake({"text": "합지는 종이 벽지예요. 방이 7개 맞나요?\n[되물음]"})
    signup(api)
    out = api.post("/v2/ask", json={"message": ASK}).json()
    assert out["text"] == "합지는 종이 벽지예요." and out["dropped"]
    assert _waiting(out["chat_id"]) is None


def test_mark_from_earlier_tool_round_is_not_asked(api, fake):
    """도구 라운드마다 글이 이어 붙는다. 앞 라운드 글의 표시는 되물음이 아니다."""
    fake({"text": "자료를 볼게요.\n[되물음]", **TOOL_TURN}, {"text": "합지는 종이 벽지예요."})
    signup(api)
    turn = api.post("/v2/ask", json={"message": ASK}).json()["turn"]
    out = api.post(f"/v2/ask/{turn}", json=RESULT).json()
    assert out["done"] and out["text"] == "자료를 볼게요.\n\n합지는 종이 벽지예요."
    assert _waiting(out["chat_id"]) is None


def test_other_users_chat_is_404_before_llm(api, fake):
    f = fake({"text": "합지는 종이 벽지예요."})
    signup(api)
    mine = api.post("/v2/ask", json={"message": ASK}).json()["chat_id"]
    signup(api, email="other@mitjip.test")
    r = api.post("/v2/ask", json={"message": ASK, "chat_id": mine})
    assert r.status_code == 404 and len(f.seen) == 1


def test_stale_rev_is_409_and_saves_nothing(api, fake):
    fake(
        {"text": "합지는 종이 벽지예요."},
        {"tool_calls": [call("show_step", {"step": "quote"})]},
        {"text": "실크는 닦기 쉬워요."},
        {"text": "늦게 끝난 답이에요."},
    )
    signup(api)
    chat_id = api.post("/v2/ask", json={"message": ASK}).json()["chat_id"]
    # 화면 도구를 기다리는 질문(열 때 rev=2) 사이에 다른 질문이 먼저 저장된다(rev 2 → 3)
    waiting = api.post("/v2/ask", json={"message": "도구 쓰는 질문", "chat_id": chat_id}).json()
    assert not waiting["done"] and waiting["chat_id"] == chat_id
    early = api.post("/v2/ask", json={"message": "먼저 끝난 질문", "chat_id": chat_id})
    assert early.json()["done"]
    late = api.post(f"/v2/ask/{waiting['turn']}", json={"results": [{"id": "c1", "content": "{}"}]})
    assert late.status_code == 409, late.text
    texts = [m["text"] for m in _messages(chat_id)]
    assert "도구 쓰는 질문" not in texts and "늦게 끝난 답이에요." not in texts and len(texts) == 4


def test_failed_answer_and_doc_buttons_leave_no_chat(api, fake):
    fake(llm.LLMError("시간 초과"), {"text": "철거비는 따로 계산이에요."})
    signup(api)
    out = api.post("/v2/ask", json={"message": ASK}).json()
    assert out["failed"] and out["chat_id"] is None
    quote = {"pyeong": 32, "cats": ["wallpaper", "carpentry"], "tier": "basic"}
    body = {"kind": "quote_explanation", "message": "철거비는 왜 따로예요?", "quote": quote}
    doc = api.post("/v2/ask", json=body).json()
    assert doc["done"] and doc["chat_id"] is None
    assert query("select count(*) as n from chats")[0]["n"] == 0


# 화면 도구 턴 (추천 질문은 서버가 고르므로 화면 도구인 show_step으로)
TOOL_TURN = {"tool_calls": [call("show_step", {"step": "quote"})]}
RESULT = {"results": [{"id": "c1", "content": "{}"}]}


def test_late_resume_cannot_delete_next_tool_turn(api, fake, monkeypatch):
    """A가 재개해 다음 도구 턴을 같은 키에 저장한 뒤, 그 전에 옛 턴을 읽어 둔 B가 늦게 와도
    B는 새 턴을 지우지 못하고 LLM 전에 404. A는 새 턴으로 그대로 이어 간다."""
    second = {"tool_calls": [call("show_step", {"step": "quote"}, "c2")]}
    f = fake(TOOL_TURN, second, {"text": "실크는 닦기 쉬워요."})
    signup(api)
    turn = api.post("/v2/ask", json={"message": ASK}).json()["turn"]
    stale = redis.Redis.from_url(REDIS_URL).get(ask._key(turn))  # B가 읽은 옛 턴

    a = api.post(f"/v2/ask/{turn}", json=RESULT).json()  # A: 다음 도구 턴(c2)을 같은 키에 저장
    assert not a["done"] and a["turn"] == turn and len(f.seen) == 2

    real_get = ask.redis.get

    async def stale_once(key):
        monkeypatch.setattr(ask.redis, "get", real_get)
        return stale

    monkeypatch.setattr(ask.redis, "get", stale_once)
    late = api.post(f"/v2/ask/{turn}", json=RESULT)  # B: 옛 턴(c1) 결과로 늦게 재개
    assert late.status_code == 404, late.text
    assert len(f.seen) == 2  # LLM을 다시 부르지 않았다

    done = api.post(f"/v2/ask/{turn}", json={"results": [{"id": "c2", "content": "{}"}]}).json()
    assert done["done"] and done["text"] == "실크는 닦기 쉬워요."


def test_duplicate_result_ids_are_422(api, fake):
    f = fake(TOOL_TURN, {"text": "실크는 닦기 쉬워요."})
    signup(api)
    turn = api.post("/v2/ask", json={"message": ASK}).json()["turn"]
    twice = {"results": [{"id": "c1", "content": "{}"}, {"id": "c1", "content": "{}"}]}
    assert api.post(f"/v2/ask/{turn}", json=twice).status_code == 422
    assert len(f.seen) == 1
    assert api.post(f"/v2/ask/{turn}", json=RESULT).json()[
        "done"
    ]  # 턴은 남아 있어 다시 보낼 수 있다


def test_wrong_results_keep_turn_for_retry(api, fake):
    fake(TOOL_TURN, {"text": "실크는 닦기 쉬워요."})
    signup(api)
    turn = api.post("/v2/ask", json={"message": ASK}).json()["turn"]
    bad = api.post(f"/v2/ask/{turn}", json={"results": [{"id": "x", "content": "{}"}]})
    assert bad.status_code == 422
    out = api.post(f"/v2/ask/{turn}", json=RESULT).json()
    assert out["done"] and out["text"] == "실크는 닦기 쉬워요."
    # 끝난 턴을 다시 보내면 404 (LLM 다시 안 부름)
    assert api.post(f"/v2/ask/{turn}", json=RESULT).status_code == 404


def test_chat_prompt_keeps_ask_back_mark_rule():
    """기다리는 역할은 답 끝 [되물음] 표시로만 남는다. 상담 지시문 판을 올려도 그 규칙이 있어야 한다"""
    assert ask_chat.ASKED in ask.PROMPTS["chat"]
