"""미리 만든 해요체 요약(summary_haeyo). 조각 문장을 '-다' 원문 그대로 옮기지 않고 이 요약을 보인다.

- 파일: `app/knowledge/summaries.jsonl` 한 줄 = {ref, sha, summary: [문장 1~3개], by, at}. 운영 이미지가 `app`만 복사해서 여기에 둔다.
- 요약은 그 조각 글만으로 쓰고 숫자 · 단위는 원문 그대로다(검사: evaluation/v3/summaries_check.py).
- sha(조각 글 sha256 앞 16자)가 지금 조각과 다르면 쓰지 않는다(조각이 바뀌면 요약을 다시 쓴다).
"""

import hashlib
import json
from functools import cache
from pathlib import Path

PATH = Path(__file__).resolve().parent / "summaries.jsonl"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


@cache
def _load() -> dict[str, tuple[str, tuple[str, ...]]]:
    if not PATH.exists():
        return {}
    out: dict[str, tuple[str, tuple[str, ...]]] = {}
    for line in PATH.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            out[r["ref"]] = (r["sha"], tuple(r["summary"]))
    return out


def of(ref: str, text: str) -> tuple[str, ...]:
    """그 조각의 해요체 요약. 없거나 조각 글이 바뀌었으면 빈 튜플."""
    got = _load().get(ref)
    if got is None or got[0] != sha(text):
        return ()
    return got[1]


def count() -> int:
    return len(_load())
