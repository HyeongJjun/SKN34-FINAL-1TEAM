"""지식 보강 2회차 조각 검사. 묶은 파일(chunks.jsonl)이나 나눠 쓴 파일(parts/*.jsonl)을 봐요.

세는 것: 개수 · 빈 칸 · id 중복(1회차 포함) · 출처 없는 행 · 값 밖(공종 · 주제 · 라이선스 · 빈 주제) ·
요지 문장 수(3~6) · 해요체 요지 문장 수(2~4) · 해요체 요지의 숫자가 요지(summary)에 있는지 · 해요체로 끝나는지 ·
고객 질문(answers) 3~5개 · dev 질문을 그대로 옮긴 것 · 빈 주제마다 2개 이상.
실행: python -X utf8 data/v3/knowledge/iter2/check.py [파일 ...] [--gaps=G01,G02]   (파일을 안 주면 chunks.jsonl)
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
TRADES = {"dobae", "mokgong", "floor", "tile", "bath", "kitchen", "paint", "film", "electric", "window",
          "demolition", "plumbing", "common"}  # fmt: skip
TOPICS = {"spec", "defect", "contract", "dispute", "permit", "noise", "waste", "asbestos", "air",
          "productivity", "safety", "license_biz", "guide"}  # fmt: skip
LICENSES = {"공공저작물(저작권법 제7조, 법령 · 고시)", "공공누리 제1유형", "공공누리 제4유형(요지만)",
            "확인 못 함(요지만)"}  # fmt: skip
REQUIRED = ["id", "gap", "trade", "topic", "title", "summary", "summary_haeyo", "source_url",
            "source_name", "clause", "checked_at", "license", "answers"]  # fmt: skip
NUM = re.compile(
    r"\d[\d,]*(?:\.\d+)?\s?(?:만|억|천)?\s?"
    r"(?:원|㎡|m²|mm|cm|km|m|년|개월|달|주|일|시간|분|초|%|℃|°C|품|평|배|회|층|세대|dB|kg|g|L|ℓ|cm²|개|장|롤)?"
)
ENDS = ("요", "죠")


def sentences(s: str) -> list[str]:
    # 문장 끝 = 한글 · 닫는 괄호 뒤 마침표 · 물음표. '1999. 9. 1.' 같은 날짜는 끝으로 안 세요
    return [x.strip() for x in re.split(r"(?<=[가-힣)])[.!?](?:\s+|$)", s.strip()) if x.strip()]


def haeyo_ok(sent: str) -> bool:
    s = re.sub(r"(\s*\([^()]*\))+\s*$", "", sent.strip()).rstrip(" .!?~\"'”’")
    return s.endswith(ENDS)


def flat(s: str) -> str:
    return re.sub(r"\s+", "", s).replace(",", "")


def numbers_missing(haeyo: str, summary: str) -> list[str]:
    base = flat(summary)
    out = []
    for m in NUM.finditer(haeyo):
        tok = m.group(0).strip()
        if tok and flat(tok) not in base:
            out.append(tok)
    return out


def norm(s: str) -> str:
    return re.sub(r"[\s\W_]+", "", s)


def dev_texts() -> set[str]:
    """dev 질문 글(새는지 보려고). 이름에 heldout · held_out이 든 파일은 열지 않아요"""
    files = [*sorted((ROOT / "data" / "v3" / "questions").glob("*.jsonl")),
             *(ROOT / "evaluation" / "rag" / n for n in ("questions.jsonl", "questions_300.jsonl", "questions_sigong.jsonl")),
             ROOT / "evaluation" / "v3" / "sets" / "multi.jsonl"]  # fmt: skip
    out = set()
    for p in files:
        if re.search(r"held_?out", p.name) or not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                if r.get("split") == "dev":
                    out.add(norm(r["text"]))
    return out


def load(paths: list[Path]) -> list[dict]:
    rows = []
    for p in paths:
        for i, line in enumerate(p.read_text(encoding="utf-8-sig").splitlines(), 1):
            if line.strip():
                r = json.loads(line)
                r["_where"] = f"{p.name}:{i}"
                rows.append(r)
    return rows


def check(
    rows: list[dict], only: set[str] | None = None
) -> tuple[list[tuple[str, str]], list[str]]:
    table: list[tuple[str, str]] = []
    problems: list[str] = []
    gaps = json.loads((HERE / "gaps.json").read_text(encoding="utf-8"))["topics"]
    gap_ids = {g["id"] for g in gaps}
    want = only or gap_ids  # 2개 이상인지 볼 빈 주제
    old = {
        json.loads(x)["id"]
        for x in (HERE.parent / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
        if x.strip()
    }
    dev = dev_texts()

    def bad(kind: str, r: dict, why: str = "") -> None:
        problems.append(f"{kind}: {r.get('id') or r['_where']} {why}".rstrip())

    ids = Counter(r.get("id") for r in rows)
    for r in rows:
        for k in REQUIRED:
            v = r.get(k)
            if v in (None, "", []) or (isinstance(v, str) and not v.strip()):
                bad("빈 칸", r, k)
        if ids[r.get("id")] > 1:
            bad("id 중복", r)
        if r.get("id") in old:
            bad("1회차 id와 겹침", r)
        if not str(r.get("source_url", "")).startswith(("http://", "https://")):
            bad("출처 주소 없음", r)
        for k, allowed in (
            ("trade", TRADES),
            ("topic", TOPICS),
            ("license", LICENSES),
            ("gap", gap_ids),
        ):
            if r.get(k) not in allowed:
                bad("값 밖", r, f"{k}={r.get(k)}")
        for t in r.get("also", []) or []:
            if t not in TRADES:
                bad("값 밖", r, f"also={t}")
        s, h = r.get("summary", ""), r.get("summary_haeyo", "")
        if not 3 <= len(sentences(s)) <= 6:
            bad("요지 문장 수", r, str(len(sentences(s))))
        hs = sentences(h)
        if not 2 <= len(hs) <= 4:
            bad("해요체 문장 수", r, str(len(hs)))
        if not all(haeyo_ok(x) for x in hs):
            bad("해요체 아님", r, next(x for x in hs if not haeyo_ok(x))[-25:])
        miss = numbers_missing(h, s)
        if miss:
            bad("해요체 숫자가 요지에 없음", r, ", ".join(miss))
        ans = r.get("answers") or []
        if not 3 <= len(ans) <= 5 or not all(isinstance(a, str) and a.strip() for a in ans):
            bad("질문 수", r, str(len(ans)))
        for a in ans:
            if norm(a) in dev:
                bad("dev 질문을 그대로 옮김", r, a)
            if len(a) > 80:
                bad("질문 80자 넘음", r, a[:20])
    per_gap = Counter(r.get("gap") for r in rows)
    short = sorted(g for g in want if per_gap.get(g, 0) < 2)
    sums = Counter(norm(r.get("summary", "")) for r in rows)
    answers = Counter(norm(a) for r in rows for a in r.get("answers") or [])
    table += [
        ("조각 수", str(len(rows))),
        ("필수 칸 빈 칸 · id 중복 · 1회차와 겹침", " · ".join(str(sum(1 for p in problems if p.startswith(k))) for k in ("빈 칸", "id 중복", "1회차"))),
        ("출처 주소 없는 행", str(sum(1 for p in problems if p.startswith("출처 주소")))),
        ("값 밖(공종 · 주제 · 라이선스 · 빈 주제)", str(sum(1 for p in problems if p.startswith("값 밖")))),
        ("요지 3~6문장 벗어남 · 해요체 2~4문장 벗어남", f"{sum(1 for p in problems if p.startswith('요지 문장'))} · {sum(1 for p in problems if p.startswith('해요체 문장'))}"),
        ("해요체로 안 끝나는 조각", str(sum(1 for p in problems if p.startswith("해요체 아님")))),
        ("해요체 숫자가 요지에 없는 조각", str(sum(1 for p in problems if p.startswith("해요체 숫자")))),
        ("질문 3~5개 벗어남 · 80자 넘음 · dev 질문 그대로", f"{sum(1 for p in problems if p.startswith('질문 수'))} · {sum(1 for p in problems if p.startswith('질문 80'))} · {sum(1 for p in problems if p.startswith('dev 질문'))}"),
        ("요지 같은 글자 중복 · 질문 같은 글자 중복", f"{sum(v - 1 for v in sums.values() if v > 1)} · {sum(v - 1 for v in answers.values() if v > 1)}"),
        ("빈 주제별 조각 수", ", ".join(f"{g} {per_gap.get(g, 0)}" for g in sorted(want))),
        ("2개 못 채운 빈 주제", " · ".join(short) or "없음"),
        ("라이선스별", ", ".join(f"{k} {v}" for k, v in Counter(r.get("license") for r in rows).most_common())),
        ("확인 방법별(verify)", ", ".join(f"{k} {v}" for k, v in Counter(r.get("verify", "") for r in rows).most_common())),
    ]  # fmt: skip
    if sums and max(sums.values()) > 1:
        problems.append("요지 같은 글자 중복")
    if short:
        problems.append(f"2개 못 채운 빈 주제: {short}")
    return table, problems


def main() -> None:
    args = sys.argv[1:]
    only = {g for a in args if a.startswith("--gaps=") for g in a[7:].split(",") if g}
    paths = [Path(a) for a in args if not a.startswith("--")] or [HERE / "chunks.jsonl"]
    table, problems = check(load(paths), only or None)
    for k, v in table:
        print(f"| iter2 | {k} | {v} |")
    if problems:
        print("\n문제:")
        for p in problems[:80]:
            print("-", p)
        sys.exit(1)
    print("\n문제 없음")


if __name__ == "__main__":
    main()
