"""ADR data-04 금액 영향표: 계산 엔진 가정값 4개를 자료 값으로 바꾸면 24 · 34평 집 금액이 얼마나 바뀌는지.

- 계산 엔진(app.calc.dobae.quote)과 단가 묶음(app.refprice.book.DOBAE_2026H2)은 고치지 않아요.
  dataclasses.replace로 복사본만 바꿔 넣어 봐요.
- 표준견적서 합계는 v3 도배지 줄(벽지 평 × 시장 평균 10,749원, data-model 6장)로 바꿔 셈해요.
- 가견적은 9판 C11 업체 단가(퍼티 20,000 · 실크 9,500 · 부자재 13,000 · 인건비 300,000)의 주요 4줄만 셈해요.
- 집: 실크 · 천장 포함 · 빈 집. 24평형 = 공급 79.3㎡ / 전용 59㎡, 34평형 = 공급 112.4㎡ / 전용 84㎡.
실행: cd backend && uv run --no-sync python ../data/v3/scripts/engine_impact.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.calc.common import PYEONG_M2, half_up, won
from app.calc.dobae import DobaeInput, quote
from app.refprice.book import DOBAE_2026H2 as BASE
from app.refprice.wallpaper_market import paper_market

D = Decimal
SILK_PY = paper_market("basic").per_py  # 10,749원/벽지 평
C11 = {"putty": 20_000, "silk": 9_500, "material": 13_000, "labor": 300_000}
HOUSES = [
    ("24평형 공급 79.3㎡", D("79.3"), "supply"),
    ("24평형 전용 59㎡", D("59"), "exclusive"),
    ("34평형 공급 112.4㎡", D("112.4"), "supply"),
    ("34평형 전용 84㎡", D("84"), "exclusive"),
]
RATIO_NOW, RATIO_DATA = D("1.2"), D("1.315")  # 전용 → 공급
REMOVAL_WALL, REMOVAL_CEIL = 2_702, 3_507  # 품셈 3-2-7 × 2026.9.1 노임(원/㎡)


def py1(x: Decimal) -> Decimal:
    return x.quantize(D("0.1"), rounding=ROUND_HALF_UP)


def scenario(name: str):
    p, ratio, removal_split = BASE, RATIO_NOW, False
    if name in ("area", "all"):
        p = replace(
            p,
            area_factor={"supply": D("2.2"), "exclusive": D("2.2") * RATIO_NOW},
            ceiling_share=D("0.35"),
        )
    if name in ("ratio", "all"):
        ratio = RATIO_DATA
        p = replace(p, area_factor={**p.area_factor, "exclusive": p.area_factor["supply"] * ratio})
    if name in ("ceiling_md", "all"):
        p = replace(p, md_ceiling=D("2") / (D("85") * D("0.77")))  # 0.0306
    if name in ("removal", "all"):
        removal_split = True
    return p, ratio, removal_split


def run(label: str, area: Decimal, basis: str, name: str, silk_py: int = SILK_PY) -> dict:
    p, ratio, removal_split = scenario(name)
    q = quote(DobaeInput(area, basis, "basic", True, False), p)
    lines = {ln.key: ln for ln in q.lines}
    paper_py = py1(lines["paper"].qty / PYEONG_M2)
    subtotal = q.subtotal - lines["paper"].amount + won(paper_py * silk_py)
    total = subtotal + won(D(subtotal) * p.vat_rate)
    removal = (
        won(q.wall_m2 * REMOVAL_WALL) + won(q.ceiling_m2 * REMOVAL_CEIL)
        if removal_split
        else lines["removal"].amount
    )
    floor_py = py1((area if basis == "supply" else area * ratio) / PYEONG_M2)
    md = half_up(q.man_days)
    estimate = (
        won(floor_py * C11["putty"])
        + won(paper_py * C11["silk"])
        + won(floor_py * C11["material"])
        + won(md * C11["labor"])
    )
    return {
        "house": label,
        "scenario": name,
        "paper_m2": str(q.paper_m2),
        "ceiling_m2": str(q.ceiling_m2),
        "paper_py": str(paper_py),
        "floor_py": str(floor_py),
        "man_days": f"{md:.1f}",
        "days": str(q.days),
        "standard_total": total,
        "removal_ref": removal,
        "estimate_4lines": estimate,
    }


NAMES = {
    "now": "지금 값",
    "area": "도배 면적 계수 2.2 · 천장 35%",
    "ratio": "전용 → 공급 × 1.315",
    "ceiling_md": "천장 품 0.0306",
    "removal": "떼내기 벽 2,702 · 천장 3,507",
    "all": "넷 다",
}


def main() -> None:
    # 확인: 9판 C07 집(공급 69.4㎡ · 실크 9,500원)은 1,974,069원 · C11 4줄 2,791,500원(data-model 6장)
    c07 = run("C07", D("69.4"), "supply", "now", silk_py=9_500)
    assert (c07["standard_total"], c07["estimate_4lines"]) == (1_974_069, 2_791_500), c07
    out = []
    for label, area, basis in HOUSES:
        base = run(label, area, basis, "now")
        out.append(base)
        for name in ("area", "ratio", "ceiling_md", "removal", "all"):
            if name == "ratio" and basis == "supply":
                continue  # 공급면적으로 넣은 집은 환산 비율을 안 써요
            r = run(label, area, basis, name)
            for k in ("standard_total", "removal_ref", "estimate_4lines"):
                r[f"{k}_diff"] = r[k] - base[k]
            out.append(r)
    print(
        "| 집 | 바꾼 것 | 도배 면적㎡(천장) | 벽지 평 · 바닥 평 | 품 · 일수 "
        "| 표준견적서 합계 | 철거 참고(합계 밖) | 가견적 주요 4줄 |"
    )
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for r in out:

        def cell(k: str, r: dict = r) -> str:
            d = r.get(f"{k}_diff")
            return f"{r[k]:,}" + (f" ({d:+,})" if d is not None else "")

        print(
            f"| {r['house']} | {NAMES[r['scenario']]} | {r['paper_m2']} ({r['ceiling_m2']}) "
            f"| {r['paper_py']} · {r['floor_py']} | {r['man_days']} · {r['days']}일 "
            f"| {cell('standard_total')} | {cell('removal_ref')} | {cell('estimate_4lines')} |"
        )
    path = ROOT / "data" / "v3" / "area" / "engine_impact.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n→ {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
