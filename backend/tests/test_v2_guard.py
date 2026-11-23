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


def test_hangul_money_without_sip_baek_cheon():
    # 십 · 백 · 천이 없는 금액도 한글 금액이다 (#157)
    for s in (
        "평당 오만 원 정도예요.",
        "삼십만원이면 돼요.",
        "딱 만 원 차이예요.",
        "일억 원은 넘지 않아요.",
        "수십만 원이 들어요.",
        "몇백만 원 차이예요.",
        "수만 원 차이가 나요.",
        "몇만 원 더 들어요.",
    ):
        assert check(s, "").dropped == ["한글로 쓴 금액 · 면적"], s
    # 조사 '만' 뒤의 '원하다' · '원래'는 금액이 아니다
    for s in (
        "벽지만 원하는 걸로 고르세요.",
        "이번만 원래 계획대로 해요.",
        "오늘은 이만 원래대로 해요.",
    ):
        assert check(s, "").dropped == [], s
    # 숫자 금액의 '만 원'은 숫자 검사가 본다
    assert check("약 336만 원 · 3 만 원이에요.", "3364291 30000").dropped == []


def test_native_periods_only_from_calc():
    # 하루 · 이틀 · 일주일 · 한 달도 숫자 기간처럼 계산 결과에 있어야 통과한다 (#157)
    calc = '{"work_days": 2}'
    assert check("보통 이틀이면 끝나요.", "", calc).dropped == []
    for s in ("보통 사흘 걸려요.", "일주일 걸려요.", "한 달은 잡으세요.", "세 주 정도예요."):
        assert check(s, "", calc).dropped, s
    # 계산 결과가 없으면 자료에 같은 말이 있어야 통과한다
    assert check("도배 뒤 하루 정도 환기하세요.", "환기는 하루 정도 해요").dropped == []
    assert check("도배 뒤 이틀 정도 환기하세요.", "환기는 하루 정도 해요").dropped
    # 기간이 아닌 말은 그대로 둔다
    for s in ("세 달러예요.", "한 주민이 민원을 냈어요.", "정월 대보름이에요."):
        assert check(s, "", calc).dropped == [], s
    # 단위 · 빈도로 쓴 말도 기간이 아니다 (품 설명 카드: "하루 시공량", "하루에 바르는 양")
    for s in (
        "표준품셈은 하루 시공량으로 정해요.",
        "하루에 한 공정씩 잡아요.",
        "한 달에 한 번 봐요.",
        "철거는 하루 중 언제 해도 돼요.",
    ):
        assert check(s, "", calc).dropped == [], s
    # '에' · '작업'이 붙어도 공사 기간이면 검사한다 (#163 리뷰)
    for s in (
        "도배를 사흘에 끝낼 수 있어요.",
        "하루에 다 끝나요.",
        "나흘에 걸쳐 해요.",
        "사흘 작업이면 돼요.",
    ):
        assert check(s, "", calc).dropped, s
    assert check("하루 작업량으로 정해요.", "", calc).dropped == []


def test_period_with_words_between_and_units():
    # 기간과 완료 표현 사이에 다른 말이 있어도 공사 기간으로 본다 (#163 재검토 1)
    calc = '{"work_days": 2}'
    for s in (
        "사흘에 도배를 끝낼 수 있어요.",
        "하루에 도배 끝낼 수 있어요.",
        "일주일에 거실까지 마무리해요.",
    ):
        assert check(s, "", calc).dropped, s
    for s in ("하루에 바르는 양이 정해져 있어요.", "한 달에 한 번 환기 상태를 봐요."):
        assert check(s, "", calc).dropped == [], s
    # 기간은 단위까지 맞아야 통과한다: 계산 결과 1일이면 일주일 · 한 달 · 1주는 안 된다 (#163 재검토 2)
    for c in ('{"work_days": 1}', "도배 1일"):
        for s in (
            "일주일 걸려요.",
            "한 달 걸려요.",
            "1주 걸려요.",
            "1개월 걸려요.",
            "3~5주 걸려요.",
        ):
            assert check(s, "", c).dropped, (c, s)
        for s in ("하루 걸려요.", "1일 걸려요."):
            assert check(s, "", c).dropped == [], (c, s)
    assert check("2주 걸려요.", "", "공사 14일").dropped == []
    assert check("일주일 걸려요.", "", "공사 1주").dropped == []


def test_more_period_and_number_forms():
    calc = '{"work_days": 2}'
    # 한자어 · 반 · 반나절 · 전각 숫자도 기간 · 숫자로 본다
    for s in (
        "삼일이면 끝나요.",
        "사 일 걸려요.",
        "육 개월 걸려요.",
        "이틀 반 걸려요.",
        "반나절이면 끝나요.",
        "３일 걸려요.",
        "３０만 원이에요.",
    ):
        assert check(s, "", calc).dropped, s
    assert check("이틀 반 걸려요.", "", "2.5일").dropped == []
    # 기간이 아닌 말은 둔다
    for s in (
        "하루라도 빨리 연락하세요.",
        "하루하루 환기하세요.",
        "가장 이른 반나절을 골라요.",
        "이 일이 먼저예요.",
        "오일 스테인을 발라요.",
        "삼일절에는 쉬어요.",
    ):
        assert check(s, "", calc).dropped == [], s
