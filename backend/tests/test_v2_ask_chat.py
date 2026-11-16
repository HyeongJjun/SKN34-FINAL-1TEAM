"""v2 상담 한 턴을 대화 표에 잇기 (C안, #111): 지난 대화 · 남의 대화 404 · 번호표(rev) 409 · 재개 한 번만(#119)."""

import pytest

from app.agent import llm
from app.v2 import ask
from tests.conftest import query
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
        {"tool_calls": [call("suggest_questions", {"questions": ["벽지 고르기"]})]},
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


TOOL_TURN = {"tool_calls": [call("suggest_questions", {"questions": ["벽지 고르기"]})]}
RESULT = {"results": [{"id": "c1", "content": "{}"}]}


def test_resume_taken_by_other_request_is_404_before_llm(api, fake, monkeypatch):
    f = fake(TOOL_TURN, {"text": "실크는 닦기 쉬워요."})
    signup(api)
    turn = api.post("/v2/ask", json={"message": ASK}).json()["turn"]

    async def lost(*keys):  # 같은 턴 재개가 겹쳐 다른 요청이 먼저 턴을 가져갔다
        return 0

    monkeypatch.setattr(ask.redis, "delete", lost)
    r = api.post(f"/v2/ask/{turn}", json=RESULT)
    assert r.status_code == 404, r.text
    assert len(f.seen) == 1  # 재개 쪽 LLM은 부르지 않았다


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
