"""v2 AI 답 숫자 검사. 순수 함수만 본다."""

from app.v2.guard import check


def test_keeps_allowed_numbers_and_rounded_manwon():
    r = check("표준견적서는 3,364,291원이에요. 약 336만 원이에요.", "합계 3364291")
    assert r.dropped == [] and "336만 원" in r.text


def test_drops_unknown_numbers_but_keeps_lines():
    r = check("도배는 2일 걸려요.\n\n평당 3만 원이에요. 업체에 물어보세요.", "도배 2일")
    assert r.text == "도배는 2일 걸려요.\n\n업체에 물어보세요."
    assert r.dropped == ["계산 결과 · 자료에 없는 숫자(3만 원)"]


def test_small_rounding_does_not_pass():
    assert check("평당 2만 원이에요.", "몰딩 m당 1만~1.6만 원").dropped


def test_counts_hangul_money_banned_and_masking():
    assert check("확인할 것은 3가지예요.", "").dropped == []
    assert check("삼백만 원이에요.", "").dropped == ["한글로 쓴 금액 · 면적"]
    assert check("그 업체는 바가지예요.", "").dropped == ["쓰면 안 되는 표현"]
    assert "(번호 가림)" in check("010-1234-5678로 연락하세요.", "010 1234 5678").text


def test_citation_marks_stay_with_sentence():
    r = check("공사 1주일 전에 신고해요. [K12]", "1주일")
    assert r.text == "공사 1주일 전에 신고해요. [K12]"
