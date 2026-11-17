"""고객 수준: 고른 목적 + 이번 질문 낱말로 이번 턴의 말하기 깊이를 정한다."""

from app.v2.level import level_of, level_text


def test_said_level_is_kept_for_plain_questions():
    assert level_of("looking", "도배는 언제 해요?")[0] == "looking"
    assert level_of(None, "도배는 언제 해요?")[0] == "looking"


def test_meaning_question_drops_to_new_for_this_turn():
    assert level_of("experienced", "초배가 뭐예요?")[0] == "new"


def test_trade_words_raise_level_for_this_turn():
    assert level_of("new", "몰딩을 일식으로 적어도 되나요?")[0] == "looking"
    assert level_of("looking", "덧방이랑 일식 견적 차이가 커요")[0] == "experienced"


def test_level_text_names_reason():
    t = level_text("new", "몰딩 바꿔야 해요?")
    assert "이번 답의 수준: 처음" in t and "첫 화면에서 고른 목적" in t
