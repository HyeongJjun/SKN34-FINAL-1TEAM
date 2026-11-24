"""AI 칸 사진 (#181 2단계): 붙인 사진 권한 · 장수 · 하루 상한, 무료 모드 안내, LLM 모드에서 본 것 → 질문 바꾸기,
읽기 실패 · 사람이 찍힌 사진. LLM은 스텁만 쓴다(유료 호출 0회).
"""

import uuid

import pytest
from conftest import query
from helpers import signup, upload, use
from v3_kb import repo_index

from app.agent import llm
from app.agent.v3 import photo
from app.agent.v3.photo import PhotoSeen
from tests.test_v3_ai_api import ask, done, events

LOOK = "이 사진 좀 봐 주세요"


@pytest.fixture(autouse=True)
def repo_knowledge(monkeypatch):
    from app.knowledge import service as knowledge

    async def index(_s):
        return repo_index()

    monkeypatch.setattr(knowledge, "index", index)
    yield
    llm.clear_stubs()


@pytest.fixture
def llm_mode(monkeypatch):
    from app.chat import service

    monkeypatch.setattr(service, "mode", lambda: "llm")


def photo_id(api, kind="photo") -> str:
    r = upload(api, kind)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_lines_and_question_are_fixed_words_only():
    seen = PhotoSeen(
        indoor_surface=True, symptoms=["mold", "mold", "stain"], where="ceiling", private=True
    )
    got = photo.lines(seen, read=True)
    assert got[0] == "사진에서 천장에 곰팡이 · 얼룩 · 물자국처럼 보이는 곳이 있어요."
    assert got[1:] == [photo.ONLY_SEEN, photo.ASK_VENDOR, photo.PERSON]
    assert photo.lines(None, read=False) == [photo.NOT_READ]
    assert photo.lines(None, read=True) == [photo.FAILED]
    assert photo.lines(
        PhotoSeen(indoor_surface=False, symptoms=[], where="unknown", private=False), read=True
    ) == [photo.NOT_HOME]
    assert photo.lines(
        PhotoSeen(indoor_surface=True, symptoms=[], where="unknown", private=False), read=True
    ) == [photo.NOTHING]
    # 사진만 올렸으면 증상에 맞는 질문, 따로 물었으면 그 말 그대로, 자료 없는 증상은 바꾸지 않는다
    assert photo.question_for(LOOK, seen) == photo.QUESTION["mold"]
    assert (
        photo.question_for("합지랑 실크 중에 뭐로 해야 해요?", seen)
        == "합지랑 실크 중에 뭐로 해야 해요?"
    )
    assert (
        photo.question_for(
            LOOK,
            PhotoSeen(
                indoor_surface=True, symptoms=["condensation"], where="unknown", private=False
            ),
        )
        == LOOK
    )
    assert (
        photo.question_for(
            LOOK, PhotoSeen(indoor_surface=False, symptoms=["mold"], where="unknown", private=False)
        )
        == LOOK
    )
    assert photo.question_for(LOOK, None) == LOOK
    # 공종 낱말이 든 짧은 말은 진짜 질문이다(사진 전용 말로 보지 않는다)
    for real in ["실크 벽지로 하면 어때요?", "이거 합지로 해도 괜찮아요?"]:
        assert not photo.is_generic(real) and photo.question_for(real, seen) == real
    assert photo.is_generic(LOOK) and photo.is_generic("이거 뭐예요?")
    for line in [*photo.SYMPTOM_KO.values(), *photo.QUESTION.values()]:
        assert not any(ch.isdigit() for ch in line), line  # 숫자를 말하지 않는다


def test_free_mode_does_not_read_and_says_so_first(api):
    use(api, signup(api))
    r = ask(api, text=LOOK, file_ids=[photo_id(api)])
    out = done(r)
    assert out["mode"] == "free" and out["answer"]["photo"] == [photo.NOT_READ]
    # 사진만 올린 말("이 사진 좀 봐 주세요")은 글 질문으로 돌리지 않는다: 엉뚱한 답 · 금액이 붙지 않게
    assert (
        out["answer"]["sections"] == []
        and out["answer"]["calc"] == []
        and not out["answer"]["lead"]
    )
    said = [d for e, d in events(r.text) if e == "token"]
    assert said[0] == {"section": None, "text": photo.NOT_READ}
    row = query(
        "select text from chat_messages where role = 'user' order by created_at desc limit 1"
    )
    assert row[0]["text"] == f"{LOOK} (사진 1장)"


def test_only_my_room_photos_up_to_three(api):
    other = signup(api, "other@mitjip.test")
    use(api, other)
    theirs = photo_id(api)
    use(api, signup(api, "me@mitjip.test"))
    mine = [photo_id(api) for _ in range(4)]
    assert ask(api, text=LOOK, file_ids=[theirs]).status_code == 404  # 남의 파일
    assert ask(api, text=LOOK, file_ids=[str(uuid.uuid4())]).status_code == 404  # 없는 파일
    assert ask(api, text=LOOK, file_ids=[photo_id(api, "plan")]).status_code == 404  # 다른 종류
    assert ask(api, text=LOOK, file_ids=mine).status_code == 422  # 4장
    assert done(ask(api, text=LOOK, file_ids=mine[:3]))["answer"]["photo"]
    assert query("select count(*) n from chat_messages")[0]["n"] == 2  # 통과한 한 턴만 저장


def test_llm_mode_turns_what_it_saw_into_an_answerable_question(api, llm_mode):
    use(api, signup(api))
    llm.set_stub(
        "photo", PhotoSeen(indoor_surface=True, symptoms=["mold"], where="ceiling", private=False)
    )
    out = done(ask(api, text=LOOK, file_ids=[photo_id(api)]))
    a = out["answer"]
    assert a["photo"][0] == "사진에서 천장에 곰팡이처럼 보이는 곳이 있어요."
    assert a["photo"][1] == photo.ONLY_SEEN
    assert a["sections"] and not a["unknown"]  # 곰팡이 질문으로 바꿔 자료로 답했다
    saved = query("select role, text from chat_messages order by created_at")
    assert saved[0]["text"] == f"{LOOK} (사진 1장)"  # 저장한 질문은 고객이 쓴 말
    assert saved[1]["text"].startswith(a["photo"][0])


def test_llm_mode_keeps_the_customers_own_question(api, llm_mode):
    use(api, signup(api))
    llm.set_stub(
        "photo", PhotoSeen(indoor_surface=True, symptoms=["lifting"], where="wall", private=True)
    )
    a = done(ask(api, file_ids=[photo_id(api)]))["answer"]  # 글 질문: 합지 · 실크
    assert a["photo"][0] == "사진에서 벽에 벽지 들뜸처럼 보이는 곳이 있어요."
    assert a["photo"][-1] == photo.PERSON
    assert any("합지" in s or "실크" in s for sec in a["sections"] for s in sec["sentences"])


def test_llm_failure_says_so_and_still_answers_the_text(api, llm_mode, monkeypatch):
    use(api, signup(api))

    async def boom(*_a, **_k):
        raise llm.LLMError("photo 호출 실패")

    monkeypatch.setattr(llm, "see", boom)
    a = done(ask(api, file_ids=[photo_id(api)]))["answer"]
    assert a["photo"] == [photo.FAILED] and a["sections"]


def test_photos_per_day_are_limited(api, monkeypatch, llm_mode):
    use(api, signup(api))
    llm.set_stub(
        "photo", PhotoSeen(indoor_surface=True, symptoms=[], where="unknown", private=False)
    )
    monkeypatch.setattr(photo, "PER_DAY", 2)
    ids = [photo_id(api) for _ in range(3)]
    assert ask(api, text=LOOK, file_ids=ids[:2]).status_code == 200
    r = ask(api, text=LOOK, file_ids=ids[2:])
    assert r.status_code == 429 and r.json()["error"]["message"].startswith("오늘은 사진을")


def test_symptom_without_material_only_says_what_it_saw(api, llm_mode):
    use(api, signup(api))
    llm.set_stub(
        "photo",
        PhotoSeen(indoor_surface=True, symptoms=["condensation"], where="window", private=False),
    )
    a = done(ask(api, text=LOOK, file_ids=[photo_id(api)]))["answer"]
    assert a["photo"] == [
        "사진에서 창 둘레에 결로(물방울 · 물기)처럼 보이는 곳이 있어요.",
        photo.ONLY_SEEN,
        photo.ASK_VENDOR,
    ]
    assert a["sections"] == [] and a["calc"] == []


def test_free_mode_does_not_count_photos_and_answers_a_real_question(api, monkeypatch):
    use(api, signup(api))
    monkeypatch.setattr(photo, "PER_DAY", 1)
    for _ in range(2):  # 읽지 않는 무료 모드는 하루 한도를 깎지 않는다
        a = done(ask(api, file_ids=[photo_id(api)]))["answer"]  # 글 질문: 합지 · 실크
    assert a["photo"] == [photo.NOT_READ] and a["sections"]  # 사진은 못 읽어도 글 질문에는 답한다
