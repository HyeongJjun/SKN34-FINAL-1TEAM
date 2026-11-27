"""도배 상담의 기본 설정."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.agent.v3.trades import Slot, TradeSpec


def build(spec_type: type[TradeSpec], slot_type: type[Slot]) -> TradeSpec:
    return spec_type(
        "dobae",
        "도배",
        "deep",
        r"도배|벽지|초배|정배|합지|실크|도배풀|풀자국|퍼티|빠데|광폭|소폭|띠벽지|덧방\s*도배",
        ("도배",),
        7,
        cautions=(
            "천장 평탄화 · 몰딩 같은 목공이 끝난 뒤에 도배해요.",
            "곰팡이 · 습기가 있는 벽은 벽지보다 바탕부터 손봐요.",
        ),
        survey=("벽 · 천장 면적", "기존 벽지 상태(들뜸 · 곰팡이 · 결로)"),
        prep=("벽 앞 가구 옮기기", "벽에 건 액자 · 선반 떼기"),
        slots=(
            slot_type(
                "dobae.grade",
                "오래 사실 집인가요, 세 놓을 집인가요?",
                ("오래 살 집", "세 놓을 집", "아직 몰라요"),
                fact="grade",
            ),
            slot_type(
                "dobae.ceiling",
                "천장도 같이 도배하실 건가요?",
                ("천장도 해요", "벽만 해요", "아직 몰라요"),
            ),
            slot_type(
                "dobae.living",
                "공사하는 동안 그 집에 사세요?",
                ("살면서 해요", "빈 집이에요", "아직 몰라요"),
                fact="living",
            ),
            slot_type(
                "dobae.mold", "벽에 곰팡이나 물자국이 있나요?", ("있어요", "없어요", "아직 몰라요")
            ),
            slot_type(
                "dobae.area_basis",
                "넣으신 면적이 공급면적인가요, 전용면적인가요?",
                ("공급면적이에요", "전용면적이에요", "아직 몰라요"),
                fact="area_basis",
            ),
        ),
        calc=True,
    )
