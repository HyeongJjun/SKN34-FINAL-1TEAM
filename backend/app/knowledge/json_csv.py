"""상담 지식 자료(JSON: docs · chunks) → 공통 RAG CSV. 만든 CSV는 `python -m app.data_ingest`로 적재한다.

    python -m app.knowledge.json_csv ../data/consult/rag5.json ../data/consult/consult_knowledge_rag.csv
    python -m app.knowledge.json_csv ../data/local/rag-local.json ../data/local/interior_guide_book_rag.csv

- 열 순서: 공통 9열(REQUIRED) → 검색 전용 열(EXTRA). 검색 전용 열은 적재 때 행의 provenance에 그대로 남는다.
  팀 메타데이터 열(historical · needs_review 등)은 적재에 필요 없어 넣지 않는다 (#106)
- 조각에 pdf_page(원본 파일의 쪽 번호 목록)가 있으면 그것을, 없으면 page(쪽 번호 목록)를 page 열에 `,`로 잇는다.
  둘 다 없으면 page는 1, page_known은 false (page 열이 1 이상을 요구해서)
- source_sha256은 docs[문서]에 sha256(원본 파일의 SHA-256)이 있으면 그 값, 없으면 입력 JSON 파일의 SHA-256.
  팀 전처리 CSV는 원본 파일 하나마다 그 파일의 해시를 쓴다. 웹 자료를 묶은 상담 자료처럼 원본이 파일 하나가 아니면 JSON 해시를 쓴다
- effective_date는 문서 날짜가 YYYY-MM-DD일 때만. 그 밖의 날짜 글은 doc_date에만 남긴다
- category는 대표 주제 하나: 표 조각이면 table, 아니면 첫 주제
"""

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

REQUIRED = [
    "id", "source", "source_sha256", "effective_date", "content", "section", "page", "category", "trade",
]  # fmt: skip
EXTRA = [
    "source_org", "source_url", "source_type", "ref", "doc", "trades", "hints", "rel", "doc_date",
    "page_known",
]  # fmt: skip
DAY = re.compile(r"\d{4}-\d{2}-\d{2}")


def _category(topics: list[str]) -> str:
    if "table" in topics:
        return "table"
    return next((t for t in topics if t != "text"), "")


def rows(data: dict, sha: str) -> list[dict[str, str]]:
    out = []
    for c in data["chunks"]:
        d = data["docs"].get(c["doc"]) or {}
        trades = ";".join(c.get("trades") or [])
        pages = [int(p) for p in c.get("pdf_page") or c.get("page") or []]
        day = d.get("date") or ""
        out.append(
            {
                "id": c.get("id") or c["k"],
                "source": d.get("title") or "",
                "source_sha256": d.get("sha256") or sha,
                "effective_date": day if DAY.fullmatch(day) else "",
                "content": c["text"],
                "section": c.get("sec") or "",
                "page": ",".join(map(str, pages)) or "1",
                "category": _category(c.get("topics") or []),
                "trade": trades,
                "source_org": d.get("pub") or "",
                "source_url": d.get("url") or "",
                "source_type": d.get("kind") or "",
                "ref": c["k"],
                "doc": c["doc"],
                "trades": trades,
                "hints": json.dumps(c.get("hints") or [], ensure_ascii=False),
                "rel": d.get("rel") or "",
                "doc_date": day,
                "page_known": "true" if pages else "false",
            }
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="상담 지식 JSON → 공통 RAG CSV")
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    a = ap.parse_args()
    raw = a.src.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    out = rows(data, hashlib.sha256(raw).hexdigest())
    a.out.parent.mkdir(parents=True, exist_ok=True)
    with a.out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=REQUIRED + EXTRA, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    print(f"{a.out.name}: {len(out)}행")


if __name__ == "__main__":
    main()
