"""data/v3 묶음 점검: 개수 · 빈 칸 · 중복 · 출처 없는 행 · 값 범위.

결과를 마크다운 표로 찍어요(docs/v3/verification/data.md에 그대로 옮겨요). 문제가 있으면 끝에 목록을 찍고 종료 코드 1.
실행: python -X utf8 data/v3/scripts/validate.py
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
V3 = ROOT / "data" / "v3"
TRADES = [
    "dobae",
    "mokgong",
    "floor",
    "tile",
    "bath",
    "kitchen",
    "paint",
    "film",
    "electric",
    "window",
    "demolition",
    "plumbing",
    "common",
]
TOPICS = {
    "spec",
    "defect",
    "contract",
    "dispute",
    "permit",
    "noise",
    "waste",
    "asbestos",
    "air",
    "productivity",
    "safety",
    "license_biz",
    "guide",
}
INTENTS = {"가격", "자재", "공법", "기간", "하자", "업체", "계약", "순서", "범위밖"}
LICENSES = {
    "공공저작물(저작권법 제7조, 법령 · 고시)",
    "공공누리 제1유형",
    "공공누리 제4유형(요지만)",
    "확인 못 함(요지만)",
}
problems: list[str] = []
table: list[tuple[str, str, str]] = []


def add(bundle: str, what: str, value) -> None:
    table.append((bundle, what, str(value)))


def jsonl(path: Path) -> list[dict]:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        problems.append(f"{path.name}: BOM 있음")
    return [json.loads(x) for x in raw.decode("utf-8-sig").splitlines() if x.strip()]


def rcsv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def norm(s: str) -> str:
    return re.sub(r"[\s\W_]+", "", s)


def sentences(s: str) -> int:
    # 문장 끝 = 한글 · 닫는 괄호 뒤 마침표. '1999. 9. 1.' 같은 날짜는 문장 끝으로 안 세요
    return len([x for x in re.split(r"(?<=[가-힣)])[.!?](?:\s+|$)", s.strip()) if x.strip()])


def knowledge() -> None:
    rows = jsonl(V3 / "knowledge" / "chunks.jsonl")
    req = [
        "id",
        "trade",
        "topic",
        "title",
        "summary",
        "source_url",
        "source_name",
        "clause",
        "checked_at",
        "license",
    ]
    blank = sum(1 for r in rows for k in req if not str(r.get(k, "")).strip())
    dup = len(rows) - len({r["id"] for r in rows})
    nos = sum(1 for r in rows if not str(r.get("source_url", "")).strip())
    badsent = [r["id"] for r in rows if not 3 <= sentences(r["summary"]) <= 6]
    badtrade = [r["id"] for r in rows if r["trade"] not in TRADES]
    badtopic = [r["id"] for r in rows if r["topic"] not in TOPICS]
    badlic = [r["id"] for r in rows if r["license"] not in LICENSES]
    per_trade = Counter(r["trade"] for r in rows)
    add("knowledge", "조각 수", len(rows))
    add("knowledge", "필수 10칸 빈 칸 수", blank)
    add("knowledge", "id 중복", dup)
    add("knowledge", "source_url 없는 행", nos)
    add("knowledge", "요지 문장 수 3~6 벗어남", len(badsent))
    add(
        "knowledge",
        "공종 · 주제 · 라이선스 값 밖",
        f"{len(badtrade)} · {len(badtopic)} · {len(badlic)}",
    )
    add("knowledge", "summary 같은 글자 중복", len(rows) - len({norm(r["summary"]) for r in rows}))
    add(
        "knowledge",
        "공종별(최소)",
        f"{min(per_trade.get(t, 0) for t in TRADES)} ({', '.join(f'{t} {per_trade.get(t, 0)}' for t in TRADES)})",
    )
    add(
        "knowledge",
        "주제별",
        ", ".join(f"{k} {v}" for k, v in Counter(r["topic"] for r in rows).most_common()),
    )
    add(
        "knowledge",
        "verify별",
        ", ".join(f"{k} {v}" for k, v in Counter(r.get("verify", "") for r in rows).most_common()),
    )
    add(
        "knowledge",
        "license별",
        ", ".join(f"{k} {v}" for k, v in Counter(r["license"] for r in rows).most_common()),
    )
    src = rcsv(V3 / "knowledge" / "sources.csv")
    add(
        "knowledge/sources.csv",
        "문서 수 · doc_key 중복",
        f"{len(src)} · {len(src) - len({s['doc_key'] for s in src})}",
    )
    total = sum(int(s["chunk_count"] or 0) for s in src)
    add(
        "knowledge/sources.csv",
        "chunk_count 합 = 조각 수",
        f"{total} = {len(rows)} → {'맞음' if total == len(rows) else '다름'}",
    )
    keys = {s["doc_key"] for s in src}
    add(
        "knowledge/sources.csv",
        "sources.csv에 없는 doc_key를 쓴 조각",
        sum(1 for r in rows if r.get("doc_key") not in keys),
    )
    if len(rows) < 150:
        problems.append("knowledge: 150조각 미만")
    for name, v in (("blank", blank), ("dup", dup), ("nosrc", nos)):
        if v:
            problems.append(f"knowledge: {name} {v}")
    problems.extend(f"knowledge 문장 수: {x}" for x in badsent)
    problems.extend(f"knowledge 값 밖: {x}" for x in badtrade + badtopic + badlic)
    if total != len(rows):
        problems.append("knowledge: sources.csv chunk_count 합이 다름")


def knowledge_iter2() -> None:
    """지식 보강 2회차(data/v3/knowledge/iter2) 검사. 세는 규칙은 iter2/check.py 한 곳에 있어요"""
    import importlib.util

    here = V3 / "knowledge" / "iter2"
    spec = importlib.util.spec_from_file_location("iter2_check", here / "check.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    rows, probs = mod.check(mod.load([here / "chunks.jsonl"]))
    for what, value in rows:
        add("knowledge/iter2", what, value)
    problems.extend(f"knowledge/iter2 {x}" for x in probs)


def questions() -> None:
    allrows, seen = [], Counter()
    req = [
        "id",
        "trade",
        "text",
        "intent",
        "difficulty",
        "expect",
        "source_url",
        "source_name",
        "source_check",
        "checked_at",
        "split",
    ]
    for t in TRADES:
        p = V3 / "questions" / f"{t}.jsonl"
        rows = jsonl(p)
        blank = sum(1 for r in rows for k in req if str(r.get(k, "")).strip() == "")
        intents = Counter(r["intent"] for r in rows)
        bad = [
            r["id"]
            for r in rows
            if r["intent"] not in INTENTS or r["trade"] != t or r["difficulty"] not in (1, 2, 3)
        ]
        long = sum(1 for r in rows if len(r["text"]) > 80)
        within = len(rows) - len({norm(r["text"]) for r in rows})
        price = intents.get("가격", 0) / len(rows)
        add(
            f"questions/{t}",
            "개수 · 빈 칸 · 값 밖 · 80자 초과 · 파일 안 중복",
            f"{len(rows)} · {blank} · {len(bad)} · {long} · {within}",
        )
        add(
            f"questions/{t}",
            "intent 종류 · 범위밖 · 가격 비율",
            f"{len(intents)} · {intents.get('범위밖', 0)} · {price:.0%}",
        )
        if len(rows) < 30 or blank or bad or long or within:
            problems.append(
                f"questions/{t}: 개수 {len(rows)} 빈 칸 {blank} 값 밖 {len(bad)} 80자 초과 {long} 중복 {within}"
            )
        allrows += rows
        for r in rows:
            seen[norm(r["text"])] += 1
    ids = Counter(r["id"] for r in allrows)
    add("questions(전체)", "질문 수", len(allrows))
    add(
        "questions(전체)",
        "id 중복 · 파일 사이 글자 중복",
        f"{sum(v - 1 for v in ids.values() if v > 1)} · {sum(v - 1 for v in seen.values() if v > 1)}",
    )
    add(
        "questions(전체)",
        "source_url 없는 행",
        sum(1 for r in allrows if not r["source_url"].strip()),
    )
    add(
        "questions(전체)",
        "intent",
        ", ".join(f"{k} {v}" for k, v in Counter(r["intent"] for r in allrows).most_common()),
    )
    add(
        "questions(전체)",
        "expect",
        ", ".join(f"{k} {v}" for k, v in Counter(r["expect"] for r in allrows).most_common()),
    )
    add(
        "questions(전체)",
        "source_check",
        ", ".join(f"{k} {v}" for k, v in Counter(r["source_check"] for r in allrows).most_common()),
    )
    add(
        "questions(전체)",
        "difficulty 1 · 2 · 3",
        " · ".join(str(Counter(r["difficulty"] for r in allrows)[d]) for d in (1, 2, 3)),
    )
    sp = Counter(r["split"] for r in allrows)
    add("questions(전체)", "split dev · heldout", f"{sp['dev']} · {sp['heldout']}")
    wrong_split = sum(
        1
        for r in allrows
        if r["split"]
        != (
            "heldout"
            if int(hashlib.sha1(r["text"].encode("utf-8")).hexdigest(), 16) % 3 == 0
            else "dev"
        )
    )
    add("questions(전체)", "split 해시 규칙과 다른 행", wrong_split)
    src = rcsv(V3 / "questions" / "sources.csv")
    add(
        "questions/sources.csv",
        "주소 수 · n_questions 합",
        f"{len(src)} · {sum(int(s['n_questions']) for s in src)}",
    )
    urls = {s["source_url"] for s in src}
    add(
        "questions/sources.csv",
        "sources.csv에 없는 source_url을 쓴 질문",
        sum(1 for r in allrows if r["source_url"] not in urls),
    )


def wallpaper() -> None:
    d = V3 / "wallpaper_price"
    rows = rcsv(d / "rows_used.csv")
    src = rcsv(d / "sources.csv")
    web = rcsv(d / "web_points.csv")
    res = json.loads((d / "result.json").read_text(encoding="utf-8"))
    ids = [r["id"] for r in rows]
    add(
        "wallpaper_price",
        "실견적 행 · id 중복 · 주소 없는 행",
        f"{len(rows)} · {len(ids) - len(set(ids))} · {sum(1 for r in rows if not r['url'])}",
    )
    add(
        "wallpaper_price",
        "이상치 표시",
        ", ".join(f"{k or '없음'} {v}" for k, v in Counter(r["outlier"] for r in rows).items()),
    )
    numbered = {s["source_id"] for s in src if s["measure"] == "시공가_평당" and s["median"]}
    add("wallpaper_price", "평당 시공가가 있는 출처 수(웹 포함)", len(numbered))
    add(
        "wallpaper_price",
        "출처표 행 · 주소 없는 행",
        f"{len(src)} · {sum(1 for s in src if not s['source_url'])}",
    )
    add(
        "wallpaper_price",
        "웹 자료 행 · 주소 없는 행",
        f"{len(web)} · {sum(1 for w in web if not w['source_url'])}",
    )
    for g, ko in (("silk", "실크"), ("hapji", "합지")):
        x = res["install"][g]
        add(
            "wallpaper_price",
            f"{ko} 대표값(평당) · 25~75%",
            f"{x['representative_per_pyeong']:,} · {x['range_cap30']['p25']:,}~{x['range_cap30']['p75']:,}",
        )
    if len(numbered) < 8:
        problems.append("wallpaper_price: 숫자가 있는 출처 8곳 미만")


def simple(bundle: str, files: list[str], must: list[str]) -> None:
    for fn in files:
        rows = rcsv(V3 / bundle / fn)
        blank = {
            k: sum(1 for r in rows if not str(r.get(k, "")).strip()) for k in must if k in rows[0]
        }
        add(
            f"{bundle}/{fn}",
            "행 · 출처 칸 빈 행",
            f"{len(rows)} · {sum(blank.values())} ({', '.join(f'{k} {v}' for k, v in blank.items())})",
        )


def holidays() -> None:
    rows = rcsv(V3 / "holidays" / "holidays_2026_2027.csv")
    d = json.loads((V3 / "holidays" / "diff.json").read_text(encoding="utf-8"))
    add(
        "holidays",
        "행 · 날짜 중복 · 출처 없는 행",
        f"{len(rows)} · {len(rows) - len({r['date'] for r in rows})} · {sum(1 for r in rows if not r['source_url'])}",
    )
    add("holidays", "요일 확인 오류", len(d["weekday_check_errors"]))
    add(
        "holidays",
        "holidays.py에 없는 평일 공휴일",
        " · ".join(d["weekday_holidays_missing_in_holidays_py"]) or "없음",
    )
    add(
        "holidays",
        "저장소 두 목록 다 없는 평일 공휴일",
        " · ".join(d["weekday_holidays_missing_in_both"]) or "없음",
    )
    if d["weekday_check_errors"]:
        problems.append("holidays: 요일 오류")


def vendor_baseline() -> None:
    d = json.loads((V3 / "vendor_baseline" / "baseline.json").read_text(encoding="utf-8"))
    rows = d["rows"]
    codes = [r["code"] for r in rows]
    bad = [
        r["code"]
        for r in rows
        if not (r["base"] > 0 and r["p25"] <= r["p75"] and r["n"] > 0 and r["unit"] and r["source"])
        or r["warn_above"] != r["base"] * d["warn_ratio"]
    ]
    add("vendor_baseline", "줄 · 코드", f"{len(rows)} · {', '.join(codes)}")
    add(
        "vendor_baseline",
        "기준값(단위)",
        ", ".join(f"{r['code']} {r['base']:,}원/{r['unit']}({r['stat']})" for r in rows),
    )
    add("vendor_baseline", "값 · 단위 · 출처 · 10배 칸 이상한 줄", len(bad))
    if codes != ["1201", "1203", "1204", "1205", "1206", "1207", "1208"] or bad:
        problems.append(f"vendor_baseline: 코드 {codes} 또는 이상한 줄 {bad}")


def main() -> None:
    knowledge()
    knowledge_iter2()
    questions()
    wallpaper()
    simple(
        "refprice_2026",
        ["wages_2026.csv", "pumsem_2026.csv", "std_market_price.csv", "comparison.csv"],
        ["source", "source_2025h2", "source_file", "v3_source", "repo_source", "checked_at"],
    )
    holidays()
    vendor_baseline()
    simple("area", ["exclusive_ratio.csv", "plan_paper_area.csv"], ["source_url"])
    print("| 묶음 | 무엇 | 결과 |")
    print("| --- | --- | --- |")
    for b, w, v in table:
        print(f"| {b} | {w} | {v} |")
    if problems:
        print("\n문제:")
        for p in problems:
            print("-", p)
        sys.exit(1)
    print("\n문제 없음")


if __name__ == "__main__":
    main()
