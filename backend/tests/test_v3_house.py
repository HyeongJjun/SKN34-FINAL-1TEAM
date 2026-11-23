"""이 집 답 모양(agent-08 무료 판): 결론 한 줄 · 이 집 견적서 카드 · 업체에 요청할 말."""

import re

from test_v3_agent_turn import FACTS, turn

from app.agent.v3 import gate

DIGIT = re.compile(r"\d")


def test_quote_line_question_gets_house_card_and_calc_numbers_only():
    a = turn("철거는 왜 합계에 안 들어가요?", facts=FACTS).answer
    assert a.lead  # 첫 문장이 결론으로 올라와요
    (card,) = [c for c in a.cards if c.kind == "house"]
    assert card.title == "이 집 견적서의 기존 벽지 철거"
    rows = {r.cells[0]: r.cells[1] for r in card.table.rows}
    assert (
        rows["수량 · 단가"] == "173.5㎡ · 1,727원" and rows["금액"] == "299,635원"
    )  # 계산 값 그대로
    assert len(a.vendor) == 2 and "173.5㎡" in a.vendor[0] and a.vendor[1].endswith("적어 주세요.")
    assert "업체에:" in a.plain()  # 다음 턴 직전 대화에도 남아요


def test_meaning_question_goes_to_trade_and_vendor_has_no_numbers():
    g = gate.gate(
        "퍼티 작업이 뭐야?", view=None, waiting=None, button=None, has_project=True, ignore=[]
    )
    assert g.route == "trade"  # 날짜 말이 없는 뜻 질문은 일정이 아니에요
    a = turn("퍼티 작업이 뭐야?", facts=FACTS).answer
    assert a.lead.startswith("퍼티")
    assert len(a.vendor) == 2 and "퍼티 작업" in a.vendor[0]
    assert not any(DIGIT.search(v) for v in a.vendor)  # 계산 값이 없으면 숫자를 쓰지 않아요
    assert not [
        c for c in a.cards if c.kind == "house"
    ]  # 금액을 묻지 않았으니 견적서 카드는 없어요


def test_problem_question_asks_cause_first_without_verdict():
    a = turn("벽지에 곰팡이가 폈어요", facts=FACTS).answer
    assert a.vendor[0].startswith("곰팡이가 왜 그런지 원인부터")
    assert not any(re.search(r"하자예요|보상|업체\s*잘못", v) for v in a.vendor)
    assert not [
        c for c in a.cards if c.kind == "house"
    ]  # '벽지' 낱말만으로 견적서 줄을 붙이지 않아요


def test_guide_question_keeps_old_shape():
    a = turn("계약서는 언제 써요?", facts=FACTS).answer
    assert a.lead == "" and a.vendor == []
