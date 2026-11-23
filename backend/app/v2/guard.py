"""AI 답 출력 검사 (화면 guard.ts를 서버로 옮긴 것). 고객에게 보내기 전에 문장마다 본다.

- 계산 결과 · 자료 · 고객이 쓴 글에 없는 숫자가 든 문장은 뺀다.
- 공사 기간(일 · 주 · 개월)은 계산 엔진 결과에 있는 숫자만 허용한다. 하루 · 이틀 · 일주일 · 한 달도 숫자로 읽는다.
- 한글로 쓴 금액 · 면적, 쓰면 안 되는 표현이 든 문장도 뺀다.
- 전화번호 · 동호수는 가린다.
"""

import re
import unicodedata
from dataclasses import dataclass, field

NUM = re.compile(
    r"(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*"
    r"(만\s*원|천\s*원|억\s*원|억|만|원|%|퍼센트|㎡|m²|평|일|개월|개|롤|cm|mm|m|배|시간|주|층|장|짝|명|인|품)?",
    re.ASCII,
)
COUNT_WORDS = re.compile(r"^\s*(가지|번|단계|번째|곳|군데|가지씩)")
# 삼십만 원 · 수백만 원, 그리고 십 · 백 · 천 없는 오만 원 · 만 원 · 수만 원 · 일억 원.
# 뒤쪽은 앞 글자가 한글이면 조사("벽지만 원하는"), 숫자면 숫자 금액("336만 원")이라 뺀다.
# '원래' · '원하'는 금액이 아니다("오늘은 이만 원래대로")
HANGUL_MONEY = re.compile(
    r"(?:[일이삼사오육칠팔구]?[십백천])+\s*(?:만|억)?\s*원"
    r"|(?<![가-힣\d.,])(?<!\d\s)[수몇일이삼사오육칠팔구]?[만억]\s*원(?![래하])"
)
# 고유어 기간: 숫자 기간과 같게 계산 결과 · 자료에 있어야 통과("이틀" = 2일, "한 달" = 1개월)
NATIVE_DAYS = {
    "하루": 1,
    "이틀": 2,
    "사흘": 3,
    "나흘": 4,
    "닷새": 5,
    "엿새": 6,
    "열흘": 10,
    "보름": 15,
}
NATIVE_COUNT = {"한": 1, "두": 2, "세": 3, "석": 3, "네": 4, "넉": 4}
# 한자어 수 + 일 · 개월(삼일 · 사 일 · 육 개월. '사주'와 헷갈려 주는 뺀다). '이 일'(this work) · '오일'(oil)과 헷갈리지 않게
# 2는 빼고, 뒤에 기간 말(이면 · 정도 · 걸 · 만에 …)이 올 때만 본다
SINO = {"삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9, "십": 10}
PERIOD_AFTER = r"(?=\s?(?:이면|정도|걸|만에|동안|간|쯤|째|안에|내|이요|이에요|예요|$|[.,!?~]))"
NATIVE_PERIOD = re.compile(
    r"(?<![가-힣])(?:(" + "|".join(NATIVE_DAYS) + r"|일주일|반나절" + PERIOD_AFTER + r")"
    r"|(한|두|세|석|네|넉)\s?(?:달(?![러라려리])|주일|주간|주(?=\s|$|[.,!?~]|동안|정도|이면|쯤|만에|째))"
    r"|(십[일이삼사오육칠팔구]?|[" + "".join(SINO) + r"])\s?(일|개월)" + PERIOD_AFTER + r")"
    r"(\s?반(?=\s|$|[.,!?~]|이면|정도|쯤|걸|만에|동안))?"  # 이틀 반 · 한 달 반
    # 기간이 아니라 단위 · 빈도 · 때로 쓴 말은 뺀다: 하루 시공량 · 하루 8시간 · 하루 중 · 하루라도 · 하루하루
    # '에'가 붙은 말(하루에 · 사흘에)은 문장에 완료 · 소요 표현이 있는지로 따로 본다(_rate)
    r"(?!\s?(?:의|중|단위|(?:시공|작업)량|노임|인건비|\d|한\s|라도|하루|빨리))"
)
# '사흘에 (도배를) 끝내요' · '나흘에 걸쳐'처럼 '에' 뒤 문장에 이 말이 있으면 빈도가 아니라 공사 기간
DONE = re.compile(r"끝|마무리|마치|마쳐|마칠|완료|완성|가능|걸쳐|걸려|걸리|걸립|해결|처리|소요")
HANGUL_AREA = re.compile(r"(?:[일이삼사오육칠팔구]?[십백천])+\s*평")
PHONE = re.compile(r"01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}")
UNIT_NO = re.compile(r"\d{1,4}\s*동\s*\d{1,4}\s*호")
MULT = {"만원": 1e4, "만": 1e4, "천원": 1e3, "억원": 1e8, "억": 1e8}
BANNED = re.compile(
    r"사기꾼|바가지|양아치|업체가\s*속이|법적으로\s*(?:아무\s*)?문제(?:가)?\s*없|무조건\s*(?:승소|이겨)"
    r"|하자가\s*확실히\s*아니|(?:이|그)\s*금액으로\s*확정|금액을\s*보장|100\s*%\s*(?:보장|안전)"
)
PERIOD_UNITS = frozenset({"일", "주", "개월"})
RANGE_TO_PERIOD = re.compile(r"^\s*[~\-–]\s*\d+(?:\.\d+)?\s*(일|주|개월)")  # 3~5일의 3
DATE_BEFORE = re.compile(r"\d{1,2}\s*월\s*$")  # 12월 3일: 기간이 아니라 날짜
SENT = re.compile(r"(?<=[.!?。요])\s+")
CITE_ONLY = re.compile(r"^\[K\d+\]")


@dataclass
class Checked:
    text: str
    dropped: list[str] = field(default_factory=list)  # 뺀 이유 (문장 원문은 남기지 않음)


def _val(raw: str, unit: str | None) -> float | None:
    try:
        v = float(raw.replace(",", ""))
    except ValueError:
        return None
    return v * MULT.get((unit or "").replace(" ", ""), 1)


def _sino(word: str) -> int:
    """삼 3 · 십 10 · 십오 15."""
    if word.startswith("십"):
        return 10 + ("일이삼사오육칠팔구".find(word[1:]) + 1 if word[1:] else 0)
    return SINO[word]


def _native_parts(m: re.Match) -> tuple[float, float]:
    """고유어 · 한자어 기간을 (수, 그 단위의 일 수)로: 이틀 (2, 1) · 세 주 (3, 7) · 한 달 반 (1.5, 30)."""
    word = m.group(1)
    if word:
        n, per = {"일주일": (1.0, 7.0), "반나절": (0.5, 1.0)}.get(
            word, (float(NATIVE_DAYS.get(word, 0)), 1.0)
        )
    elif m.group(2):
        n, per = float(NATIVE_COUNT[m.group(2)]), (30.0 if "달" in m.group(0) else 7.0)
    else:
        n, per = float(_sino(m.group(3))), DAYS_PER[m.group(4)]
    return (n + 0.5 if m.group(5) else n), per


def _native(m: re.Match) -> float:
    """자료와 비교하는 수: 일주일 = 1 ("1주일"과 같게), 이틀 반 = 2.5."""
    return _native_parts(m)[0]


def _native_days(m: re.Match) -> float:
    """계산 결과와 비교하는 일 수: 하루 1 · 일주일 7 · 세 주 21 · 한 달 30 · 사일 4."""
    n, per = _native_parts(m)
    return round(n * per, 4)


# '에' 바로 뒤 횟수(한 번 · 2회 · 한 공정씩)면 뒤에 '완료'가 있어도 빈도다("한 달에 한 번 점검하고 공사를 완료합니다")
FREQ = re.compile(r"^\s?에\s?(?:(?:한|두|세|네|몇|\d+)\s?(?:번|회|차례)|[^.,!?]{0,8}?씩)")
# 숫자 기간 뒤 '반'(2일 반 = 2.5일)
HALF = re.compile(r"^\s?반(?=\s|$|[.,!?~]|이면|정도|쯤|걸|만에|동안)")


def _rate(sentence: str, m: re.Match) -> bool:
    """'하루에 한 공정씩' · '한 달에 한 번'처럼 '에'가 붙은 빈도 · 단위 표현이면 True."""
    rest = sentence[m.end() :]
    if FREQ.match(rest):
        return True
    return bool(re.match(r"\s?에", rest)) and not DONE.search(rest)


DAYS_PER = {"일": 1.0, "주": 7.0, "개월": 30.0}
# 계산 결과의 단위 없는 숫자는 기간 칸(work_days: 2 · weeks: 1)일 때만 기간으로 본다.
# 날짜(2026-12-03) · 인원(crew: 5) · 품(man_days) 같은 숫자는 기간 근거가 아니다
KEY_BEFORE = re.compile(r"\"?([A-Za-z_가-힣]+)\"?\s*[:=]\s*$")


def _key_days(key: str) -> float | None:
    """기간 칸 이름이면 그 칸 숫자 1의 일 수(half_days 0.5 · weeks 7), 아니면 None."""
    k = key.lower()
    if k.startswith("man_") or k.endswith("_off"):
        return None
    if k.endswith("half_days"):
        return 0.5
    if re.search(r"(?:^|_)days?$", k) or re.search(r"기간|일수|_일$", k):  # 기간_일 · 공사기간
        return 1.0
    if re.search(r"(?:^|_)weeks?$", k):
        return 7.0
    if re.search(r"(?:^|_)months?$", k):
        return 30.0
    return None


def period_days(text: str) -> set[float]:
    """계산 결과에 나온 기간을 일 수로. 단위 없는 숫자는 기간 칸(work_days: 2)일 때만 본다.

    '1일'과 '1주' · '1개월'을 구분한다: 계산 결과가 1일이면 일주일 · 한 달은 통과하지 않는다.
    날짜(2026-12-03의 3) · 인원(5명, crew: 5)은 기간 근거가 아니다.
    """
    text = unicodedata.normalize("NFKC", text or "")
    out: set[float] = set()
    for m in NUM.finditer(text):
        unit = m.group(2)
        v = _val(m.group(1), unit)
        if v is None:
            continue
        if unit is None:
            key = KEY_BEFORE.search(text[max(0, m.start() - 40) : m.start()])
            per = _key_days(key.group(1)) if key else None
            if per is not None:
                out.add(round(v * per, 4))
            continue
        if unit not in DAYS_PER or (unit == "일" and DATE_BEFORE.search(text[: m.start()])):
            continue
        if HALF.match(text[m.end() :]):
            v += 0.5
        out.add(round(v * DAYS_PER[unit], 4))
    out.update(_native_days(m) for m in NATIVE_PERIOD.finditer(text))
    return out


def numbers(text: str) -> set[float]:
    """글에 나온 숫자. 10만 이상은 만 원 단위 반올림 · 버림 값도 허용한다 (3,364,291원 → 336만 원).

    10만 아래는 반올림하지 않는다: 1.6만 원이 2만 원으로 통과하지 않게.
    """
    text = unicodedata.normalize("NFKC", text or "")
    out: set[float] = set()
    for m in NUM.finditer(text):
        v = _val(m.group(1), m.group(2))
        if v is None:
            continue
        out.add(round(v, 4))
        if m.group(2) in PERIOD_UNITS and HALF.match(text[m.end() :]):
            out.add(round(v + 0.5, 4))  # 자료의 '2일 반'은 2.5
        if v >= 100_000:
            out.add(round(v / 1e4) * 1e4)
            out.add((v // 1e4) * 1e4)
    out.update(_native(m) for m in NATIVE_PERIOD.finditer(text))
    return out


def mask(text: str) -> str:
    return UNIT_NO.sub("(동호수 가림)", PHONE.sub("(번호 가림)", text or ""))


def _small_count(v: float, unit: str | None, rest: str) -> bool:
    """'3가지', '2번째'처럼 단위 없는 작은 수는 센 수라서 허용한다."""
    if unit or v > 10 or not float(v).is_integer():
        return False
    return bool(COUNT_WORDS.match(rest)) or not rest.strip() or rest[0] in ".)"


def _period_unit(sentence: str, m: re.Match) -> str | None:
    """기간이면 단위(일 · 주 · 개월), 아니면 None. '3~5일'의 3은 뒤 단위를 쓴다."""
    unit = m.group(2)
    if unit in PERIOD_UNITS:
        if unit == "일" and DATE_BEFORE.search(sentence[: m.start()]):
            return None
        return unit
    r = RANGE_TO_PERIOD.match(sentence[m.end() :]) if unit is None else None
    return r.group(1) if r else None


def _bad_number(
    sentence: str, allowed: set[float], periods: set[float] | None = None
) -> str | None:
    for m in NUM.finditer(sentence):
        v = _val(m.group(1), m.group(2))
        if v is None:
            continue
        rest = sentence[m.end() :]
        if m.group(2) in PERIOD_UNITS and HALF.match(rest):
            v += 0.5  # 2일 반 = 2.5일
        # '1개월에 1회'처럼 빈도로 쓴 기간 숫자는 기간이 아니라 일반 숫자로 본다
        unit = _period_unit(sentence, m) if periods is not None and not FREQ.match(rest) else None
        if periods is not None and unit:
            if round(v * DAYS_PER[unit], 4) not in periods:
                return m.group(0).strip()  # 기간은 계산 결과에 있는 기간만(단위까지)
            continue
        if round(v, 4) in allowed:
            continue
        if _small_count(v, m.group(2), sentence[m.end() :]):
            continue
        return m.group(0).strip()
    for m in NATIVE_PERIOD.finditer(sentence):
        if _rate(sentence, m):
            continue
        ok = _native(m) in allowed if periods is None else _native_days(m) in periods
        if not ok:
            return m.group(0).strip()
    return None


def _why(s: str, allowed: set[float], periods: set[float] | None = None) -> str | None:
    s = unicodedata.normalize("NFKC", s)  # 전각 숫자(３일 · ３０만 원)도 숫자로 본다
    if HANGUL_MONEY.search(s) or HANGUL_AREA.search(s):
        return "한글로 쓴 금액 · 면적"
    bad = _bad_number(s, allowed, periods)
    if bad:
        return f"계산 결과 · 자료에 없는 숫자({bad})"
    if BANNED.search(s):
        return "쓰면 안 되는 표현"
    return None


def check(text: str, allowed_text: str, calc_text: str | None = None) -> Checked:
    """text: AI 글, allowed_text: 계산 결과 · 자료 · 고객 글을 이은 글. 줄 바꿈은 그대로 둔다.

    calc_text를 주면 공사 기간(일 · 주 · 개월) 숫자는 그 글(계산 엔진 결과)에 있어야만 통과한다.
    """
    allowed = numbers(allowed_text)
    periods = None if calc_text is None else period_days(calc_text)
    out_lines: list[str] = []
    dropped: list[str] = []
    for line in mask(text).split("\n"):
        if not line.strip():
            out_lines.append("")
            continue
        parts: list[str] = []
        for s in (x.strip() for x in SENT.split(line)):
            if not s:
                continue
            if CITE_ONLY.match(s) and parts:
                parts[-1] += " " + s  # 근거 표시는 앞 문장에 붙인다
            else:
                parts.append(s)
        kept = []
        for s in parts:
            why = _why(s, allowed, periods)
            if why:
                dropped.append(why)
            else:
                kept.append(s)
        if kept:
            out_lines.append(" ".join(kept))
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(out_lines)).strip()
    return Checked(text=body, dropped=dropped)
