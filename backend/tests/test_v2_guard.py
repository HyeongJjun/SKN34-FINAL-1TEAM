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


def test_periods_only_from_calc():
    """공사 기간(일 · 주 · 개월)은 계산 결과에 있어야 통과한다. 자료 · 고객 글에 있어도 안 된다."""
    calc = '{"work_days": 6, "blocks": [{"start": "2026-12-03", "days": 2}]}'
    r = check("목공은 3~5일 걸려요. 일하는 날은 6일이에요.", "목공 3~5일", calc)
    assert r.text == "일하는 날은 6일이에요." and len(r.dropped) == 1
    assert check("보통 9주 걸려요.", "9주", calc).dropped
    assert check("12월 3일에 시작해요.", calc, calc).dropped == []  # 날짜는 기간이 아니다
    assert check("12월 3일에 시작해요.", "12월 3일", "").dropped == []  # 고객이 쓴 날짜도 된다
    assert check("목공은 7일 걸려요.", "7", "").dropped  # 계산 결과가 없으면 기간은 못 말한다
    assert check("목공은 7일 걸려요.", "7").dropped == []  # calc_text를 안 주면 예전처럼
