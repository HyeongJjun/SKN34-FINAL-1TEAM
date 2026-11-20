"""쉬운 용어 사전: 처음 고객이 모를 만한 공사 용어의 쉬운 뜻 (ADR agent-08 2-2절). DB · HTTP를 모르는 순수 함수.

- 파일: `app/agent/glossary.jsonl`(한 줄에 용어 하나). 뜻은 근거 조각(`K…`) · 믿집 화면 글(`doc:…`) 안의 내용만 써요.
- 쓰는 곳(후속): 답 쓰기 근거의 '용어 풀이', 화면 용어 밑줄, 풀리지 않은 용어 세기.
- 사전은 실행 중에 바뀌지 않아요. 고치면 PR로만 들어가요.
"""

import json
import re
from datetime import date
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.knowledge import bm25
from app.knowledge.cards import DOC_REFS

PATH = Path(__file__).resolve().parents[1] / "agent" / "glossary.jsonl"
SENTENCE_END = re.compile(r"[.!?](?=\s|$)")
HANGUL = re.compile(r"[가-힣]")
# 한 글자 용어 뒤에 붙으면 다른 낱말이 되는 글자('품질' · '품목' · '품절' · '품번'의 '품'은 용어가 아님)
ONE_LETTER_WORD_TAIL = set("질목절번")


class Verified(BaseModel):
    by: str
    at: date
    status: Literal["author_checked", "ok", "fix", "fail"]


class Term(BaseModel):
    term: str = Field(min_length=1, max_length=20)
    easy: str = Field(min_length=8, max_length=120)  # 쉬운 뜻 한 문장(해요체)
    aka: list[str] = []  # 업체 · 현장에서 부르는 다른 이름
    cites: list[str] = Field(min_length=1, max_length=4)
    trade: str  # 묶음(공통 · 도배 · 목공 …), 화면 · 평가에서 거를 때만 씀
    verified: Verified
    review_by: date

    @field_validator("cites")
    @classmethod
    def _refs(cls, v: list[str]) -> list[str]:
        for r in v:
            if not (bm25.REF.fullmatch(r) or r in DOC_REFS):
                raise ValueError(f"근거 번호 모양이 아니에요: {r}")
        return v

    @field_validator("easy")
    @classmethod
    def _one_sentence(cls, v: str) -> str:
        if len(SENTENCE_END.findall(v)) != 1 or not v.endswith("요."):
            raise ValueError("쉬운 뜻은 해요체 한 문장이어야 해요")
        return v

    def names(self) -> list[str]:
        return [self.term, *self.aka]


@cache
def load(path: Path = PATH) -> tuple[Term, ...]:
    with path.open(encoding="utf-8") as f:
        return tuple(Term.model_validate(json.loads(line)) for line in f if line.strip())


def terms_in(text: str, terms: tuple[Term, ...] | None = None) -> list[Term]:
    """글에 나오는 사전 용어를 처음 나온 순서로. 긴 이름을 먼저 맞춰 '마이너스 몰딩' 안의 '몰딩'은 따로 세지 않아요.

    한 글자 이름(예: 품)은 앞 글자가 한글이 아니고, 뒤가 '질 · 목 · 절 · 번'이 아닐 때만 맞춰요('제품' · '품질' · '품목'의 '품'은 아님).
    """
    terms = load() if terms is None else terms
    pairs = sorted(((n, t) for t in terms for n in t.names()), key=lambda p: -len(p[0]))
    taken: list[tuple[int, int]] = []
    found: list[tuple[int, Term]] = []
    for name, t in pairs:
        start = 0
        while (i := text.find(name, start)) >= 0:
            start = i + 1
            j = i + len(name)
            if len(name) == 1 and (
                (i > 0 and HANGUL.match(text[i - 1])) or text[j : j + 1] in ONE_LETTER_WORD_TAIL
            ):
                continue
            if any(a < j and i < b for a, b in taken):
                continue
            taken.append((i, j))
            found.append((i, t))
    seen: set[str] = set()
    out: list[Term] = []
    for _, t in sorted(found, key=lambda p: p[0]):
        if t.term not in seen:
            seen.add(t.term)
            out.append(t)
    return out
