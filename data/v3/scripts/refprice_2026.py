"""기준 단가 2026 정리: 시중노임단가 · 표준품셈 · 표준시장단가 + 지금 저장소 값과 비교.

입력(읽기만)
- data/processed/06_construction_wages.csv: 대한건설협회 임금실태조사 보고서(2025.1.1 ~ 2026.9.1) 전처리본
- data/processed/03_standard_productivity.csv: 2026 건설공사 표준품셈(원문 정오표 1차 반영) 전처리본
- d10-/data/eval/public/std_price_rows.jsonl: 조달청 공사원가 표준시장단가(2025 하반기, 2025-08-04 발표)
- backend/app/refprice/book.py: 지금 팀 값(DOBAE_2026H2 · MOKGONG_2026H2)

출력(data/v3/refprice_2026/)
- wages_2026.csv · pumsem_2026.csv · std_market_price.csv · comparison.csv

실행: python -X utf8 data/v3/scripts/refprice_2026.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "v3" / "refprice_2026"
WAGES = ROOT / "data" / "processed" / "06_construction_wages.csv"
PUMSEM = ROOT / "data" / "processed" / "03_standard_productivity.csv"
STD = Path("C:/Workspace/SKN34/d10-/data/eval/public/std_price_rows.jsonl")
CHECKED = "2026-11-18"

# 실내 공사와 이어지는 직종(코드는 임금실태조사 직종 번호)
OCC = {
    "1001": "작업반장",
    "1002": "보통인부",
    "1003": "특별인부",
    "1004": "조력공",
    "1021": "조적공",
    "1022": "견출공",
    "1023": "건축목공",
    "1024": "창호공",
    "1025": "유리공",
    "1026": "방수공",
    "1027": "미장공",
    "1028": "타일공",
    "1029": "도장공",
    "1030": "내장공",
    "1031": "도배공",
    "1034": "줄눈공",
    "1035": "판넬조립공",
    "1039": "배관공",
    "1040": "배관공(수도)",
    "1041": "보일러공",
    "1042": "위생공",
    "1043": "덕트공",
    "1044": "보온공",
    "1045": "인력운반공",
    "1051": "기계설비공",
    "1075": "내선전공",
    "1086": "통신내선공",
    "1091": "석면해체공",
    "5007": "코킹공",
    "5012": "플로어링마루시공공",
    "5014": "철거공",
}
# 이번에 웹 2차 자료로 같은 값을 확인한 것(공표 원문 PDF는 직접 열지 못했어요)
WEB_H1 = {  # 2026.1.1 적용 — yellowit '2026년 정부노임단가 132개 직종' 표
    "1002": 172068,
    "1003": 226122,
    "1004": 179028,
    "1001": 215907,
    "1023": 277642,
    "1030": 256883,
    "1031": 227614,
    "1028": 290939,
    "1029": 263017,
    "1027": 277276,
    "1026": 228286,
    "1024": 247188,
    "1025": 253539,
    "1039": 247897,
    "1075": 273676,
    "1091": 204181,
    "1034": 211653,
    "5007": 209131,
    "1045": 180193,
}
WEB_H1_URL = "https://yellowit.co.kr/%ec%a7%81%ec%9e%a5%ec%9d%b8-%ec%97%b0%eb%a7%90%ec%a0%95%ec%82%b0-%ea%b5%ad%eb%af%bc%eb%82%b4%ec%9d%bc%eb%b0%b0%ec%9b%80%ec%b9%b4%eb%93%9c-%eb%85%b8%eb%8f%99%eb%b2%95/2026%eb%85%84-%ed%95%98%eb%b0%98%ea%b8%b0-%ec%a0%95%eb%b6%80-%eb%85%b8%ec%9e%84%eb%8b%a8%ea%b0%80%ed%91%9c-%ec%b4%9d%ec%a0%95%eb%a6%ac%ef%bd%9c%ea%b1%b4%ec%84%a4%c2%b7%ec%a0%9c%ec%a1%b0%c2%b7%ec%a0%84/"
WEB_H2 = {  # 2026.9.1 적용 — 유리지갑 '노임단가 가이드' 표(2026-10-02 글)
    "1002": 172698,
    "1003": 228717,
    "1001": 218316,
    "1023": 282990,
    "1007": 275379,
    "1008": 268932,
    "1013": 276285,
    "1027": 279102,
    "1021": 273229,
    "1026": 233163,
    "1012": 286330,
    "1028": 294379,
}
WEB_H2_URL = "https://glasswallet.com/blog/labor-cost-unit-price-guide"
AVG = {  # 132개 직종 일평균(공표 보도 · 2차 자료)
    "2026.1.1": (279988, WEB_H1_URL),
    "2026.9.1": (282737, "https://kbmaeil.com/article/20260901500192"),
}

# 2026 표준품셈 도배 · 목공 항목. check는 저장소 전처리본 그 쪽 글에 꼭 있어야 하는 글자(검증용)
PUMSEM_ITEMS = [
    (
        "5-3-7",
        "도배바름('15, '24 보완)",
        "일당",
        "도배공 2 · 보통인부 1",
        "합판 · 석고보드면 85㎡ / 콘크리트 · 모르타르면 95㎡",
        "천장은 시공량 23% 감. 초배 · 정배 바름 · 풀먹임 포함. 재료(할증 포함) ㎡당 초배지 0.8(합판 · 석고) / 1.2(콘크리트), 정배지 1.2, 풀 0.3kg",
        "653",
        ["5-3-7", "85", "95", "23%"],
    ),
    (
        "3-2-7",
        "도배 해체('22 신설)",
        "㎡당",
        "벽: 도배공 0.008 · 보통인부 0.005 / 천장: 도배공 0.010 · 보통인부 0.007",
        "-",
        "재사용 안 할 때. 정배지 · 초배지 해체 포함. 폐기물 처리 · 비산방지 별도",
        "971",
        ["3-2-7", "0.008", "0.005", "0.010", "0.007"],
    ),
    (
        "3-4-3",
        "도배 교체('22 신설)",
        "일당",
        "내장공 2",
        "벽 46㎡ / 천장 35㎡",
        "해체 · 바탕정리 · 풀먹임 · 초배 · 정배 포함. 사용 중인 세대에 지장물이 있으면 시공량 15% 감",
        "975",
        ["3-4-3", "46", "35", "15%"],
    ),
    (
        "3-4-4",
        "PVC계 바닥재 교체('22 신설)",
        "일당",
        "내장공 2",
        "61㎡",
        "지장물 있으면 15% 감",
        "976",
        ["3-4-4", "61"],
    ),
    (
        "5-3-5",
        "걸레받이 설치('16, '24 보완)",
        "일당",
        "내장공 2 · 보통인부 1",
        "합성수지 200m / 중밀도섬유판(MDF) 165m",
        "높이 75~120㎜. 석재류는 석공 3 · 보통인부 1, 25m",
        "653",
        ["5-3-5", "200", "165"],
    ),
    (
        "8-1-5",
        "조이너 및 몰딩 설치('16 보완)",
        "m당",
        "몰딩: 내장공 0.035 / 조이너 0.020",
        "-",
        "몰딩은 천장갓둘레 기준. 재료 m당 1.1m(할증 포함), 잡재료 주재료비 5%",
        "674",
        ["8-1-5", "0.035", "0.020"],
    ),
    (
        "10-1-1",
        "목재창호 설치('14, '20 보완)",
        "개소당",
        "여닫이 1.0~3.0㎡: 창호공 0.313 · 보통인부 0.064",
        "-",
        "문선 설치는 m당 창호공 0.010 추가. 창호틀 조립 · 창호짝 · 경첩 포함",
        "685",
        ["10-1-1", "0.313", "0.064", "0.010"],
    ),
    (
        "5-2-3",
        "천장 석고판 설치(나사고정)('22 신설, '24 보완)",
        "일당",
        "내장공 2 · 보통인부 1",
        "바탕용 1겹 45㎡ / 2겹 35㎡ / 치장용 25㎡",
        "경량천장철골틀에 나사 고정",
        "651",
        ["5-2-3", "45", "35", "25"],
    ),
    (
        "5-3-1",
        "벽 석고판 설치(나사고정)('15, '24 보완)",
        "일당",
        "내장공 2 · 보통인부 1",
        "바탕용 1겹 60㎡ / 2겹 45㎡ / 치장용 30㎡",
        "벽면 바탕틀에 설치",
        "651",
        ["5-3-1", "60", "45", "30"],
    ),
    (
        "4-2-4",
        "수장합판 설치('24 보완)",
        "일당",
        "건축목공 2 · 보통인부 1",
        "37㎡",
        "바탕합판 위 수장합판",
        "646",
        ["4-2-4", "37"],
    ),
]

# 팀 값(book.py)과 같은 공정의 2025 하반기 표준시장단가 코드
STD_TEAM = {
    "AOB110200000": ("labor_wall", "DOBAE", "도배지바름 콘크리트 · 모르타르면 벽"),
    "AOB130100000": ("labor_ceiling", "DOBAE", "도배지바름 합판 · 석고보드면 천장"),
    "AOB110100000": (None, "DOBAE", "도배지바름 합판 · 석고보드면 벽"),
    "AOB130200000": (None, "DOBAE", "도배지바름 콘크리트 · 모르타르면 천장"),
    "AOG002000000": ("molding", "MOKGONG", "몰딩 설치"),
    "AOA530001200": ("base", "MOKGONG", "걸레받이 MDF 75~120㎜"),
    "ALB452100000": ("door_install", "MOKGONG", "목재창호 설치 여닫이 1.0~3.0㎡"),
    "ALB400100000": ("casing", "MOKGONG", "목재창호 설치 문선"),
    "AJI500045000": ("frame", "MOKGONG", "경량철골천장틀 BAR 450"),
    "AOC321000100": ("board", "MOKGONG", "석고판 못붙임 바탕용 1겹 천장"),
}


def read_csv(path: Path) -> list[dict]:
    csv.field_size_limit(10**9)
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def num(s: str) -> int | None:
    s = (s or "").replace(",", "").strip()
    return int(s) if s.isdigit() else None


def wages() -> tuple[list[dict], dict]:
    by: dict[str, dict[str, int | None]] = {}
    src = ""
    for x in read_csv(WAGES):
        if x["record_type"] != "occupation_wage" or x["occupation_code"] not in OCC:
            continue
        by.setdefault(x["occupation_code"], {})[x["publication_date"]] = num(x["original_value"])
        src = x["source"]
    rows = []
    for code, name in OCC.items():
        v = by.get(code, {})
        h1, h2, p2 = v.get("2026.1.1"), v.get("2026.9.1"), v.get("2025.9.1")
        rows.append(
            {
                "occupation_code": code,
                "occupation_name": name,
                "wage_2025_9_1": p2 or "",
                "wage_2026_1_1": h1 or "",
                "wage_2026_9_1": h2 or "",
                "h2_vs_h1_pct": round((h2 / h1 - 1) * 100, 2) if h1 and h2 else "",
                "yoy_pct": round((h2 / p2 - 1) * 100, 2) if p2 and h2 else "",
                "web_check_2026_1_1": (
                    "같음" if WEB_H1.get(code) == h1 else f"다름({WEB_H1[code]})"
                )
                if code in WEB_H1
                else "웹 확인 못 함",
                "web_check_2026_9_1": (
                    "같음" if WEB_H2.get(code) == h2 else f"다름({WEB_H2[code]})"
                )
                if code in WEB_H2
                else "웹 확인 못 함",
                "unit": "원/일(8시간)",
                "source": f"대한건설협회 건설업 임금실태조사 보고서 전처리본 ({src})",
                "source_file": "data/processed/06_construction_wages.csv",
                "web_source_h1": WEB_H1_URL if code in WEB_H1 else "",
                "web_source_h2": WEB_H2_URL if code in WEB_H2 else "",
                "checked_at": CHECKED,
            }
        )
    return rows, {c: by.get(c, {}) for c in OCC}


def pumsem() -> list[dict]:
    text: dict[str, str] = {}
    csv.field_size_limit(10**9)
    with PUMSEM.open(encoding="utf-8-sig", newline="") as f:
        for x in csv.DictReader(f):
            if x["record_type"] == "page_context":
                text[x["page"]] = text.get(x["page"], "") + "\n" + (x["source_text"] or "")
    rows = []
    for code, name, unit, labor, output, note, page, checks in PUMSEM_ITEMS:
        t = text.get(page, "")
        missing = [c for c in checks if c not in t]
        rows.append(
            {
                "work_code": code,
                "work_name": name,
                "unit": unit,
                "labor": labor,
                "output_per_day": output,
                "note": note,
                "pdf_page": page,
                "check_in_repo_text": "통과" if not missing else f"없음:{missing}",
                "source": "2026 건설공사 표준품셈(원문 정오표 1차 반영) · 국토교통부 공고(2025-12-23, 2026-01-01 적용)",
                "source_file": "data/processed/03_standard_productivity.csv",
                "license": "공공저작물(저작권법 제7조, 고시 · 공고)",
                "checked_at": CHECKED,
            }
        )
    return rows


def team_books():
    sys.path.insert(0, str(ROOT / "backend"))
    from app.refprice.book import DOBAE_2026H2, MOKGONG_2026H2

    return DOBAE_2026H2, MOKGONG_2026H2


def std_market(dobae, mok) -> list[dict]:
    rows = []
    std = {}
    if STD.exists():
        for line in STD.read_text(encoding="utf-8").splitlines():
            if line.strip():
                x = json.loads(line)
                std[x["code"]] = x
    for code, (field, book, label) in STD_TEAM.items():
        x = std.get(code, {})
        team = getattr(dobae if book == "DOBAE" else mok, field) if field else None
        t25 = x.get("total")
        rows.append(
            {
                "code": code,
                "item": label,
                "unit": x.get("unit", ""),
                "y2025h2_material": x.get("material", ""),
                "y2025h2_labor": x.get("labor", ""),
                "y2025h2_total": t25 or "",
                "team_value_2026h2": team if team is not None else "",
                "team_vs_2025h2_pct": round((team / t25 - 1) * 100, 2) if team and t25 else "",
                "y2026h1_official": "확인 못 함",
                "y2026h2_official": "확인 못 함",
                "note": "2026 상반기: 2025-12-23 공고 · 2026-01-01 적용(전년 대비 2.98%↑). 2026 하반기: 2026-05-08 공고 · 즉시 적용(3월 건설공사비지수 반영). 항목별 값은 원문을 못 구했어요",
                "source_2025h2": "조달청_공사원가_표준시장단가 (공공데이터포털 15151298, 최신발표일자 2025-08-04, 이용허락 제한 없음)",
                "checked_at": CHECKED,
            }
        )
    return rows


def comparison(wage_by: dict, dobae, mok) -> list[dict]:
    w = lambda code, d="2026.9.1": wage_by[code][d]
    d_rm_wall = 0.008 * w("1031") + 0.005 * w("1002")
    d_rm_ceil = 0.010 * w("1031") + 0.007 * w("1002")
    ex_wall = 2 / 46 * w("1030")
    ex_ceil = 2 / 35 * w("1030")
    rows = [
        (
            "보통인부 노임(2026.9.1)",
            f"{172698:,}원 (book.py _WAGE_HELPER)",
            f"{w('1002'):,}원",
            "같음",
            "임금실태조사 전처리본 · 유리지갑 2차 표와 같음",
        ),
        (
            "도배공 노임",
            "계산에 직접 안 씀(표준시장단가에 노무비 포함)",
            f"2026.1.1 {w('1031', '2026.1.1'):,}원 → 2026.9.1 {w('1031'):,}원",
            "참고",
            "2026.9.1 값은 저장소 PDF 전처리본만 있고 웹 2차 자료로는 확인 못 함",
        ),
        (
            "기존 벽지 떼내기(벽)",
            f"{dobae.removal:,}원/㎡ (보통인부 노임 × 0.01)",
            f"{round(d_rm_wall):,}원/㎡ (품셈 3-2-7: 도배공 0.008 + 보통인부 0.005)",
            f"{round((dobae.removal / d_rm_wall - 1) * 100)}%",
            f"천장은 품셈으로 {round(d_rm_ceil):,}원/㎡(도배공 0.010 + 보통인부 0.007). 저장소는 벽 · 천장 같은 값",
        ),
        (
            "벽 도배 품(인/㎡)",
            f"{dobae.md_wall} (도배공만)",
            "도배공 2 ÷ 85㎡ = 0.0235(합판 · 석고) / 2 ÷ 95㎡ = 0.0211(콘크리트), 보통인부 1인 따로",
            "석고면과 거의 같음",
            "품셈 5-3-7. 보통인부 품은 저장소 계산에 없음",
        ),
        (
            "천장 도배 품(인/㎡)",
            f"{dobae.md_ceiling} (0.027 × 1.3)",
            "도배공 2 ÷ (85 × 0.77) = 0.0306(합판 · 석고) / 2 ÷ (95 × 0.77) = 0.0273(콘크리트)",
            f"{round((float(dobae.md_ceiling) / 0.0306 - 1) * 100)}%(석고 기준)",
            "품셈은 천장 시공량 23% 감만 둬요. × 1.3 근거는 저장소 주석에 없음",
        ),
        (
            "정배지 · 초배지 소요량",
            f"정배 {dobae.paper_ratio} · 초배 벽 {dobae.primer_wall_ratio} · 천장 {dobae.primer_ceiling_ratio}",
            "정배지 1.2 · 초배지 콘크리트면 1.2 · 합판 · 석고면 0.8 (할증 포함)",
            "같음",
            "품셈 5-3-7 재료량",
        ),
        (
            "짐 있는 집 감산",
            f"시공량 × {dobae.occupied_output}",
            "품셈 3-4-3 · 3-4-4 · 3-4-5: 사용 중 세대 지장물 있으면 시공량 15% 감",
            "같음",
            "",
        ),
        (
            "살면서 하는 도배 교체 노무(벽)",
            f"도배지바름 {dobae.labor_wall:,} + 떼내기 {dobae.removal:,} = {dobae.labor_wall + dobae.removal:,}원/㎡",
            f"{round(ex_wall):,}원/㎡ (품셈 3-4-3: 내장공 2인 ÷ 46㎡ × 내장공 노임)",
            f"{round(((dobae.labor_wall + dobae.removal) / ex_wall - 1) * 100)}%",
            f"천장은 {round(ex_ceil):,}원/㎡. 3-4-3은 해체 · 바탕정리 · 초배 · 정배를 다 넣은 교체 품이라 신축 기준(5-3-7)과 달라요. 어느 쪽을 쓸지 팀 확인 필요",
        ),
        ("몰딩 품(인/m)", f"{mok.md_molding}", "내장공 0.035 (품셈 8-1-5, 천장갓둘레)", "같음", ""),
        (
            "걸레받이 품(인/m)",
            f"{float(mok.md_base):.5f}",
            "내장공 2 ÷ 165m = 0.01212 (품셈 5-3-5, MDF)",
            "같음",
            "",
        ),
        (
            "방문 설치 품(인/개소)",
            f"{mok.md_door}",
            "창호공 0.313 · 보통인부 0.064 (품셈 10-1-1 여닫이 1.0~3.0㎡)",
            "창호공은 같음",
            "보통인부 0.064는 저장소 품에 없음",
        ),
        ("문선 품(인/m)", f"{mok.md_casing}", "창호공 0.010 (품셈 10-1-1 비고)", "같음", ""),
        (
            "천장 석고판 품(인/㎡)",
            f"{float(mok.md_board):.4f}",
            "내장공 2 ÷ 45㎡ = 0.0444 (품셈 5-2-3 바탕용 1겹)",
            "같음",
            "",
        ),
        (
            "도배지바름 단가(벽)",
            f"{dobae.labor_wall:,}원/㎡ ('2026 하반기')",
            "2025 하반기 5,885원/㎡(재료 236 + 노무 5,649). 2026 값은 원문 확인 못 함",
            "+1.8%(2025H2 대비)",
            "반기 개정분으로 보이지만 확인 못 함",
        ),
        (
            "실크 벽지 자재(㎡)",
            f"{dobae.paper['basic']:,}원/㎡ (조달청 비닐벽지, 실크 대용)",
            "시장 롤 49,250원 ÷ 16.5㎡ = 2,985원/㎡ (data/v3/wallpaper_price)",
            f"+{round((dobae.paper['basic'] / 2985 - 1) * 100)}%",
            "조달청 가격정보 원문은 이번에 다시 열지 못했어요",
        ),
        (
            "합지 벽지 자재(㎡)",
            f"{dobae.paper['economy']:,}원/㎡ (팀 가정값)",
            "광폭합지 롤 23,000원 ÷ 16.5㎡ = 1,394원/㎡ (대동벽지 견적 58줄, 한 가게)",
            f"{round((dobae.paper['economy'] / 1394 - 1) * 100)}%",
            "합지 공공 가격은 없어요",
        ),
        (
            "도배 면적 계수(공급 ㎡ → 벽 + 천장 ㎡)",
            f"{dobae.area_factor['supply']} (전용은 {dobae.area_factor['exclusive']})",
            "실견적 롤 수 실크 0.532롤/평 · 합지 0.50롤/평 → 롤 16.5㎡ ÷ 할증 1.2 ÷ 3.3058로 바꾸면 약 2.21 · 2.08",
            "+13%(실크 기준)",
            "data/v3/area · wallpaper_price 참고. 시장 계산(market.py)은 이미 2.24 · 2.16을 써요",
        ),
        (
            "도배사 일당",
            "직접 안 씀",
            "실견적 줄 인건비 22건 중앙값 270,000원(25만~29만)",
            "참고",
            "시중노임 도배공 229,833원보다 약 17% 높아요(식대 포함 견적 섞임)",
        ),
    ]

    def source_of(item: str, v3: str) -> str:
        """v3 값이 어디서 왔는지(저장소 값은 모두 backend/app/refprice/book.py DOBAE_2026H2 · MOKGONG_2026H2)."""
        if "노임" in item:
            return "data/processed/06_construction_wages.csv(대한건설협회 임금실태조사) · 웹 2차 표"
        if "품셈" in v3 or "품(" in item or "소요량" in item or "감산" in item:
            return "2026 표준품셈 전처리본(data/processed/03_standard_productivity.csv) → data/v3/refprice_2026/pumsem_2026.csv"
        if "도배지바름" in item:
            return "조달청 공사원가 표준시장단가 2025 하반기(공공데이터포털 15151298)"
        if "면적" in item:
            return "data/v3/area/area_rules.json · data/v3/wallpaper_price/result.json"
        return "data/v3/wallpaper_price/result.json(실견적 · 웹 자료)"

    # diff = 저장소 값 ÷ v3 값 − 1 (양수면 저장소가 커요)
    return [
        {
            "item": a,
            "repo_value": b,
            "v3_value": c,
            "diff_repo_vs_v3": d,
            "note": e,
            "repo_source": "backend/app/refprice/book.py",
            "v3_source": source_of(a, c),
            "checked_at": CHECKED,
        }
        for a, b, c, d, e in rows
    ]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wrows, wage_by = wages()
    avg_rows = [
        {
            "occupation_code": "AVG132",
            "occupation_name": "132개 직종 일평균(공표)",
            "wage_2025_9_1": "",
            "wage_2026_1_1": AVG["2026.1.1"][0],
            "wage_2026_9_1": AVG["2026.9.1"][0],
            "h2_vs_h1_pct": round((AVG["2026.9.1"][0] / AVG["2026.1.1"][0] - 1) * 100, 2),
            "yoy_pct": 1.40,
            "web_check_2026_1_1": "보도 · 2차 자료",
            "web_check_2026_9_1": "보도(경북매일 2026-09-01)",
            "unit": "원/일(8시간)",
            "source": "대한건설협회 2026년 하반기 적용 건설업 임금실태조사 결과 공표(2026-09-01) 보도",
            "source_file": "-(웹 보도)",
            "web_source_h1": AVG["2026.1.1"][1],
            "web_source_h2": AVG["2026.9.1"][1],
            "checked_at": CHECKED,
        }
    ]
    write_csv(OUT / "wages_2026.csv", wrows + avg_rows)
    prows = pumsem()
    write_csv(OUT / "pumsem_2026.csv", prows)
    dobae, mok = team_books()
    write_csv(OUT / "std_market_price.csv", std_market(dobae, mok))
    write_csv(OUT / "comparison.csv", comparison(wage_by, dobae, mok))
    bad = [p["work_code"] for p in prows if p["check_in_repo_text"] != "통과"]
    print(
        f"노임 {len(wrows)}직종 · 품셈 {len(prows)}항목(원문 글자 확인 실패 {len(bad)}) · 표준시장단가 {len(STD_TEAM)}항목"
    )


if __name__ == "__main__":
    main()
