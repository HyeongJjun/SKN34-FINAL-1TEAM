"""카드가 없을 때: 검색 위 조각에서 질문과 많이 겹치는 문장 1~2개를 골라 '자료에는 이렇게 나와요'로 보인다.

- 화면 표시 허락(display): 법령 · 고시 · 시방서 · 공공 자료는 그대로(full), 제조사 · 협회 · 경험담은 짧게(short),
  시공 안내서(책)는 보이지 않는다(none, L23 — 허락 전까지).
- 미리 만든 해요체 요약(summaries.jsonl)이 있는 조각은 원문(-다) 대신 그 요약을 보인다. 없으면 원문을 따옴표로.
- 문장을 고르는 점수: 흔한 말을 뺀 질문 낱말(글자 두 개 묶음) 중 문장에 있는 비율.
"""

import re
from dataclasses import dataclass

from app.knowledge import bm25, summaries
from app.knowledge.suggest import COMMON

DISPLAY: dict[str, str] = {
    "law": "full", "gov_notice": "full", "gov_guide": "full", "gov_qa": "full", "kcs": "full",
    "standard_contract": "full", "consumer_agency": "full", "official": "full",
    "public_data": "full", "gov": "full", "guide": "full",
    "maker": "short", "maker_guide": "short", "industry": "short", "news": "short",
    "experience": "short", "platform": "short", "blog": "short", "community": "short",
    "book": "none",
    "pumsem": "none",  # 품셈(인력 · 장비 품) 표는 고객 답 문장으로 맞지 않아서 뽑지 않는다
}  # fmt: skip
MAX_LEN = {"full": 160, "short": 80}
MIN_SCORE = 0.5  # 질문 낱말이 이 비율 이상 들어 있는 문장만. 개선 1회차: dev 판정(핵심 놓침)으로 0.3 → 0.5(b5.md)
_SENT = re.compile(r"(?<=[.!?。])\s+|(?<=다)\.\s*|(?<=요)\.\s*|\n+|\s*[①-⑳]\s*")


@dataclass(frozen=True)
class Quote:
    ref: str
    text: str
    title: str
    kind: str
    kind_ko: str
    publisher: str
    score: float
    summary: tuple[str, ...] = ()  # 미리 만든 해요체 요약(있으면 원문 대신 보인다)


def display_of(kind: str) -> str:
    return DISPLAY.get(kind, "short")


def _words(text: str) -> set[str]:
    return {g for g in bm25.grams(text) if len(g) == 2 and g not in COMMON}


def sentences(text: str) -> list[str]:
    out = []
    for s in _SENT.split(text or ""):
        s = s.strip(" ·-")
        if len(s) >= 12:
            out.append(s)
    return out


def _cut(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    cut = s[:n]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > n // 2 else cut).rstrip(" ,·") + "…"


def pick(
    ix: bm25.Index, q: str, hits: list[bm25.Hit], *, k: int = 2, min_score: float = MIN_SCORE
) -> list[Quote]:
    """위 조각 6개 안에서 질문과 가장 맞는 문장을 조각마다 하나씩, 점수 순으로 k개."""
    qw = _words(q)
    if not qw:
        return []
    cand: list[Quote] = []
    for rank, h in enumerate(hits[:6]):
        item = ix.by_ref.get(h.ref)
        kind = item.doc.kind if item else ""
        disp = display_of(kind)
        if disp == "none":
            continue
        best: tuple[float, str] | None = None
        for s in sentences(h.text):
            sw = _words(s)
            if not sw:
                continue
            score = len(qw & sw) / len(qw) - 0.02 * rank
            if best is None or score > best[0]:
                best = (score, s)
        if best and best[0] >= min_score:
            cand.append(
                Quote(
                    ref=h.ref,
                    text=_cut(best[1], MAX_LEN[disp]),
                    title=h.title,
                    kind=kind,
                    kind_ko=h.source_type,
                    publisher=h.publisher,
                    score=round(best[0], 3),
                    summary=summaries.of(h.ref, item.chunk.text) if item else (),
                )
            )
    cand.sort(key=lambda x: -x.score)
    return cand[:k]
