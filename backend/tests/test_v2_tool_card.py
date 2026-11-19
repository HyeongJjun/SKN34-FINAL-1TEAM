import pytest

from app.v2.ask_tools import STEPS
from app.v2.tool_card import CARDS, pick


@pytest.mark.parametrize(
    ("question", "tool", "arg"),
    [
        ("작은방 벽지 몇 롤 필요해요?", "calc", "wall"),
        ("롤 수는 어떻게 계산해요?", "calc", "wall"),
        ("거실 벽지 얼마나 사야 해요?", "calc", "wall"),
        ("몰딩 몇 개 사야 돼요?", "calc", "trim"),
        ("걸레받이 몇 m 필요해요", "calc", "trim"),
        ("페인트 몇 통 사면 될까요?", "calc", "paint"),
        ("방 하나 페인트 양이 얼마나 필요해요", "calc", "paint"),
        ("관리사무소에 뭐 신고해야 해요?", "check", "before"),
        ("엘리베이터 보양은 누가 해요?", "check", "before"),
        ("계약서에 뭘 꼭 적어야 해요?", "check", "contract"),
        ("계약 전에 확인할 거 알려 줘", "check", "contract"),
        ("도배 끝나고 검수는 어떻게 해요?", "check", "after"),
        ("잔금 전에 뭘 봐야 해요?", "check", "after"),
        ("견적 받았는데 350만 원이면 비싼가요?", "compare", None),
        ("받은 견적이 적당한지 알고 싶어요", "compare", None),
        # 보여 달라는 말: 이미 있는 화면 단계를 연다
        ("표준견적서 양식 볼 수 있을까?", "step", "quote"),
        ("견적서 예시 보여주실래요?", "step", "quote"),
        ("도배 견적서 볼 수 있어요?", "step", "quote"),  # 벽지 견본이 아니다
        ("도배 이미지 보여줄래?", "step", "materials"),
        ("실크벽지 사진 볼 수 있어요?", "step", "materials"),
        ("벽지 좀 보여 주세요", "step", "materials"),
        ("인테리어 사진 보여줘", "step", "styles"),
        ("어떤 스타일이 있는지 보여줘", "step", "styles"),
    ],
)
def test_pick_card(question: str, tool: str, arg: str | None) -> None:
    got = pick(question)
    assert got is not None
    card, hint = got
    assert (card.tool, card.arg) == (tool, arg)
    assert card.label in hint


@pytest.mark.parametrize(
    "question",
    [
        "32평 도배하면 얼마예요?",
        "벽지 비용이 얼마나 들어요?",  # 돈을 묻는 말은 계산기가 아니다
        "실크벽지랑 합지벽지 차이가 뭐예요?",
        "도배 며칠 걸려요?",
        "롤러로 칠하면 얼룩져요?",
        "엘리베이터 없는 5층이면 도배비가 더 들어요?",  # 돈을 묻는 말이다. 공사 전 준비가 아니다
        "계약금은 몇 퍼센트가 보통이에요?",
        "도배 전에 사진 찍어 둬야 해요?",  # 사진을 보여 달라는 말이 아니다
        "표준견적서가 뭐예요?",
        "모던 스타일이 뭐예요?",
        # '해볼 수 · 알아볼 수'는 보여 달라는 말이 아니고, 볼 것(사진 · 견본) 없이 '볼 수'만으로는 견본을 열지 않는다
        "도배 셀프로 해볼 수 있어요?",
        "벽지 가격 알아볼 수 있어요?",
        "도배 업체 알아볼 수 있나요?",
        "도배 견적 볼 수 있어요?",
        "도배 일정 볼 수 있어요?",
        "도배 순서 볼 수 있어요?",
        "스타일 바꿔 볼 수 있어요?",
    ],
)
def test_no_card(question: str) -> None:
    assert pick(question) is None


def test_step_card_tells_llm_not_to_refuse() -> None:
    got = pick("도배 이미지 보여줄래?")
    assert got is not None
    assert "보여 드릴 수 없" in got[1]  # '보여 드릴 수 없어요'라고 하지 말라는 힌트


@pytest.mark.parametrize(
    "question",
    ["견적서 보여 주면 비싼지 봐 줄 수 있어요?", "벽지 사진 보여 줄게요. 어떤가요?"],
)
def test_customer_showing_is_not_step_card(question: str) -> None:
    # 고객이 자기 것을 보여 주겠다는 말은 화면 단계를 여는 카드가 아니다
    got = pick(question)
    assert got is None or got[0].tool != "step"


def test_step_cards_open_real_steps() -> None:
    args = {arg for tool, arg, *_ in CARDS if tool == "step"}
    assert args == {"quote", "materials", "styles"}
    assert args <= set(STEPS)  # 화면이 열 수 있는 단계 이름
