"""부분 공사 공간 몫 (D02 A): 고른 공간이 집 전체 도배 면적(벽 + 천장)에서 차지하는 비율.

- 팀 가정값이에요. 9판 C60의 '거실 32% · 주방 14%'는 그림 예시라 쓰지 않았어요.
  공개 평면도 20곳(refprice.floor_plans `plans-2026.11-v9`)을 calc.plan_qty로 셈해
  공간 종류마다 가운뎃값을 소수 두 자리로 잡았어요.
  - 안방 = 이름이 안방인 방(없으면 가장 넓은 방), 작은방 1 · 2 = 나머지 방 중 넓은 순이에요.
  - 작은방 2는 방이 셋 이상인 평면 12곳, 드레스룸은 15곳에만 있어요.
- 고른 몫을 더해 1을 넘으면 1로 둬요. 판(version)은 견적에 고정해요(standard_quotes.share_ver, 20자).
- 공간 몫 표 자료(B6)가 생기면 refprice로 옮기고 판을 올려요.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

D = Decimal


@dataclass(frozen=True)
class SpaceShares:
    """공간 몫 표 한 판. share: 공간 종류(project.models.SPACE_KINDS) → 몫(0~1)"""

    version: str
    share: dict[str, Decimal]
    source: str


SPACE_SHARE_2026_11 = SpaceShares(
    version="space-share-2026.11",
    share={
        "living": D("0.21"),  # 거실
        "kitchen": D("0.11"),  # 주방 (싱크대 · 타일 벽이라 벽지는 절반으로 셈)
        "master": D("0.19"),  # 안방
        "room1": D("0.17"),  # 작은방 1
        "room2": D("0.15"),  # 작은방 2
        "hall": D("0.08"),  # 복도
        "entry": D("0.06"),  # 현관
        "dress": D("0.08"),  # 드레스룸
    },
    source="팀 가정값 · 공개 평면도 20곳 공간별 도배 면적 비율 가운뎃값 (plans-2026.11-v9)",
)


def share_of(kinds: Iterable[str], t: SpaceShares) -> Decimal:
    """고른 공간 몫의 합 (1을 넘으면 1). 모르는 공간 종류는 KeyError, 아무것도 안 고르면 ValueError."""
    picked = list(dict.fromkeys(kinds))
    if not picked:
        raise ValueError("부분 공사할 공간을 골라야 해요")
    return min(sum((t.share[k] for k in picked), D(0)), D(1))
