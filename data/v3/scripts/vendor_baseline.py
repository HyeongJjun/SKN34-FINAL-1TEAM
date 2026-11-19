"""업체 단가표 1201~1208 줄의 시장 기준값(10배 경고용) 계산.

단위는 9판 업체 단가표(D02)와 리드 결정 L01을 따라요(견적서 양식의 평당 값).
- 1201 퍼티 · 1205 부자재: 공급면적 1평(3.3058㎡)당
- 1203 합지 · 1204 실크: 벽지(도배지) 면적 1평당
- 1206 인건비 · 1207 식대: 1품(1명이 하루 하는 일)당 · 1208 운송비: 1대당

입력(읽기만): d10- 실견적 4차 줄별 내역 · 단가, 앞선 줄 항목 조사, data/v3/wallpaper_price/result.json
출력: data/v3/vendor_baseline/baseline.json · baseline.csv
실행: python -X utf8 data/v3/scripts/vendor_baseline.py
"""

from __future__ import annotations

import csv
import json
import math
import statistics as st
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "v3" / "vendor_baseline"
D10 = Path("C:/Workspace/SKN34/d10-")
N3 = D10 / "research_notes" / "실견적 3차 수집"
N4 = D10 / "research_notes" / "실견적 4차 수집"
PROPOSAL = D10 / "reports" / "데이터셋 조사" / "가견적_표준항목_제안.csv"
WALLPAPER = ROOT / "data" / "v3" / "wallpaper_price" / "result.json"
CHECKED = "2026-11-18"
WARN_RATIO = 10


def q(v: list[float], p: float) -> float:
    v = sorted(v)
    k = (len(v) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def jl(path: Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def stats(v: list[float]) -> dict:
    return {
        "n": len(v),
        "median": round(st.median(v)),
        "mean": round(st.mean(v)),
        "p25": round(q(v, 0.25)),
        "p75": round(q(v, 0.75)),
        "min": round(min(v)),
        "max": round(max(v)),
    }


def main() -> None:
    quotes = {}
    for path in (N3 / "기존_real_quotes.jsonl", N3 / "n3_all.jsonl", N4 / "n4_all.jsonl"):
        for x in jl(path):
            quotes[x["id"]] = x
    lines = [x for x in jl(N4 / "n4_lines.jsonl") if x["trade"] == "dobae"]
    by_quote = defaultdict(list)
    for x in lines:
        by_quote[x["quote_id"]].append(x)
    putty, sub, sub_g, crew = [], [], defaultdict(list), []
    for qid, items in by_quote.items():
        qt = quotes.get(qid, {})
        py, g = qt.get("pyeong"), qt.get("grade")
        has_py = isinstance(py, (int, float)) and py > 0
        for x in items:
            name, unit = x["line_name"], x["unit"]
            if "퍼티" in name and unit in ("명(품)", "품", "인") and has_py:
                putty.append(x["amount"] / py)  # 퍼티 품값 합 ÷ 공급 평
            if (
                ("부자재" in name or "부재료" in name)
                and unit == "식"
                and has_py
                and qt.get("scope") == "whole"
            ):
                sub.append(x["amount"] / py)
                sub_g[g].append(x["amount"] / py)
            if (
                x["kind"] == "labor"
                and "퍼티" not in name
                and unit in ("명(품)", "품", "인")
                and x["qty"]
            ):
                crew.append(x["qty"])
    rates = jl(N4 / "n4_rates.jsonl")
    wage = [
        x["value"]
        for x in rates
        if x["trade"] == "dobae" and x["what"] == "daily_wage" and x["value"] >= 100000
    ]
    proposal = {
        r["키"] if "키" in r else r[list(r)[1]]: r
        for r in csv.DictReader(PROPOSAL.open(encoding="utf-8-sig"))
    }
    expense_row = next(
        (r for r in proposal.values() if "경비" in json.dumps(r, ensure_ascii=False)), None
    )
    if not expense_row or "5만 원(3만~8만)" not in json.dumps(expense_row, ensure_ascii=False):
        raise SystemExit("앞선 조사 경비 줄(5만 원(3만~8만))을 찾지 못했어요")
    wp = json.loads(WALLPAPER.read_text(encoding="utf-8"))["material"]
    crew_median = st.median(crew)
    expense = {"median": 50000, "p25": 30000, "p75": 80000, "n": 78}
    rows = [
        {
            "code": "1201", "key": "putty", "name": "퍼티작업", "unit": "공급 평",
            "unit_ko": "공급면적 1평(3.3058㎡)당", "stat": "median", **stats(putty),
            "source": "실견적 4차 퍼티 줄(품 × 일당) ÷ 공급 평형 — 대동벽지 견적 게시판(한 가게)",
            "note": "자료가 8줄뿐이에요. 앞선 조사도 품당 25만 원 · 보통 2품(42줄)이라 비슷해요",
        },
        {
            "code": "1203", "key": "paper_hapji", "name": "합지", "unit": "벽지 평",
            "unit_ko": "벽지(도배지) 면적 1평(3.3058㎡)당", "stat": "mean",
            "n": wp["hapji"]["cap30"]["n"], **{k: wp["hapji"]["cap30"]["per_paper_pyeong"][k] for k in ("mean", "median", "p25", "p75")},
            "min": None, "max": None,
            "source": "data/v3/wallpaper_price/result.json material.hapji.cap30 — 광폭합지 롤값(대동벽지 58줄) ÷ 16.5㎡ × 3.3058",
            "note": "한 가게 자료뿐이라 범위가 좁아요",
        },
        {
            "code": "1204", "key": "paper_silk", "name": "실크", "unit": "벽지 평",
            "unit_ko": "벽지(도배지) 면적 1평(3.3058㎡)당", "stat": "mean",
            "n": wp["silk"]["cap30"]["n"], **{k: wp["silk"]["cap30"]["per_paper_pyeong"][k] for k in ("mean", "median", "p25", "p75")},
            "min": None, "max": None,
            "source": "data/v3/wallpaper_price/result.json material.silk.cap30 — 실크 롤값 279줄(출처 4곳, 한 출처 30건 상한) ÷ 16.5㎡ × 3.3058",
            "note": "표준견적서 '실크벽지 시장 평균 가격'과 같은 값이에요",
        },
        {
            "code": "1205", "key": "material", "name": "부자재", "unit": "공급 평",
            "unit_ko": "공급면적 1평(3.3058㎡)당", "stat": "median", **stats(sub),
            "by_grade": {k: stats(v) for k, v in sub_g.items() if k in ("silk", "hapji")},
            "source": "실견적 4차 부자재 줄(식) ÷ 공급 평형, 집 전체 견적만",
            "note": "실크 집이 합지 집의 약 2배예요. 단가표 줄은 하나라 둘을 합친 중앙값을 기준으로 써요",
        },
        {
            "code": "1206", "key": "labor", "name": "인건비", "unit": "품",
            "unit_ko": "1품(1명이 하루 하는 일)당", "stat": "median", **stats(wage),
            "source": "실견적 4차 단가(n4_rates) 도배 일당 — 견적서 인건비 줄 ÷ 인원, 출처 여러 곳",
            "note": "공공 기준(시중노임 도배공 2026.9.1)은 229,833원이에요",
        },
        {
            "code": "1207", "key": "meal", "name": "식대", "unit": "품",
            "unit_ko": "1품당", "stat": "upper_estimate",
            "n": expense["n"], "median": round(expense["median"] / crew_median), "mean": None,
            "p25": round(expense["p25"] / crew_median), "p75": round(expense["p75"] / crew_median), "min": None, "max": None,
            "source": "앞선 줄 항목 조사 '경비(식대 · 운반 · 주차) 한 집당 5만 원(3만~8만, 78줄)' ÷ 집당 품 수 중앙값",
            "note": f"식대만 적은 견적이 없어 경비 전체를 식대로 본 상한이에요(집당 품 수 중앙값 {crew_median:g}품, 331줄)",
        },
        {
            "code": "1208", "key": "truck", "name": "운송비", "unit": "대",
            "unit_ko": "1대당", "stat": "upper_estimate",
            "n": expense["n"], "median": expense["median"], "mean": None,
            "p25": expense["p25"], "p75": expense["p75"], "min": None, "max": None,
            "source": "앞선 줄 항목 조사 '경비(식대 · 운반 · 주차) 한 집당 5만 원(3만~8만, 78줄)'",
            "note": "운송비만 적은 도배 견적이 없어 경비 전체를 1대 운송비로 본 상한이에요",
        },
    ]  # fmt: skip
    for r in rows:
        r["base"] = r["mean"] if r["stat"] == "mean" else r["median"]
        r["warn_above"] = r["base"] * WARN_RATIO
        r["warn_below"] = math.ceil(r["base"] / WARN_RATIO)
        r["checked_at"] = CHECKED
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "baseline.json").write_text(
        json.dumps({"version": "vendor-base-2026.11", "warn_ratio": WARN_RATIO, "checked_at": CHECKED, "rows": rows},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )  # fmt: skip
    cols = ["code", "key", "name", "unit", "unit_ko", "stat", "base", "median", "mean", "p25", "p75", "n",
            "warn_below", "warn_above", "source", "note", "checked_at"]  # fmt: skip
    with (OUT / "baseline.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(
            r["code"],
            r["name"],
            r["unit"],
            r["stat"],
            r["base"],
            f"({r['p25']}~{r['p75']}, n={r['n']})",
        )


if __name__ == "__main__":
    main()
