"""AI 칸 사진 읽기 (#181 2단계, docs/v3/adr/agent-09-photo.md). DB · HTTP · LLM SDK를 모른다.

- 사진을 읽는 모델은 문장을 쓰지 않는다. 정해 둔 목록에서 '어디 · 무엇'만 고른다(PhotoSeen).
  사람 · 주소 · 번호 · 송장 같은 사진 속 글자와 사람은 스키마에 받을 칸이 없어서 답으로 나올 길이 없다.
- 고른 증상은 지금 AI 칸이 자료로 답하는 질문(QUESTION)으로 바꿔 기존 한 턴(run_turn)에 넘긴다.
  자료가 없는 증상은 질문을 바꾸지 않고, 사진에서 본 것과 '실측 때 업체에 확인'만 알린다.
- 금액 · 기간 · 하자 판정은 하지 않는다(숫자는 계산 엔진, 판정은 믿집이 하지 않음).
"""

import re
from typing import Literal

from pydantic import BaseModel, Field

PROMPT_VERSION = "photo_v1"
MAX_PHOTOS = 3  # 한 번에 붙일 수 있는 사진 수
PER_DAY = 20  # 사용자별 하루 사진 수

Symptom = Literal["mold", "condensation", "lifting", "seam_gap", "peeling", "hole_crack", "stain"]
Where = Literal["wall", "ceiling", "window", "corner", "floor_edge", "unknown"]

SYMPTOM_KO: dict[str, str] = {
    "mold": "곰팡이",
    "condensation": "결로(물방울 · 물기)",
    "lifting": "벽지 들뜸",
    "seam_gap": "벽지 이음매 벌어짐",
    "peeling": "벽지 벗겨짐 · 찢어짐",
    "hole_crack": "벽의 구멍 · 금",
    "stain": "얼룩 · 물자국",
}
WHERE_KO: dict[str, str] = {
    "wall": "벽",
    "ceiling": "천장",
    "window": "창 둘레",
    "corner": "모서리",
    "floor_edge": "바닥 가장자리",
    "unknown": "",
}
# 증상 → 지금 AI 칸이 자료로 답하는 질문(2026-11-24 시드 고객으로 확인). 없는 증상은 질문을 바꾸지 않는다
QUESTION: dict[str, str] = {
    "mold": "도배 벽지에 곰팡이가 폈어요",
    "lifting": "벽지가 들뜨면 어떻게 해요?",
    "seam_gap": "벽지 이음매가 벌어졌어요",
    "hole_crack": "벽에 구멍이 있으면 도배 전에 어떻게 해요?",
}

NOT_READ = "지금은 재재가 사진을 읽지 못해요. 사진은 업체와 채팅에서 보내 주세요."
FAILED = "사진을 읽지 못했어요. 밝은 곳에서 다시 찍어 올리거나 글로 물어봐 주세요."
NOTHING = "사진에서 도배와 관련해 눈에 띄는 문제는 찾지 못했어요. 걱정되는 곳을 가까이에서 다시 찍어 주세요."
NOT_HOME = "집 안 벽 · 천장 사진이 아닌 것 같아요. 도배할 곳을 찍어 올려 주세요."
ONLY_SEEN = "사진만으로는 정확하지 않아요. 실측 때 업체가 직접 보고 확인해요."
ASK_VENDOR = "실측 때 이 사진을 업체에 보여 주고, 바탕 손보기가 견적에 들어가는지 물어보세요."
PERSON = "사진에 사람이나 글자(주소 · 번호)가 보여요. 다음에는 가리고 올려 주세요."


class PhotoSeen(BaseModel):
    """사진을 읽는 모델이 채우는 칸. 문장 칸이 없다."""

    indoor_surface: bool = Field(default=True, description="집 안 벽 · 천장 · 창 둘레 사진인지")
    symptoms: list[Symptom] = Field(default=[], max_length=4)
    where: Where = "unknown"
    private: bool = Field(
        default=False, description="사람 얼굴 · 주소 · 번호 · 송장 글자가 보이는지"
    )


# 사진만 올리고 따로 묻지 않은 말("이 사진 좀 봐 주세요")인지: 짧고 공종 낱말이 없다
_GENERIC = re.compile(r"사진|봐\s*주|봐줘|이거|이게|어때|뭐예요|뭔가요|괜찮")


def is_generic(text: str) -> bool:
    t = text.strip()
    return len(t) <= 30 and bool(_GENERIC.search(t))


def lines(seen: PhotoSeen | None, *, read: bool) -> list[str]:
    """답 위에 보일 '사진에서 본 것' 줄. read=False는 무료 모드(읽지 않음), seen=None은 읽기 실패."""
    if not read:
        return [NOT_READ]
    if seen is None:
        return [FAILED]
    if not seen.indoor_surface:
        return [NOT_HOME]
    out: list[str] = []
    names = [SYMPTOM_KO[x] for x in dict.fromkeys(seen.symptoms)]
    if names:
        place = WHERE_KO[seen.where]
        out.append(
            f"사진에서 {place + '에 ' if place else ''}{' · '.join(names)}로 보이는 곳이 있어요."
        )
        out.append(ONLY_SEEN)
        out.append(ASK_VENDOR)
    else:
        out.append(NOTHING)
    if seen.private:
        out.append(PERSON)
    return out


def question_for(text: str, seen: PhotoSeen | None) -> str:
    """이번 턴에 답할 질문. 고객이 따로 물었으면 그 말, 사진만 올렸으면 증상에 맞는 질문."""
    if seen is None or not seen.indoor_surface or not is_generic(text):
        return text
    for x in seen.symptoms:
        if x in QUESTION:
            return QUESTION[x]
    return text
