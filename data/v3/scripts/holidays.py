"""관공서 공휴일 2026 · 2027 정리 + 지금 저장소 목록과 비교.

공식 목록은 아래 OFFICIAL에 손으로 옮겼어요(출처마다 주소). 이 스크립트는
1) 날짜와 요일이 맞는지 datetime으로 다시 확인하고
2) backend/app/refprice/holidays.py(HOLIDAYS) · v2_ref.py(HOLIDAYS_EXTRA)와 비교해서
3) data/v3/holidays/holidays_2026_2027.csv · diff.json을 만들어요.

해마다 6월 말 우주항공청 월력요항(다음 해)이 나오면 OFFICIAL에 다음 해를 더하고 다시 돌려요.
실행: python -X utf8 data/v3/scripts/holidays.py
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "v3" / "holidays"
CHECKED = "2026-11-18"
WD = "월화수목금토일"

KASI26 = "https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026"
KASI27 = "https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027"
MPM = "https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?cntId=4250&mode=view"
FN27 = "https://www.fnnews.com/news/202606290904291637"

# (날짜, 요일, 이름, 종류, 근거, 출처)
OFFICIAL = [
    ("2026-01-01", "목", "1월 1일", "공휴일", "관공서의 공휴일에 관한 규정 제2조", KASI26),
    ("2026-02-16", "월", "설날 연휴", "공휴일", "규정 제2조", KASI26),
    ("2026-02-17", "화", "설날", "공휴일", "규정 제2조", KASI26),
    ("2026-02-18", "수", "설날 연휴", "공휴일", "규정 제2조", KASI26),
    ("2026-03-01", "일", "3 · 1절", "국경일", "규정 제2조", KASI26),
    ("2026-03-02", "월", "대체공휴일(3 · 1절)", "대체공휴일", "규정 제3조", KASI26),
    ("2026-05-01", "금", "노동절", "공휴일", "규정 개정(2026-04-28 국무회의, 2026-05-01부터)", MPM),
    ("2026-05-05", "화", "어린이날", "공휴일", "규정 제2조", KASI26),
    ("2026-05-24", "일", "부처님오신날", "공휴일", "규정 제2조", KASI26),
    ("2026-05-25", "월", "대체공휴일(부처님오신날)", "대체공휴일", "규정 제3조", KASI26),
    ("2026-06-03", "수", "전국동시지방선거", "선거일", "공직선거법에 따른 임기만료 선거일", KASI26),
    ("2026-06-06", "토", "현충일", "공휴일", "규정 제2조(대체공휴일 없음)", KASI26),
    (
        "2026-07-17",
        "금",
        "제헌절",
        "국경일 · 공휴일",
        "공휴일 재지정(법 개정 2026-05-11 시행, 규정 개정 2026-04-28)",
        MPM,
    ),
    ("2026-08-15", "토", "광복절", "국경일", "규정 제2조", KASI26),
    ("2026-08-17", "월", "대체공휴일(광복절)", "대체공휴일", "규정 제3조", KASI26),
    ("2026-09-24", "목", "추석 연휴", "공휴일", "규정 제2조", KASI26),
    ("2026-09-25", "금", "추석", "공휴일", "규정 제2조", KASI26),
    (
        "2026-09-26",
        "토",
        "추석 연휴",
        "공휴일",
        "토요일과 겹쳐도 설 · 추석은 대체공휴일 없음",
        KASI26,
    ),
    ("2026-10-03", "토", "개천절", "국경일", "규정 제2조", KASI26),
    ("2026-10-05", "월", "대체공휴일(개천절)", "대체공휴일", "규정 제3조", KASI26),
    ("2026-10-09", "금", "한글날", "국경일", "규정 제2조", KASI26),
    ("2026-12-25", "금", "기독탄신일", "공휴일", "규정 제2조", KASI26),
    ("2027-01-01", "금", "1월 1일", "공휴일", "2027년도 월력요항", KASI27),
    ("2027-02-06", "토", "설날 연휴", "공휴일", "월력요항", KASI27),
    ("2027-02-07", "일", "설날", "공휴일", "월력요항", KASI27),
    ("2027-02-08", "월", "설날 연휴", "공휴일", "월력요항", KASI27),
    ("2027-02-09", "화", "대체공휴일(설날)", "대체공휴일", "설날이 일요일과 겹침", KASI27),
    ("2027-03-01", "월", "3 · 1절", "국경일", "월력요항", KASI27),
    ("2027-05-01", "토", "노동절", "공휴일", "월력요항", KASI27),
    ("2027-05-03", "월", "대체공휴일(노동절)", "대체공휴일", "노동절이 토요일과 겹침", KASI27),
    ("2027-05-05", "수", "어린이날", "공휴일", "월력요항", KASI27),
    ("2027-05-13", "목", "부처님오신날", "공휴일", "월력요항", KASI27),
    ("2027-06-06", "일", "현충일", "공휴일", "대체공휴일 없음", KASI27),
    ("2027-07-17", "토", "제헌절", "국경일 · 공휴일", "월력요항", KASI27),
    ("2027-07-19", "월", "대체공휴일(제헌절)", "대체공휴일", "제헌절이 토요일과 겹침", KASI27),
    ("2027-08-15", "일", "광복절", "국경일", "월력요항", KASI27),
    ("2027-08-16", "월", "대체공휴일(광복절)", "대체공휴일", "월력요항", KASI27),
    ("2027-09-14", "화", "추석 연휴", "공휴일", "월력요항", KASI27),
    ("2027-09-15", "수", "추석", "공휴일", "월력요항", KASI27),
    ("2027-09-16", "목", "추석 연휴", "공휴일", "월력요항", KASI27),
    ("2027-10-03", "일", "개천절", "국경일", "월력요항", KASI27),
    ("2027-10-04", "월", "대체공휴일(개천절)", "대체공휴일", "월력요항", KASI27),
    ("2027-10-09", "토", "한글날", "국경일", "월력요항", KASI27),
    ("2027-10-11", "월", "대체공휴일(한글날)", "대체공휴일", "월력요항", KASI27),
    ("2027-12-25", "토", "기독탄신일", "공휴일", "월력요항", KASI27),
    ("2027-12-27", "월", "대체공휴일(기독탄신일)", "대체공휴일", "월력요항", KASI27),
]
NOTES = {
    "2027_count": "월력요항 보도: 관공서 공휴일 76일(일요일 52 포함), 일요일과 겹친 것 빼면 72일. 주 5일 기준 쉬는 날 119일. 대체공휴일 7일(2/9 · 5/3 · 7/19 · 8/16 · 10/4 · 10/11 · 12/27). 발표 2026-06-29 우주항공청 "
    + FN27,
    "temporary_2026": "2026년 임시공휴일: 확인한 범위(인사처 보도 · 검색 결과)에서 지정된 날이 없어요. 5월 4일 지정은 안 됐다는 보도가 있어요",
    "labor_day": "노동절은 관공서 공휴일이 됐어요. 민간 근로자는 근로자의날법에 따른 유급휴일이고, 고용노동부는 근로기준법상 휴일 대체가 안 된다고 설명했어요(뉴시스 2026-04-28)",
    "kasi_page": "한국천문연구원 페이지는 '공식 발표 자료가 아닙니다'라고 적혀 있어요. 2026 페이지는 노동절을 기념일(근로자의 날)로만 적어 두어 개정 전 내용이에요",
}


def repo_lists() -> tuple[dict, dict]:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.refprice.holidays import HOLIDAYS

    try:
        from app.refprice.v2_ref import HOLIDAYS_EXTRA
    except Exception:  # noqa: BLE001
        HOLIDAYS_EXTRA = {}
    return {d.isoformat(): n for d, n in HOLIDAYS.items()}, {
        d.isoformat(): n for d, n in HOLIDAYS_EXTRA.items()
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    main_list, extra = repo_lists()
    rows, bad = [], []
    for d, wd, name, kind, basis, url in OFFICIAL:
        real = WD[date.fromisoformat(d).weekday()]
        if real != wd:
            bad.append(f"{d}: 적은 요일 {wd} ≠ 실제 {real}")
        weekend = real in "토일"
        rows.append(
            {
                "date": d,
                "weekday": real,
                "name": name,
                "kind": kind,
                "is_weekend": "예" if weekend else "아니오",
                "work_day_lost": "아니오" if weekend else "예",
                "basis": basis,
                "in_repo_holidays_py": "예" if d in main_list else "아니오",
                "in_repo_v2_extra": "예" if d in extra else "아니오",
                "source_url": url,
                "checked_at": CHECKED,
            }
        )
    with (OUT / "holidays_2026_2027.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    official = {r["date"]: r for r in rows}
    weekday_official = {d for d, r in official.items() if r["is_weekend"] == "아니오"}
    diff = {
        "checked_at": CHECKED,
        "weekday_holidays_missing_in_holidays_py": sorted(
            f"{d} {official[d]['name']}" for d in weekday_official if d not in main_list
        ),
        "weekday_holidays_missing_in_both": sorted(
            f"{d} {official[d]['name']}"
            for d in weekday_official
            if d not in main_list and d not in extra
        ),
        "in_repo_not_official": sorted(
            f"{d} {n}"
            for d, n in {**main_list, **extra}.items()
            if d[:4] in ("2026", "2027") and d not in official
        ),
        "name_differences": sorted(
            f"{d}: 저장소 '{n}' / 공식 '{official[d]['name']}'"
            for d, n in main_list.items()
            if d in official and n.replace(" ", "") != official[d]["name"].replace(" ", "")
        ),
        "counts": {
            y: {
                "official_all": sum(1 for d in official if d.startswith(y)),
                "official_weekdays": sum(1 for d in weekday_official if d.startswith(y)),
                "holidays_py": sum(1 for d in main_list if d.startswith(y)),
                "v2_extra": sum(1 for d in extra if d.startswith(y)),
            }
            for y in ("2026", "2027")
        },
        "weekday_check_errors": bad,
        "notes": NOTES,
    }
    (OUT / "diff.json").write_text(json.dumps(diff, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        json.dumps(
            {
                k: diff[k]
                for k in (
                    "weekday_holidays_missing_in_holidays_py",
                    "weekday_holidays_missing_in_both",
                    "in_repo_not_official",
                    "counts",
                    "weekday_check_errors",
                )
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
