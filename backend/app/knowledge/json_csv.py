"""상담 지식 자료(JSON: docs · chunks) → 팀 전처리 CSV 형식. 만든 CSV는 `python -m app.data_ingest`로 적재한다.

    python -m app.knowledge.json_csv ../data/consult/rag5.json ../data/consult/consult_knowledge_rag.csv
    python -m app.knowledge.json_csv ../data/local/rag-local.json ../data/local/interior_guide_book_rag.csv

- 팀 적재가 요구하는 열 + 검색에 쓰는 열(ref · doc · trades · hints · rel · doc_date · page_known)만 쓴다.
  팀 메타데이터 열(historical · needs_review 등)은 적재에 필요 없어 넣지 않는다 (#106).
  trade · category는 적재가 지식 자료를 알아보는 열이라 둔다
- 조각에 pdf_page(원본 파일의 쪽 번호 목록)가 있으면 그것을, 없으면 page(쪽 번호 목록)를 그대로 page 열에 쓴다.
  둘 다 없으면 page는 1, page_known은 false (page 열이 1 이상을 요구해서)
- source_sha256은 docs[문서]에 sha256(원본 파일의 SHA-256)이 있으면 그 값, 없으면 입력 JSON 파일의 SHA-256.
  팀 전처리 CSV는 원본 파일 하나마다 그 파일의 해시를 쓴다. 웹 자료를 묶은 상담 자료처럼 원본이 파일 하나가 아니면 JSON 해시를 쓴다
"""

import argparse
import csv
import hashlib
import json
from pathlib import Path

TEAM_COLUMNS = [
    "id", "trade", "category", "content", "source", "source_org", "source_url", "section", "page",
    "source_type", "source_sha256", "effective_date",
]  # fmt: skip
EXTRA = ["ref", "doc", "trades", "hints", "rel", "doc_date", "page_known"]


def rows(data: dict, sha: str) -> list[dict[str, str]]:
    out = []
    for c in data["chunks"]:
        d = data["docs"].get(c["doc"]) or {}
        trades = ";".join(c.get("trades") or [])
        pages = [int(p) for p in c.get("pdf_page") or c.get("page") or []]
        out.append(
            {
                "id": c.get("id") or c["k"],
                "trade": trades,
                "category": ";".join(c.get("topics") or []),
                "content": c["text"],
                "source": d.get("title") or "",
                "source_org": d.get("pub") or "",
                "source_url": d.get("url") or "",
                "section": c.get("sec") or "",
                "page": ";".join(map(str, pages)) or "1",
                "source_type": d.get("kind") or "",
                "source_sha256": d.get("sha256") or sha,
                "effective_date": "",
                "ref": c["k"],
                "doc": c["doc"],
                "trades": trades,
                "hints": json.dumps(c.get("hints") or [], ensure_ascii=False),
                "rel": d.get("rel") or "",
                "doc_date": d.get("date") or "",
                "page_known": "true" if pages else "false",
            }
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="상담 지식 JSON → 팀 전처리 CSV")
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    a = ap.parse_args()
    raw = a.src.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    out = rows(data, hashlib.sha256(raw).hexdigest())
    a.out.parent.mkdir(parents=True, exist_ok=True)
    with a.out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TEAM_COLUMNS + EXTRA, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    print(f"{a.out.name}: {len(out)}행")


if __name__ == "__main__":
    main()
