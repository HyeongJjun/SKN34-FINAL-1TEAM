"""채팅 글 규칙 (순수 함수): 믿집 밖 거래 주의 줄(D05 A) · 동 · 호 꼴(I7 B). 합성 문장만."""

import pytest

from app.thread import rules

OFFSITE = [
    "현금으로 하시면 10% 빼 드릴게요. 계약은 따로 하시죠.",
    "계좌로 먼저 보내 주시면 할인해 드려요",
    "선입금 50% 부탁드려요",
    "입금 확인되면 바로 시작할게요",
    "직거래로 하시면 더 싸게 해 드려요",
    "믿집 말고 따로 계약하시면 수수료 없이 돼요",
    "수수료 아끼시려면 저랑 바로 하세요",
    "카톡 아이디 maru123 으로 연락 주세요",
    "카카오톡 ID 알려 드릴게요",
    "오픈채팅방으로 사진 보내 주세요",
    "https://open.kakao.com/o/abcd 들어오세요",
    "후기는 www.example.com 에서 보세요",
    "국민은행 123456-78-901234 로 보내 주세요",
    "신한 110 123 456789 예금주 홍길동",
    "텔레그램으로 얘기해요",
]
PLAIN = [
    "안녕하세요, 마루와벽이에요.",
    "15일 오전 10시쯤 가도 될까요?",
    "도착 전에 연락 드릴게요",
    "주차는 지하 2층에 하면 돼요",
    "벽지 샘플 사진 보내 드릴게요",
    "견적서는 실측 뒤 3일 안에 보내 드려요",
    "3호선 수서역 근처예요",
    "1203번 버스 타고 가요",
    "견적은 345만 원이에요",
    "69.4㎡ 기준으로 계산했어요",
    "곰팡이 방지 처리도 같이 해 드릴게요",
    "내일 비가 오면 하루 미룰게요",
]


@pytest.mark.parametrize("text", OFFSITE)
def test_offsite_words_are_caught(text):
    assert rules.offsite(text)


@pytest.mark.parametrize("text", PLAIN)
def test_plain_vendor_talk_is_not_warned(text):
    assert not rules.offsite(text)


def test_offsite_empty():
    assert not rules.offsite(None) and not rules.offsite("")


@pytest.mark.parametrize(
    "text",
    [
        "○○아파트 101동 1203호예요.",
        "101 동 1203 호",
        "202동1503호로 오세요",
        "１０１동 １２０３호",  # 전각 숫자
    ],
)
def test_address_pattern(text):
    assert rules.has_address(text)


@pytest.mark.parametrize(
    "text",
    ["상계동 아파트예요", "3호선 타고 가요", "101동이에요", "1203호", "", None],
)
def test_not_address(text):
    assert not rules.has_address(text)
