"""고객 수준: 첫 화면에서 고른 목적(스스로 말한 수준)과 이번 질문의 낱말로 이번 턴의 말하기 깊이를 정한다.

LLM 없이 코드로 정해 같은 상황이면 같은 깊이가 나온다. 수준은 주제마다 오르내린다:
경험자도 뜻을 물으면 이번 턴만 '처음'으로, 처음 고객도 업계 말을 쓰면 이번 턴만 한 단계 올린다.
"""

import re
from typing import Literal

Level = Literal["new", "looking", "experienced"]
KO = {"new": "처음", "looking": "알아보는 중", "experienced": "견적 받아 봄"}

# 견적서 · 현장에서 쓰는 업계 말 (일상어가 아닌 것만)
TRADE_WORDS = re.compile(
    r"품셈|(?<![가-힣])품(?![질목])|일식|한\s*식|덧방|평당|초배|정배|부직포|공과잡비|하자\s*보수|하자\s*이행|"
    r"계약금|중도금|잔금|도급|직영|턴키|반셀프|마이너스\s*몰딩|갈매기|문선|양중"
)
# 뜻 · 순서를 묻는 질문. 갈래를 공백으로 시작하지 않는다 (공백이 긴 글에서 n²로 느려짐, CodeQL ReDoS)
MEANING_Q = re.compile(r"뭐(?:예요|에요|야|죠)|무슨\s*뜻|뜻이|뭘\s*먼저|어디서부터|처음이")


def level_of(said: Level | None, question: str) -> tuple[Level, str]:
    """(이번 턴 수준, 근거 글)"""
    words = len({m.group(0) for m in TRADE_WORDS.finditer(question)})
    meaning = bool(MEANING_Q.search(question))
    base: Level = said or "looking"
    why = f"첫 화면에서 고른 목적: {KO[said]}" if said else "스스로 말한 수준 없음"
    if meaning and words <= 1:
        return "new", f"{why}, 이번 질문은 뜻 · 순서를 물음"
    if words >= 2 and base != "experienced":
        return "experienced", f"{why}, 이번 질문에 업계 말 {words}개"
    if words == 1 and base == "new":
        return "looking", f"{why}, 이번 질문에 업계 말 1개"
    return base, why


def level_text(said: Level | None, question: str) -> str:
    lv, why = level_of(said, question)
    return f"## 고객 수준\n이번 답의 수준: {KO[lv]} (근거: {why})"
