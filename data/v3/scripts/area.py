"""아파트 면적 도움 자료: 전용률(전용 ÷ 공급)과 도배 면적 계수(벽 + 천장 ÷ 바닥).

입력(읽기만)
- d10-/data/floorplans/index.csv: 공공 분양 · 임대 공고의 평면도 38곳(타입 · 공급 · 전용 면적, 원본 주소)
- backend/app/refprice/floor_plans.json + app.calc.plan_qty: 평면도 20곳의 공간 치수로 벽 · 천장 면적 계산
- data/v3/wallpaper_price/result.json: 실견적 평당 롤 수
- 팀 가정값: house.py(전용 × 1.2) · book.py(공급 × 2.5 / 전용 × 3.0) · market.py(2.24 · 2.16)

출력(data/v3/area/): exclusive_ratio.csv · plan_paper_area.csv · area_rules.json
실행: python -X utf8 data/v3/scripts/area.py
"""

from __future__ import annotations

import csv
import json
import statistics as st
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "v3" / "area"
INDEX = Path("C:/Workspace/SKN34/d10-/data/floorplans/index.csv")
WP = ROOT / "data" / "v3" / "wallpaper_price" / "result.json"
PYEONG_M2 = 3.3058
ROLL_M2 = 16.5
PAPER_LOSS = 1.2  # 정배지 소요량(표준품셈 5-3-7, 할증 포함)
CHECKED = "2026-11-18"


def f(x: str) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def band(excl: float) -> str:
    if excl < 50:
        return "전용 50㎡ 미만"
    if excl < 60:
        return "전용 50~60㎡"
    if excl < 85.5:
        return "전용 60~85㎡"
    return "전용 85㎡ 초과"


def exclusive_ratio() -> tuple[list[dict], dict]:
    rows = []
    with INDEX.open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            sup, exc = f(r["공급면적_m2"]), f(r["전용면적_m2"])
            ok = r["확인상태"].startswith("확인함") and sup and exc and "추정" not in r["메모"][:80]
            rows.append(
                {
                    "id": r["id"],
                    "type": r["타입"],
                    "supply_m2": sup or "",
                    "exclusive_m2": exc or "",
                    "ratio_excl_over_supply": round(exc / sup, 4) if sup and exc else "",
                    "supply_over_excl": round(sup / exc, 4) if sup and exc else "",
                    "supply_pyeong": round(sup / PYEONG_M2, 1) if sup else "",
                    "band": band(exc) if exc else "",
                    "used": "예" if ok else "아니오",
                    "why_not": ""
                    if ok
                    else (
                        "공급면적 없음 · 추정"
                        if not sup or "추정" in r["메모"][:80]
                        else "확인 안 함"
                    ),
                    "publisher": r["출처기관"],
                    "source_url": r["원본페이지URL"],
                    "retrieved": r["받은날짜"],
                }
            )
    used = [x for x in rows if x["used"] == "예"]
    summ = {}
    for b in ("전용 50㎡ 미만", "전용 50~60㎡", "전용 60~85㎡", "전용 85㎡ 초과"):
        v = [x["ratio_excl_over_supply"] for x in used if x["band"] == b]
        if v:
            summ[b] = {
                "n": len(v),
                "median": round(st.median(v), 3),
                "min": round(min(v), 3),
                "max": round(max(v), 3),
                "supply_over_excl_median": round(1 / st.median(v), 3),
            }
    allv = [x["ratio_excl_over_supply"] for x in used]
    summ["전체"] = {
        "n": len(allv),
        "median": round(st.median(allv), 3),
        "min": round(min(allv), 3),
        "max": round(max(allv), 3),
        "supply_over_excl_median": round(1 / st.median(allv), 3),
    }
    return rows, summ


def plan_paper() -> tuple[list[dict], dict]:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.calc.plan_qty import PlanOptions, from_plan
    from app.refprice.floor_plans import plans

    rows = []
    for p in plans().values():
        for expanded in (True, False):
            if not expanded and not p.has_ext:
                continue
            qty = from_plan(p.plan, PlanOptions(expanded=expanded))
            sup = float(p.supply_m2)
            exc = float(p.excl_m2) if p.excl_m2 else None
            paper = float(qty.paper_m2)
            rows.append(
                {
                    "id": p.id,
                    "type": p.type,
                    "drawn": p.drawn,
                    "expanded": "확장" if expanded else "비확장",
                    "supply_m2": sup,
                    "exclusive_m2": exc or "",
                    "wall_m2": float(qty.wall_m2),
                    "ceiling_m2": float(qty.ceiling_m2),
                    "paper_m2": paper,
                    "paper_over_supply": round(paper / sup, 3),
                    "paper_over_excl": round(paper / exc, 3) if exc else "",
                    "ceiling_share": round(float(qty.ceiling_m2) / paper, 3) if paper else "",
                    "silk_rolls": qty.rolls["silk"].rolls,
                    "silk_rolls_per_supply_pyeong": round(
                        qty.rolls["silk"].rolls / (sup / PYEONG_M2), 3
                    ),
                    "hapji_small_rolls": qty.rolls["hapji"].rolls,
                    "low_confidence_spaces": " · ".join(qty.low),
                    "rules": qty.rules_version,
                    "source_url": p.src_url,
                }
            )
    exp = [x for x in rows if x["expanded"] == "확장"]
    summ = {
        "n_plans": len({x["id"] for x in rows}),
        "assumptions": "천장 2.3m · 문 0.9 × 2.1m · 창 높이 2.1/1.2m · 주방 벽 절반 · 욕실은 도배 안 함(plan_qty 규칙)",
        "expanded": {
            "paper_over_supply_median": round(st.median(x["paper_over_supply"] for x in exp), 3),
            "paper_over_supply_q1_q3": [
                round(sorted(x["paper_over_supply"] for x in exp)[len(exp) // 4], 3),
                round(sorted(x["paper_over_supply"] for x in exp)[(3 * len(exp)) // 4], 3),
            ],
            "paper_over_excl_median": round(
                st.median(x["paper_over_excl"] for x in exp if x["paper_over_excl"] != ""), 3
            ),
            "ceiling_share_median": round(st.median(x["ceiling_share"] for x in exp), 3),
            "silk_rolls_per_pyeong_median": round(
                st.median(x["silk_rolls_per_supply_pyeong"] for x in exp), 3
            ),
        },
    }
    nonexp = [x for x in rows if x["expanded"] == "비확장"]
    if nonexp:
        summ["not_expanded"] = {
            "n": len(nonexp),
            "paper_over_supply_median": round(st.median(x["paper_over_supply"] for x in nonexp), 3),
        }
    return rows, summ


def market_factor() -> dict:
    d = json.loads(WP.read_text(encoding="utf-8"))
    out = {}
    for g in ("silk", "hapji"):
        rpp = d["material"][g]["rolls_per_pyeong"]["median"]
        out[g] = {
            "rolls_per_pyeong": rpp,
            "n": d["material"][g]["rolls_per_pyeong"]["n"],
            "paper_over_supply": round(rpp * ROLL_M2 / PAPER_LOSS / PYEONG_M2, 3),
        }
    return out


def write(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    er, er_s = exclusive_ratio()
    write(OUT / "exclusive_ratio.csv", er)
    pp, pp_s = plan_paper()
    write(OUT / "plan_paper_area.csv", pp)
    mf = market_factor()
    team = {
        "house_py_supply_per_exclusive": "1.2 (backend/app/refprice/house.py · market_band.SUPPLY_PER_EXCLUSIVE)",
        "book_area_factor": "공급 × 2.5 · 전용 × 3.0, 천장 25% (book.py DOBAE_2026H2, 팀 가정값)",
        "market_area_factor": "실크 2.24 · 합지 2.16, 천장 37% (market.py, 실견적 롤 수 관행)",
        "plan_qty_rolls": "실크 1.06 × 15.6m(16.5㎡) · 합지(소폭) 0.53 × 12.5m",
    }
    rules = {
        "checked_at": CHECKED,
        "pyeong_m2": PYEONG_M2,
        "definitions": [
            "주거전용면적: 세대가 혼자 쓰는 안쪽 면적(발코니 제외). 분양 · 임대 공고와 등기의 기준이에요",
            "주거공용면적: 계단 · 복도 · 엘리베이터처럼 같은 동 세대가 함께 쓰는 면적이에요",
            "공급면적 = 주거전용 + 주거공용. '34평형'처럼 부르는 평형은 보통 공급면적 기준이에요",
            "계약면적 = 공급면적 + 그 밖의 공용(관리사무소 · 주차장 등). 발코니는 서비스면적이라 어디에도 안 들어가요",
        ],
        "definitions_source": "용어 뜻은 공공 분양 공고(LH 청약플러스 · iH · 서울시 정비사업) 면적표의 구성(전용 · 주거공용 · 공급)으로 확인했어요. 법령 조항 번호는 이번에 확인 못 했어요",
        "exclusive_ratio": er_s,
        "plan_paper_area": pp_s,
        "market_rolls": mf,
        "team_values": team,
        "takeaways": [
            f"전용률 중앙값 {er_s['전체']['median']} → 공급 ≈ 전용 × {er_s['전체']['supply_over_excl_median']}. 팀 가정 1.2보다 커요(전용 50㎡ 미만 소형은 더 커요)",
            f"평면도 계산 도배 면적(확장, 천장 포함) ≈ 공급 × {pp_s['expanded']['paper_over_supply_median']}, 전용 × {pp_s['expanded']['paper_over_excl_median']}",
            f"실견적 롤 수로 되짚은 값 ≈ 공급 × {mf['silk']['paper_over_supply']}(실크) · {mf['hapji']['paper_over_supply']}(합지)",
            "표준견적서의 공급 × 2.5는 평면도 계산 · 실견적 롤 수보다 커요",
        ],
    }
    (OUT / "area_rules.json").write_text(
        json.dumps(rules, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(json.dumps({"exclusive_ratio": er_s, "plan": pp_s, "market": mf}, ensure_ascii=False))


if __name__ == "__main__":
    main()
