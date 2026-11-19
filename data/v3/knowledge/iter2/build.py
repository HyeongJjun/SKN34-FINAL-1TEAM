"""지식 보강 2회차: 나눠 쓴 조각(parts/*.jsonl)을 묶고 출처표를 만들어요. 원문을 길게 옮겼는지도 재요.

- 출력: chunks.jsonl(빈 주제 · id 순) · sources.csv(문서별 조각 수)
- 원문 옮김: 근거(evidence)가 저장소 사본(consult/rag5.json 조각 · data/processed CSV · data/v3 CSV)이면
  요지 · 해요체 요지와 근거 본문이 공백 빼고 가장 길게 같은 글자 수를 재요(웹에서 연 근거는 본문이 없어 못 재요).
실행: python -X utf8 data/v3/knowledge/iter2/build.py   (그다음 check.py)
"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
COPY_LIMIT = 40  # 이어 옮긴 글자 상한(공백 빼고)


def local_texts() -> dict[str, str]:
    d = json.loads((ROOT / "data" / "consult" / "rag5.json").read_text(encoding="utf-8"))
    out = {c["id"]: c["text"] for c in d["chunks"]}
    for p in [
        *(ROOT / "data" / "processed").glob("*.csv"),
        *(ROOT / "data" / "v3" / "refprice_2026").glob("*.csv"),
    ]:
        with p.open(encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                text = (
                    r.get("content") or r.get("source_text") or " ".join(str(v) for v in r.values())
                )
                rel = p.relative_to(ROOT / "data").as_posix()
                out[f"{rel}#{r.get('id') or r.get('code') or ''}"] = text
                out[f"processed/{p.name}#{r.get('id', '')}"] = text
                out[f"data/{rel}#{r.get('id') or r.get('code') or ''}"] = text
    return out


def flat(s: str) -> str:
    return re.sub(r"\s+", "", s)


def longest(a: str, b: str) -> int:
    a, b = flat(a), flat(b)
    if not a or not b:
        return 0
    m = SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b))
    return m.size


def main() -> None:
    rows = []
    for p in sorted((HERE / "parts").glob("*.jsonl")):
        rows += [json.loads(x) for x in p.read_text(encoding="utf-8-sig").splitlines() if x.strip()]
    rows.sort(key=lambda r: (r["gap"], r["id"]))
    texts = local_texts()
    measured, over, worst = 0, [], (0, "")
    for r in rows:
        ev = [texts[e] for e in r.get("evidence", []) if e in texts]
        if not ev:
            continue
        measured += 1
        n = max(longest(r[k], t) for k in ("summary", "summary_haeyo") for t in ev)
        if n > worst[0]:
            worst = (n, r["id"])
        if n > COPY_LIMIT:
            over.append(f"{r['id']}({n})")
    with (HERE / "chunks.jsonl").open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    docs: dict[str, dict] = {}
    gaps = defaultdict(set)
    for r in rows:
        k = r["doc_key"]
        d = docs.setdefault(k, {"doc_key": k, "source_name": r["source_name"], "source_url": r["source_url"],
                                "license": r["license"], "verify": set(), "chunk_count": 0})  # fmt: skip
        d["verify"].add(r.get("verify", ""))
        d["chunk_count"] += 1
        gaps[k].add(r["gap"])
    with (HERE / "sources.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["doc_key", "source_name", "source_url", "license", "verify", "chunk_count", "gaps"]
        )
        for k, d in sorted(docs.items(), key=lambda kv: (-kv[1]["chunk_count"], kv[0])):
            w.writerow([k, d["source_name"], d["source_url"], d["license"], ";".join(sorted(d["verify"])),
                        d["chunk_count"], ";".join(sorted(gaps[k]))])  # fmt: skip
    maker = sum(
        1 for r in rows if "제조사" in r["source_name"] or "제조사 안내 사례" in r["summary"]
    )
    print(f"{len(rows)}조각 → chunks.jsonl · 문서 {len(docs)}개 → sources.csv")
    print(f"제조사 사례 조각 {maker}개")
    print(
        f"원문 옮김(저장소 근거가 있는 {measured}조각): 가장 긴 같은 글자 {worst[0]}자({worst[1]}) · {COPY_LIMIT}자 넘는 조각 {len(over)}개 {' '.join(over)}"
    )


if __name__ == "__main__":
    main()
