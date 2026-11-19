"""벽지 시장 평균 가격(합지 · 실크) 계산.

입력(읽기만)
- 실견적 JSONL: 저장소 밖 d10- 수집(기존 1,135 · 3차 137 · 4차 968). --quotes로 바꿀 수 있어요.
- 4차 줄별 내역 · 단가 JSONL(--lines · --rates): 롤당 자재값 · 일당 · 롤 수
- data/v3/wallpaper_price/web_points.csv: 이번에 직접 연 웹 자료를 손으로 옮긴 값

출력(data/v3/wallpaper_price/)
- rows_used.csv: 계산에 쓴 실견적 행(이상치 표시 포함)
- sources.csv: 출처별 요약(시공가 평당 · 자재 롤당)
- result.json: 대표값 · 범위 · 평균 · 평형대별 · 민감도 · 자재가 · 저장소 값과 비교

계산 규칙은 docs/v3/adr/data-01-wallpaper-market-price.md에 있어요.
실행: python -X utf8 data/v3/scripts/wallpaper_price.py
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics as st
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "v3" / "wallpaper_price"
D10 = Path("C:/Workspace/SKN34/d10-/research_notes")
QUOTES = [
    D10 / "실견적 3차 수집" / "기존_real_quotes.jsonl",
    D10 / "실견적 3차 수집" / "n3_all.jsonl",
    D10 / "실견적 4차 수집" / "n4_all.jsonl",
]
LINES = D10 / "실견적 4차 수집" / "n4_lines.jsonl"
RATES = D10 / "실견적 4차 수집" / "n4_rates.jsonl"

PYEONG_M2 = 3.3058  # 1평 = 3.3058㎡
ROLL_M2 = 16.5  # 실크 · 광폭합지 한 롤(약 106cm × 15.6m 또는 93cm × 17.75m)
YEARS = ("2025", "2026")
PY_MIN, PY_MAX = 10, 70
SOURCE_FENCE_K = 1.5  # 출처 안 Tukey 울타리(로그 평당가), 건수 8 이상일 때만
GLOBAL_FENCE_K = 3.0  # 등급 전체 울타리(로그 평당가)
MIN_N_PRIMARY = 3  # 출처 비교 · 민감도에 넣는 출처의 최소 건수
CAP = 30  # 한 출처의 무게는 30건까지만 센다(한 업체 쏠림 막기)

# 실견적 출처: (출처 id, 이름, 종류, 품질, 대표 주소)
SOURCES = {
    "soomgo_portfolio": (
        "S01",
        "숨고 시공사례(업체가 올린 서비스 금액)",
        "플랫폼 시공사례 · 낸 금액",
        "A",
        "https://soomgo.com/portfolio/detail/",
    ),
    "yjwp": ("S02", "영진벽지 원격 견적 게시판", "한 업체 원격 견적", "B", "https://yjwp.co.kr"),
    "vendor_site": (
        "S03",
        "대동벽지 견적 게시판",
        "한 업체 원격 견적",
        "B",
        "https://bs-daedong.com/sub/estimate_board.php",
    ),
    "dcinside": (
        "S04",
        "디시 인테리어 갤러리 견적서 사진",
        "커뮤니티 · 견적서",
        "A",
        "https://gall.dcinside.com/mgallery/board/lists/?id=interior",
    ),
    "ppomppu": (
        "S05",
        "뽐뿌 인테리어 게시판",
        "커뮤니티 · 낸 금액 · 견적",
        "A",
        "https://m.ppomppu.co.kr/new/bbs_list.php?id=interior",
    ),
    "blind": (
        "S06",
        "블라인드 게시글",
        "커뮤니티 · 낸 금액 · 견적",
        "A",
        "https://www.teamblind.com/kr/",
    ),
    "mommyestimate": (
        "S07",
        "맘이견적 실거래가",
        "플랫폼 실거래 · 낸 금액",
        "A",
        "https://www.mommyestimate.com/real-price/",
    ),
    "tistory": (
        "S08",
        "티스토리 블로그 후기",
        "개인 블로그 · 낸 금액",
        "A",
        "https://www.tistory.com",
    ),
    "daangn_profile": (
        "S09",
        "당근 동네업체 가격표",
        "업체 공시가(시작가)",
        "B",
        "https://www.daangn.com/kr/local-profile/",
    ),
    "82cook": (
        "S10",
        "82쿡 게시판",
        "커뮤니티 · 낸 금액 · 견적",
        "A",
        "https://www.82cook.com/entiz/enti.php?bn=15",
    ),
    "clien": (
        "S11",
        "클리앙 게시판",
        "커뮤니티 · 낸 금액 · 견적",
        "A",
        "https://www.clien.net/service/board/park",
    ),
    "brunch": ("S12", "브런치 후기", "개인 글 · 낸 금액", "A", "https://brunch.co.kr"),
    "kmong_portfolio": ("S13", "크몽 포트폴리오", "플랫폼 시공사례", "A", "https://kmong.com"),
}
EXCLUDED_SOURCES = {"naver_blog": "네이버는 자동 수집을 막아 둬서 빼요"}
SINGLE_VENDOR = {"S02", "S03"}


def q(values: list[float], p: float) -> float:
    """선형 보간 분위수(엑셀 PERCENTILE.INC와 같음)."""
    v = sorted(values)
    if not v:
        return float("nan")
    k = (len(v) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def wq(pairs: list[tuple[float, float]], p: float) -> float:
    """가중 분위수. pairs = [(값, 무게)]. 누적 무게가 p를 넘는 첫 값."""
    pairs = sorted(pairs)
    total = sum(w for _, w in pairs)
    acc = 0.0
    for v, w in pairs:
        acc += w
        if acc / total >= p:
            return v
    return pairs[-1][0]


def capped(groups: dict[str, list[float]], cap: int = CAP) -> list[tuple[float, float]]:
    """출처마다 무게를 min(건수, cap)으로 자른 (값, 무게) 목록."""
    return [(v, min(len(vs), cap) / len(vs)) for vs in groups.values() for v in vs]


def estimators(groups: dict[str, list[float]]) -> dict[str, float]:
    """견줄 추정 방식들. 키 이름은 result.json의 estimator_check_loso와 같아요."""
    big = [st.median(v) for v in groups.values() if len(v) >= MIN_N_PRIMARY]
    big10 = [st.median(v) for v in groups.values() if len(v) >= 10]
    return {
        "cap30_weighted_median": wq(capped(groups), 0.5),
        "pooled_median": st.median([v for vs in groups.values() for v in vs]),
        "median_of_source_medians_n3": st.median(big),
        "median_of_source_medians_n10": st.median(big10) if big10 else float("nan"),
        "sqrt_n_weighted_median": wq(
            [(v, math.sqrt(len(vs)) / len(vs)) for vs in groups.values() for v in vs], 0.5
        ),
    }


def loso(groups: dict[str, list[float]]) -> dict[str, dict]:
    """출처 하나씩 빼고 나머지로 추정해, 뺀 출처의 중앙값 · 행을 얼마나 맞히는지(로그 오차) 봐요."""
    out = {}
    for k in estimators(groups):
        src_err, row_err = [], []
        for s, vs in groups.items():
            if len(vs) < MIN_N_PRIMARY:
                continue
            e = estimators({t: v for t, v in groups.items() if t != s})[k]
            src_err.append(abs(math.log(e / st.median(vs))))
            row_err += [abs(math.log(e / v)) for v in vs]
        out[k] = {
            "source_median_log_err_mean": round(st.mean(src_err), 3),
            "row_log_err_median": round(st.median(row_err), 3),
            "held_out_sources": len(src_err),
        }
    return out


def trimmed_mean(values: list[float], cut: float = 0.1) -> float:
    v = sorted(values)
    k = int(len(v) * cut)
    v = v[k : len(v) - k] if len(v) > 2 * k else v
    return st.mean(v)


def r(x: float) -> int:
    return round(x)


def load_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def pick_rows(quotes: list[Path]) -> tuple[list[dict], Counter]:
    """대상 행 고르기. 빠진 이유를 센다."""
    why = Counter()
    rows = []
    seen = set()
    for path in quotes:
        for x in load_jsonl(path):
            if x.get("trade") != "dobae":
                continue
            src = x.get("source")
            year = (x.get("date") or "")[:4]
            if src == "daangn_profile" and not year:
                year = "2026"  # 가격표는 2026-11-10 수집 때 화면에 있던 값
            if src in EXCLUDED_SOURCES:
                why["네이버 제외"] += 1
                continue
            if src not in SOURCES:
                why[f"출처 없음:{src}"] += 1
                continue
            if x.get("grade") not in ("silk", "hapji"):
                why["등급 섞음 · 모름"] += 1
                continue
            if x.get("scope") != "whole":
                why["집 전체 아님"] += 1
                continue
            py = x.get("pyeong")
            if not isinstance(py, (int, float)) or not (PY_MIN <= py <= PY_MAX):
                why["평형 없음 · 범위 밖"] += 1
                continue
            if year not in YEARS:
                why["2025~2026 아님"] += 1
                continue
            if x.get("verified") is False:
                why["확실하지 않음(verified=false)"] += 1
                continue
            price = x.get("price")
            if not isinstance(price, (int, float)) or price <= 0:
                why["금액 없음"] += 1
                continue
            key = (x.get("url"), x.get("grade"), price, py)
            if key in seen:
                why["같은 주소 · 금액 중복"] += 1
                continue
            seen.add(key)
            sid = SOURCES[src][0]
            rows.append(
                {
                    "id": x["id"],
                    "source_id": sid,
                    "source_key": src,
                    "grade": x["grade"],
                    "year": year,
                    "pyeong": py,
                    "price": int(price),
                    "per_pyeong": price / py,
                    "price_kind": x.get("price_kind") or "",
                    "ceiling": x.get("ceiling"),
                    "rolls": x.get("rolls"),
                    "vat": x.get("vat") or "unknown",
                    "url": x.get("url") or "",
                    "outlier": "",
                }
            )
    return rows, why


def mark_outliers(rows: list[dict]) -> None:
    for g in ("silk", "hapji"):
        logs = [math.log(x["per_pyeong"]) for x in rows if x["grade"] == g]
        q1, q3 = q(logs, 0.25), q(logs, 0.75)
        lo, hi = q1 - GLOBAL_FENCE_K * (q3 - q1), q3 + GLOBAL_FENCE_K * (q3 - q1)
        for x in rows:
            if x["grade"] == g and not (lo <= math.log(x["per_pyeong"]) <= hi):
                x["outlier"] = "global_fence"
        groups = defaultdict(list)
        for x in rows:
            if x["grade"] == g and not x["outlier"]:
                groups[x["source_id"]].append(x)
        for items in groups.values():
            if len(items) < 8:
                continue
            ls = [math.log(x["per_pyeong"]) for x in items]
            a, b = q(ls, 0.25), q(ls, 0.75)
            lo2, hi2 = a - SOURCE_FENCE_K * (b - a), b + SOURCE_FENCE_K * (b - a)
            for x in items:
                if not (lo2 <= math.log(x["per_pyeong"]) <= hi2):
                    x["outlier"] = "source_fence"


def summarize(values: list[float]) -> dict:
    return {
        "n": len(values),
        "median": r(st.median(values)),
        "q1": r(q(values, 0.25)),
        "q3": r(q(values, 0.75)),
        "mean": r(st.mean(values)),
        "min": r(min(values)),
        "max": r(max(values)),
    }


def load_web(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def web_install_points(web: list[dict]) -> dict[str, dict[str, list[float]]]:
    """웹 자료의 집 전체 금액 → 평당가. 범위면 가운데 값."""
    out: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for w in web:
        if w["measure"] != "install_total" or w["grade"] not in ("silk", "hapji"):
            continue
        mid = (float(w["price_low"]) + float(w["price_high"])) / 2
        out[w["source_id"]][w["grade"]].append(mid / float(w["pyeong"]))
    return out


def median_of_medians(groups: dict[str, list[float]], keep) -> tuple[int, list[str]]:
    meds = {s: st.median(v) for s, v in groups.items() if keep(s, v)}
    return r(st.median(meds.values())), sorted(meds)


def install_block(rows: list[dict], web: list[dict], web_meta: dict[str, dict]) -> dict:
    res = {}
    webp = web_install_points(web)
    for g in ("silk", "hapji"):
        used = [x for x in rows if x["grade"] == g and not x["outlier"]]
        real = [x for x in used if x["price_kind"] in ("paid", "quote")]
        posted = [x for x in used if x["price_kind"] == "posted"]
        by_src = defaultdict(list)
        for x in real:
            by_src[x["source_id"]].append(x["per_pyeong"])
        posted_src = defaultdict(list)
        for x in posted:
            posted_src[x["source_id"]].append(x["per_pyeong"])
        pairs = capped(by_src)
        primary = r(wq(pairs, 0.5))
        primary_src = sorted(by_src)
        allv = [x["per_pyeong"] for x in real]
        wmean = sum(v * w for v, w in pairs) / sum(w for _, w in pairs)
        # 민감도
        sens = {}
        sens["V1_출처_중앙값의_중앙값(3건 이상)"] = median_of_medians(
            by_src, lambda s, v: len(v) >= MIN_N_PRIMARY
        )[0]
        sens["V2_묶어서_중앙값"] = r(st.median(allv))
        g3 = dict(by_src)
        g3.update(posted_src)
        for sid, gv in webp.items():
            if web_meta[sid]["kind"] == "posted" and gv.get(g):
                g3[sid] = gv[g]
        sens["V3_공시가(시작가)_더함"] = r(wq(capped(g3), 0.5))
        g4 = dict(g3)
        for sid, gv in webp.items():
            if gv.get(g):
                g4[sid] = gv[g]
        sens["V4_웹_전체(AI · 정보 글 포함)"] = r(wq(capped(g4), 0.5))
        sens["V5_한_업체_게시판_뺌"] = r(
            wq(capped({k: v for k, v in by_src.items() if k not in SINGLE_VENDOR}), 0.5)
        )
        y26 = defaultdict(list)
        for x in real:
            if x["year"] == "2026":
                y26[x["source_id"]].append(x["per_pyeong"])
        sens["V6_2026년만"] = r(wq(capped(y26), 0.5))
        ceil = [x["per_pyeong"] for x in real if x["ceiling"] is True]
        sens["V7_천장_포함_명시만(묶어서)"] = r(st.median(ceil)) if ceil else None
        loo = []
        for drop in primary_src:
            loo.append(r(wq(capped({k: v for k, v in by_src.items() if k != drop}), 0.5)))
        sens["V8_출처_하나씩_빼기_범위"] = [min(loo), max(loo)]
        # 평형대
        bands = {}
        for name, lo, hi in (
            ("20평 미만", 0, 20),
            ("20~29평", 20, 30),
            ("30~39평", 30, 40),
            ("40평 이상", 40, 999),
        ):
            vs = [x for x in real if lo <= x["pyeong"] < hi]
            if not vs:
                continue
            b_src = defaultdict(list)
            for x in vs:
                b_src[x["source_id"]].append(x["per_pyeong"])
            bands[name] = {
                "n": len(vs),
                "sources": len(b_src),
                "median_cap30": r(wq(capped(b_src), 0.5)),
                "median_pooled": r(st.median([x["per_pyeong"] for x in vs])),
            }
        res[g] = {
            "representative_per_pyeong": primary,
            "representative_per_m2_supply": r(primary / PYEONG_M2),
            "with_vat_per_pyeong": r(primary * 1.1),
            "primary_sources": primary_src,
            "n_rows": len(real),
            "range_cap30": {
                "p25": r(wq(pairs, 0.25)),
                "p75": r(wq(pairs, 0.75)),
                "p10": r(wq(pairs, 0.10)),
                "p90": r(wq(pairs, 0.90)),
            },
            "range_pooled": {"p25": r(q(allv, 0.25)), "p75": r(q(allv, 0.75))},
            "mean_cap30_weighted": r(wmean),
            "trimmed_mean_pooled_10pct": r(trimmed_mean(allv)),
            "source_medians": {
                k: {"n": len(v), "median": r(st.median(v))} for k, v in sorted(by_src.items())
            },
            "estimator_check_loso": loso(by_src),
            "estimators_full": {k: r(v) for k, v in estimators(by_src).items()},
            "examples_supply_total": {f"{py}평": r(primary * py) for py in (24, 32, 34)},
            "by_size": bands,
            "sensitivity": sens,
        }
    s, h = res["silk"]["representative_per_pyeong"], res["hapji"]["representative_per_pyeong"]
    res["silk_over_hapji"] = round(s / h, 2)
    return res


def material_block(
    lines_path: Path, quotes4: Path, rates_path: Path, rows: list[dict], web: list[dict]
) -> dict:
    grade_of = {x["id"]: x.get("grade") for x in load_jsonl(quotes4)}
    groups: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for ln in load_jsonl(lines_path):
        if ln.get("trade") != "dobae" or ln.get("kind") != "material" or ln.get("unit") != "롤":
            continue
        g = grade_of.get(ln["quote_id"])
        u = ln.get("unit_price")
        if g not in ("silk", "hapji") or not u or not (10000 <= u <= 150000):
            continue  # 1만 원 미만은 소폭 롤 · 잘못 읽은 값으로 보고 뺌
        sid = "S03" if ln["quote_id"].startswith("N4-DD") else "S04"
        groups[sid][g].append(float(u))
    for w in web:
        if w["measure"] == "roll_price" and w["grade"] in ("silk", "hapji"):
            groups[w["source_id"]][w["grade"]].append(float(w["price_low"]))
    out = {"roll_m2": ROLL_M2}
    # 평당 롤 수(공급 평): 롤 수가 적힌 집 전체 실견적 + 웹(34평 19롤)
    rpp = defaultdict(list)
    for x in rows:
        if x["outlier"] or not isinstance(x.get("rolls"), (int, float)) or x["rolls"] <= 0:
            continue
        rpp[x["grade"]].append(x["rolls"] / x["pyeong"])
    for w in web:
        if w["measure"] == "rolls":
            rpp[w["grade"]].append(float(w["price_low"]) / float(w["pyeong"]))
    for g in ("silk", "hapji"):
        src = {s: v[g] for s, v in groups.items() if v.get(g)}
        meds = {s: st.median(v) for s, v in src.items()}
        rep = st.median(meds.values()) if meds else None
        per_py = st.median(rpp[g]) if rpp[g] else None
        # 시공가와 같은 규칙(한 출처 30건 상한)으로 평균 · 중앙값 · 범위. 화면 값은 평균(리드 결정 2026-11-18)
        pairs = capped(src) if src else []
        cap = {}
        if pairs:
            mean = sum(v * w for v, w in pairs) / sum(w for _, w in pairs)
            stats = {
                "mean": mean,
                "median": wq(pairs, 0.5),
                "p25": wq(pairs, 0.25),
                "p75": wq(pairs, 0.75),
            }
            cap = {
                "n": len(pairs),
                "sources": sorted(src),
                "roll": {k: r(v) for k, v in stats.items()},
                "per_m2": {k: round(v / ROLL_M2, 1) for k, v in stats.items()},
                "per_paper_pyeong": {k: r(v * PYEONG_M2 / ROLL_M2) for k, v in stats.items()},
            }
        out[g] = {
            "cap30": cap,
            "roll_price_by_source": {
                s: {"n": len(v), "median": r(st.median(v)), "mean": r(st.mean(v))}
                for s, v in src.items()
            },
            "roll_price_representative": r(rep) if rep else None,
            "per_m2_paper": r(rep / ROLL_M2) if rep else None,
            "rolls_per_pyeong": {
                "n": len(rpp[g]),
                "median": round(per_py, 3) if per_py else None,
                "q1": round(q(rpp[g], 0.25), 3) if rpp[g] else None,
                "q3": round(q(rpp[g], 0.75), 3) if rpp[g] else None,
            },
            "material_per_pyeong": r(rep * per_py) if rep and per_py else None,
        }
    rates = load_jsonl(rates_path)
    wages = [
        x["value"]
        for x in rates
        if x["trade"] == "dobae" and x["what"] == "daily_wage" and x["value"] >= 100000
    ]
    outp = [x["value"] for x in rates if x["trade"] == "dobae" and x["what"] == "daily_output"]
    out["labor_reference"] = {
        "daily_wage": summarize(wages) if wages else None,
        "daily_output_rolls_per_person": {"n": len(outp), "median": round(st.median(outp), 2)}
        if outp
        else None,
        "note": "일당은 견적서 줄의 인건비 ÷ 인원. 하루 작업량은 견적상 배정값이에요(실측 아님)",
    }
    return out, groups


def repo_compare(backend: Path) -> dict:
    """지금 저장소 계산(표준견적서 공공 · 시장 기준)으로 24 · 34평 공급가를 다시 계산해 비교해요."""
    try:
        sys.path.insert(0, str(backend))
        from decimal import Decimal

        from app.calc.dobae import DobaeInput, quote
        from app.calc.market_band import MarketDobaeInput
        from app.calc.market_band import dobae as market_dobae
        from app.refprice.book import DOBAE_2026H2
        from app.refprice.market import MARKET_2026_11
    except Exception as e:  # noqa: BLE001
        return {"error": f"저장소 계산을 불러오지 못했어요: {type(e).__name__}"}
    out = {}
    for py in (24, 34):
        area = Decimal(str(round(py * PYEONG_M2, 1)))
        for grade, g in (("basic", "silk"), ("economy", "hapji")):
            pub = quote(DobaeInput(area, "supply", grade, True, False), DOBAE_2026H2)
            mk = market_dobae(MarketDobaeInput(area, grade, "supply", True), MARKET_2026_11)
            out[f"{g}_{py}"] = {
                "public_subtotal": pub.subtotal,
                "public_per_pyeong": r(pub.subtotal / py),
                "market_supply": mk.supply,
                "market_per_pyeong": r(mk.supply / py),
                "market_band": [mk.lo, mk.hi],
            }
    out["versions"] = {"public": DOBAE_2026H2.version, "market": MARKET_2026_11.version}
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quotes", nargs="*", type=Path, default=QUOTES)
    ap.add_argument("--lines", type=Path, default=LINES)
    ap.add_argument("--rates", type=Path, default=RATES)
    ap.add_argument("--web", type=Path, default=OUT / "web_points.csv")
    ap.add_argument("--backend", type=Path, default=ROOT / "backend")
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()

    rows, why = pick_rows(a.quotes)
    mark_outliers(rows)
    web = load_web(a.web)
    web_meta = {}
    for w in web:
        web_meta.setdefault(
            w["source_id"],
            {
                "name": w["source_name"],
                "url": w["source_url"],
                "kind": w["kind"],
                "quality": w["quality"],
                "published": w["published"],
                "checked_at": w["checked_at"],
            },
        )
    install = install_block(rows, web, web_meta)
    material, mat_groups = material_block(a.lines, a.quotes[-1], a.rates, rows, web)

    a.out.mkdir(parents=True, exist_ok=True)
    cols = [
        "id",
        "source_id",
        "source_key",
        "grade",
        "year",
        "pyeong",
        "price",
        "per_pyeong",
        "price_kind",
        "ceiling",
        "rolls",
        "vat",
        "outlier",
        "url",
    ]
    with (a.out / "rows_used.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for x in sorted(rows, key=lambda x: (x["grade"], x["source_id"], x["id"])):
            w.writerow({**x, "per_pyeong": r(x["per_pyeong"])})

    # 출처표
    srows = []
    for sid, name, kind, qual, url in SOURCES.values():
        for g in ("silk", "hapji"):
            vs = [x for x in rows if x["source_id"] == sid and x["grade"] == g]
            if not vs:
                continue
            real = [
                x["per_pyeong"]
                for x in vs
                if not x["outlier"] and x["price_kind"] in ("paid", "quote")
            ]
            # 대표값 계산과 같게: 낸 금액 · 견적만 세요. 공시가뿐인 출처(당근)는 공시가로 요약해요
            used = real or [x["per_pyeong"] for x in vs if not x["outlier"]]
            s = summarize(used) if used else {}
            kinds = Counter(x["price_kind"] for x in vs)
            years = sorted({x["year"] for x in vs})
            role = "대표값" if real else "민감도"
            srows.append(
                {
                    "source_id": sid,
                    "source_name": name,
                    "source_type": kind,
                    "quality": qual,
                    "measure": "시공가_평당",
                    "grade": g,
                    "years": "~".join([years[0], years[-1]]) if years else "",
                    "n_raw": len(vs),
                    "n_used": len(used),
                    "median": s.get("median"),
                    "q1": s.get("q1"),
                    "q3": s.get("q3"),
                    "mean": s.get("mean"),
                    "min": s.get("min"),
                    "max": s.get("max"),
                    "price_kind": " · ".join(f"{k} {v}" for k, v in kinds.items()),
                    "role": role,
                    "source_url": url,
                    "collected": "d10- 실견적 수집(2026-11-09~10, 원문 열어 옮김)",
                    "checked_at": "2026-11-10",
                }
            )
    webp = web_install_points(web)
    for sid, gv in webp.items():
        m = web_meta[sid]
        for g, vs in gv.items():
            srows.append(
                {
                    "source_id": sid,
                    "source_name": m["name"],
                    "source_type": m["kind"],
                    "quality": m["quality"],
                    "measure": "시공가_평당",
                    "grade": g,
                    "years": m["published"],
                    "n_raw": len(vs),
                    "n_used": len(vs),
                    "median": r(st.median(vs)),
                    "q1": "",
                    "q3": "",
                    "mean": r(st.mean(vs)),
                    "min": r(min(vs)),
                    "max": r(max(vs)),
                    "price_kind": m["kind"],
                    "role": "민감도",
                    "source_url": m["url"],
                    "collected": "이번에 WebFetch로 열어 숫자만 옮김",
                    "checked_at": m["checked_at"],
                }
            )
    for sid, gv in mat_groups.items():
        for g, vs in gv.items():
            meta = web_meta.get(sid, {})
            name = meta.get("name") or (
                "대동벽지 견적 줄별 내역" if sid == "S03" else "디시 견적서 줄별 내역"
            )
            srows.append(
                {
                    "source_id": sid,
                    "source_name": name,
                    "source_type": meta.get("kind", "견적서 자재 줄"),
                    "quality": meta.get("quality", "B" if sid == "S03" else "A"),
                    "measure": "자재_롤당",
                    "grade": g,
                    "years": meta.get("published", "2026"),
                    "n_raw": len(vs),
                    "n_used": len(vs),
                    "median": r(st.median(vs)),
                    "q1": r(q(vs, 0.25)),
                    "q3": r(q(vs, 0.75)),
                    "mean": r(st.mean(vs)),
                    "min": r(min(vs)),
                    "max": r(max(vs)),
                    "price_kind": "자재 롤값",
                    "role": "대표값",
                    "source_url": meta.get("url")
                    or SOURCES["vendor_site" if sid == "S03" else "dcinside"][4],
                    "collected": "이번에 WebFetch로 열어 숫자만 옮김"
                    if meta
                    else "d10- 4차 줄별 내역(2026-11-10)",
                    "checked_at": meta.get("checked_at", "2026-11-10"),
                }
            )
    for sid, m in web_meta.items():
        if sid not in webp and sid not in mat_groups:
            srows.append(
                {
                    "source_id": sid,
                    "source_name": m["name"],
                    "source_type": m["kind"],
                    "quality": m["quality"],
                    "measure": "참고(숫자 안 씀)",
                    "grade": "all",
                    "years": m["published"],
                    "n_raw": 0,
                    "n_used": 0,
                    "median": "",
                    "q1": "",
                    "q3": "",
                    "mean": "",
                    "min": "",
                    "max": "",
                    "price_kind": m["kind"],
                    "role": "목록만",
                    "source_url": m["url"],
                    "collected": "이번에 WebFetch로 열어 확인",
                    "checked_at": m["checked_at"],
                }
            )
    scols = [
        "source_id",
        "source_name",
        "source_type",
        "quality",
        "measure",
        "grade",
        "years",
        "n_raw",
        "n_used",
        "median",
        "q1",
        "q3",
        "mean",
        "min",
        "max",
        "price_kind",
        "role",
        "source_url",
        "collected",
        "checked_at",
    ]
    with (a.out / "sources.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=scols)
        w.writeheader()
        w.writerows(srows)

    result = {
        "version": "wallpaper-market-2026.11-v3",
        "made": date.today().isoformat(),
        "unit": "원. 평은 집 공급면적 평형(1평 = 3.3058㎡). 실견적 대부분이 부가세 표기가 없어 '부가세 별도 공급가'로 봐요",
        "scope": "아파트 집 전체 도배(벽 + 천장 대부분 포함), 빈집 · 살림집 섞임, 기존 벽지 철거 · 초배 · 부자재 포함 금액",
        "method": {
            "filter": f"도배 · 실크/합지 · 집 전체 · 평형 {PY_MIN}~{PY_MAX} · {'/'.join(YEARS)}년 · verified · 네이버 제외",
            "outlier": f"등급 전체 로그 평당가 Tukey k={GLOBAL_FENCE_K}, 출처 안(8건 이상) k={SOURCE_FENCE_K}",
            "representative": f"실견적(낸 금액 · 견적) 평당가의 가중 중앙값. 한 출처의 무게는 {CAP}건까지만 세요",
            "range": f"같은 무게({CAP}건 상한)로 본 25 · 75 · 10 · 90% 분위수",
            "average": "참고: 같은 무게의 가중 평균, 묶은 10% 절사평균",
            "why": "출처 하나씩 빼기 시험(estimator_check_loso)에서 묶은 중앙값과 비슷하게 맞히면서 한 업체 쏠림을 막아요",
        },
        "excluded_counts": dict(why),
        "install": install,
        "material": material,
        "repo_compare": repo_compare(a.backend),
    }
    (a.out / "result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    s, h = install["silk"], install["hapji"]
    print(
        f"실크 평당 {s['representative_per_pyeong']:,}원 (출처 {len(s['primary_sources'])}곳 · {s['n_rows']}건)"
    )
    print(
        f"합지 평당 {h['representative_per_pyeong']:,}원 (출처 {len(h['primary_sources'])}곳 · {h['n_rows']}건)"
    )


if __name__ == "__main__":
    main()
