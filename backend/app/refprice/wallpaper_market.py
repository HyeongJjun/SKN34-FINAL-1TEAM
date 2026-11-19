"""벽지 시장 평균 가격(사용자 결정 D07). 표준견적서 '○○벽지 시장 평균 가격 · N평 × 단가' 줄의 자재 단가예요.

- 단위: 벽지(도배지) 면적 1평(3.3058㎡)당 원, 부가세 별도. 수량(벽지 평)은 계산 엔진이 만들어요
  (도배 면적 × 1.2 ÷ 3.3058, 소수 한 자리 — data-model 6장).
- 화면 값은 평균이에요(사용자 말 '시장 평균'). 중앙값 · 25~75% 범위를 같이 둬요.
- 계산: 실견적 줄 · 판매 가격표의 롤값을 한 출처 30건 상한 가중으로 평균 → ÷ 16.5㎡ × 3.3058 (ADR data-01)
- 자료: data/v3/wallpaper_price/result.json (`python -X utf8 data/v3/scripts/wallpaper_price.py`로 다시 만들어요)
- 예전 값 `book.SILK_2026`(업체 견적서 1건의 9,500 · 15,000원)은 다른 코드가 써서 그대로 둬요.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

Grade = Literal["economy", "basic"]  # calc의 도배 유형: economy 합지 · basic 실크

PAPER_PYEONG_M2 = Decimal("3.3058")  # 벽지 1평
ROLL_M2 = Decimal("16.5")  # 실크 · 광폭합지 한 롤(약 106cm × 15.6m · 93cm × 17.75m)
VERSION = "paper-market-2026.11"
CHECKED = date(2026, 11, 18)
SOURCE_FILE = "data/v3/wallpaper_price/result.json"


@dataclass(frozen=True)
class PaperMarket:
    """벽지 한 종류의 시장 자재값. per_py가 화면에 쓰는 값(평균)이에요."""

    grade: Grade
    name: str  # 화면 이름: 합지벽지 · 실크벽지
    per_py: int  # 벽지 평당 평균(원, 부가세 별도) ← 화면 값
    stat: str  # per_py를 만든 통계: mean(평균)
    median_per_py: int
    p25_per_py: int
    p75_per_py: int
    per_m2: Decimal  # 벽지 ㎡당 평균(원, 소수 한 자리)
    roll_mean: int  # 롤(16.5㎡)당 평균
    roll_median: int
    n: int  # 근거 줄 수(롤값)
    sources: tuple[str, ...]
    basis: str  # 화면 · 설명에 붙일 한 줄
    version: str = VERSION
    checked: date = CHECKED


@dataclass(frozen=True)
class InstallMarket:
    """참고값: 아파트 집 전체 도배(자재 + 시공 + 부자재) 공급 평당 시장가. 비교 · 설명용이에요(계산에 안 써요)."""

    grade: Grade
    mean_per_supply_py: int  # 평균(같은 무게)
    median_per_supply_py: int  # 대표값(가중 중앙값, ADR data-01)
    p25: int
    p75: int
    p10: int
    p90: int
    n: int  # 실견적 수
    sources: int  # 출처 수
    basis: str
    version: str = VERSION
    checked: date = CHECKED


PAPER_MARKET_2026_11: dict[Grade, PaperMarket] = {
    "economy": PaperMarket(
        grade="economy",
        name="합지벽지",
        per_py=4_577,
        stat="mean",
        median_per_py=4_608,
        p25_per_py=4_608,
        p75_per_py=4_608,
        per_m2=Decimal("1384.5"),
        roll_mean=22_845,
        roll_median=23_000,
        n=58,
        sources=("대동벽지 견적 게시판 줄별 내역(광폭합지)",),
        basis="광폭합지 롤값 58줄 평균 22,845원 ÷ 16.5㎡ × 3.3058 (한 가게 자료라 범위가 좁아요)",
    ),
    "basic": PaperMarket(
        grade="basic",
        name="실크벽지",
        per_py=10_749,
        stat="mean",
        median_per_py=9_617,
        p25_per_py=9_016,
        p75_per_py=13_223,
        per_m2=Decimal("3251.5"),
        roll_mean=53_650,
        roll_median=48_000,
        n=279,
        sources=(
            "대동벽지 견적 게시판 줄별 내역",
            "디시 인테리어 갤러리 견적서",
            "아정당 실크벽지 롤당 가격표(2026-02-25)",
            "11번가 실크벽지 1롤 판매가",
        ),
        basis="실크 롤값 279줄(출처 4곳, 한 출처 30건 상한) 평균 53,650원 ÷ 16.5㎡ × 3.3058",
    ),
}

INSTALL_MARKET_2026_11: dict[Grade, InstallMarket] = {
    "economy": InstallMarket(
        grade="economy",
        mean_per_supply_py=42_761,
        median_per_supply_py=41_372,
        p25=36_917,
        p75=46_875,
        p10=33_333,
        p90=55_692,
        n=112,
        sources=8,
        basis="2025~2026 아파트 집 전체 합지 실견적 112건(출처 8곳) · 부가세 별도로 봐요",
    ),
    "basic": InstallMarket(
        grade="basic",
        mean_per_supply_py=92_698,
        median_per_supply_py=86_129,
        p25=73_471,
        p75=104_545,
        p10=64_562,
        p90=126_923,
        n=614,
        sources=8,
        basis="2025~2026 아파트 집 전체 실크 실견적 614건(출처 8곳) · 부가세 별도로 봐요",
    ),
}


def paper_market(grade: Grade) -> PaperMarket:
    """도배 유형(economy 합지 · basic 실크)의 시장 자재값. 없는 유형이면 KeyError."""
    return PAPER_MARKET_2026_11[grade]


def install_market(grade: Grade) -> InstallMarket:
    return INSTALL_MARKET_2026_11[grade]
