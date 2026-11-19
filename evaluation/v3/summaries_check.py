"""해요체 요약(summary_haeyo) 코드 검사 · 합치기. 요약 쓰는 하위 에이전트 · CI가 같이 쓴다. LLM · DB 없음.

    backend/.venv/Scripts/python.exe evaluation/v3/summaries_check.py evaluation/v3/.cache/summ_r1/out_1.jsonl
    backend/.venv/Scripts/python.exe evaluation/v3/summaries_check.py --merge evaluation/v3/.cache/summ_r1/out_*.jsonl
    backend/.venv/Scripts/python.exe evaluation/v3/summaries_check.py --installed     # 들어간 요약 전부 다시 검사

입력 한 줄: {"ref": "K736", "sha": "<요약 묶음의 sha>", "summary_haeyo": ["…요.", "…요."]} (못 쓰면 [] + "skip": "이유")
오류(들이지 않음)
- 조각이 말뭉치에 없음 · sha가 지금 조각 글과 다름(조각이 바뀜)
- 문장 1~3개가 아님 · 한 문장 120자 넘음 · 해요체(…요)로 안 끝남 · '-다.'로 끝남
- 숫자: 요약의 숫자가 조각 글에 없음 · 숫자 뒤 단위가 조각 글의 같은 숫자 뒤 단위와 다름
- 금액(원) 숫자 · 한글 금액 · 쓰면 안 되는 표현(출력 검사와 같은 규칙) · 링크
- 원문과 연속 40자 넘게 같음(옮겨 적기)
"""

import argparse
import glob
import hashlib
import json
import re
import sys
from pathlib import Path

from common import ROOT, corpus_path, utf8_stdout
from rank_server import load_index

from app.agent.v3 import check
from app.knowledge import summaries as summ_mod
from app.v2 import guard

NUM = re.compile(
    r"(\d+(?:[.,]\d+)*)\s*(mm|cm|m²|㎡|m|%|℃|°C|도|시간|분|초|일|주|개월|년|회|겹|배|kg|g|L|ℓ|평|원|장|롤|개|층|단계|번|차)?"
)
WON = re.compile(r"\d[\d,]*\s*(?:만\s*)?원")
HANGUL_MONEY = re.compile(
    r"(?<![가-힣])[일이삼사오육칠팔구십백천만]+\s*(?:만\s*)?원(?![칙래인문본하리활목두단룸형상장천색적료자])"
)  # '연구원' · '이 원칙'은 금액이 아님
URL = re.compile(r"https?://|www\.")
END_OK = re.compile(r"요[.!?]?$")
END_DA = re.compile(r"다[.]?$")
MAX_SENT = 120
COPY_RUN = 40


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _norm(x: str) -> str:
    return x.replace(",", "")


def units_of(text: str) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for m in NUM.finditer(text):
        out.setdefault(_norm(m.group(1)), set()).add(m.group(2) or "")
    return out


def copied(a: str, b: str, n: int = COPY_RUN) -> bool:
    a2, b2 = re.sub(r"\s+", " ", a), re.sub(r"\s+", " ", b)
    return any(a2[i : i + n] in b2 for i in range(max(0, len(a2) - n + 1)))


def problems(row: dict, ix) -> list[str]:
    ref = row.get("ref", "")
    item = ix.by_ref.get(ref)
    if item is None:
        return [f"{ref}: 조각이 말뭉치에 없음"]
    src = item.chunk.text
    out = []
    if row.get("sha") and row["sha"] != sha(src):
        out.append(f"{ref}: sha가 지금 조각 글과 다름")
    sents = row.get("summary_haeyo") or row.get("summary") or []
    if not sents:
        return out if row.get("skip") else out + [f"{ref}: 요약도 skip 이유도 없음"]
    if not 1 <= len(sents) <= 3:
        out.append(f"{ref}: 문장 수 {len(sents)}")
    have = units_of(src)
    allowed = guard.numbers(src)
    for s in sents:
        t = s.strip()
        if len(t) > MAX_SENT:
            out.append(f"{ref}: {len(t)}자 넘음")
        if not END_OK.search(t) or END_DA.search(t):
            out.append(f"{ref}: 해요체로 안 끝남 · {t[-12:]}")
        if WON.search(t) or HANGUL_MONEY.search(t):
            out.append(f"{ref}: 금액")
        if URL.search(t):
            out.append(f"{ref}: 링크")
        for m in NUM.finditer(t):
            n, unit = _norm(m.group(1)), m.group(2) or ""
            if n not in have:
                out.append(f"{ref}: 숫자 {m.group(0).strip()}가 원문에 없음")
            elif unit and unit not in have[n]:
                out.append(f"{ref}: 단위 {m.group(0).strip()} ≠ 원문 {sorted(have[n])}")
        why = check._why(t, allowed, None, None)
        if why:
            out.append(f"{ref}: 출력 검사 · {why}")
        if copied(t, src):
            out.append(f"{ref}: 원문과 {COPY_RUN}자 넘게 같음")
    return out


def read(paths: list[str]) -> list[dict]:
    rows = []
    for p in paths:
        for line in Path(p).read_text(encoding="utf-8-sig").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return rows


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument(
        "--merge",
        action="store_true",
        help="오류 없는 요약을 backend/app/knowledge/summaries.jsonl에 넣는다",
    )
    ap.add_argument("--installed", action="store_true")
    a = ap.parse_args()
    ix = load_index(corpus_path())
    paths = [str(summ_mod.PATH)] if a.installed else [p for f in a.files for p in glob.glob(f)]
    rows = read(paths)
    bad, good, skip = 0, [], 0
    for r in rows:
        ps = problems(r, ix)
        if ps:
            bad += 1
            for p in ps:
                print("[오류]", p)
        elif r.get("summary_haeyo") or r.get("summary"):
            good.append({"ref": r["ref"], "sha": sha(ix.by_ref[r["ref"]].chunk.text),
                         "summary": r.get("summary_haeyo") or r["summary"],
                         "by": r.get("by", "b5-summary"), "at": r.get("at", "2026-11-19")})  # fmt: skip
        else:
            skip += 1
    print(f"요약 {len(rows)}줄 · 통과 {len(good)} · 오류 {bad} · 건너뜀 {skip}")
    if a.merge:
        old = {r["ref"]: r for r in read([str(summ_mod.PATH)])} if summ_mod.PATH.exists() else {}
        old.update({r["ref"]: r for r in good})
        rows_out = [old[k] for k in sorted(old, key=lambda x: int(x[1:]))]
        summ_mod.PATH.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in rows_out) + "\n", encoding="utf-8"
        )
        print(f"넣음: {summ_mod.PATH.relative_to(ROOT)} {len(rows_out)}줄")
    sys.exit(1 if bad and not a.merge else 0)


if __name__ == "__main__":
    main()
