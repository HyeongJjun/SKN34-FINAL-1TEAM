"""v3 공종 낱말표(실험용, 12공종). 제품 코드에 옮기기 전에 평가로 고친다.

- 코드 이름은 영어, 화면 말은 TRADE_KO.
- 한 문장에 여러 공종이 걸리면 처음 나온 순서대로 모두 돌려준다(오케스트레이터가 나눈다).
- 도배 · 목공 낱말은 지금 서버 낱말(`app/knowledge/bm25.py` TRADE_WORDS)을 그대로 쓰고 일상어만 더했다.
"""

import re

TRADE_KO = {
    "dobae": "도배", "mokgong": "목공", "floor": "바닥", "tile": "타일", "bath": "욕실",
    "kitchen": "주방", "paint": "도장", "film": "필름", "electric": "전기/조명",
    "window": "창호", "demolition": "철거", "plumbing": "설비",
}  # fmt: skip

WORDS = {
    "dobae": r"도배|벽지|초배|정배|합지|실크|도배풀|풀자국|퍼티|빠데",
    "mokgong": (
        r"목공|목수|목재|몰딩|걸레받이|굽도리|문틀|문선|(?<!사전)(?<!실측 )방문(?!판매)|문짝|경첩|석고|"
        r"도어(?!락|록)|다루끼|각재|가벽|칸막이|천장틀|평탄화|단내림|커튼박스|단열|웨인스코팅|템바보드|분리대"
    ),
    "floor": r"바닥재|마루|장판|데코타일|폴리싱|바닥(?!\s*타일)",
    "tile": r"타일|줄눈|메지|포세린",
    "bath": r"욕실|화장실|욕조|샤워|세면대|변기|비데|수전|방수",
    "kitchen": r"주방|부엌|싱크대|씽크대|상판|상부장|하부장|후드|인덕션|아일랜드 식탁",
    "paint": r"도장|페인트|탄성코트|벽칠|도색|칠(?:하|을|해)",
    "film": r"필름|시트지|랩핑",
    "electric": r"전기|조명|콘센트|스위치|누전|차단기|LED|등기구|매입등|다운라이트|배선",
    "window": r"창호|샷시|섀시|새시|창문|창틀|방충망|이중창|시스템창|유리창",
    "demolition": r"철거|뜯어|폐기물|원상복구|깨고|부수",
    "plumbing": r"설비|배관|보일러|난방|분배기|수도|누수|하수구|배수|급수|에어컨",
}
COMPILED = {k: re.compile(v, re.IGNORECASE) for k, v in WORDS.items()}


def trades_v3(text: str) -> list[str]:
    """걸린 공종을 문장에 처음 나온 순서로."""
    hits = []
    for k, pat in COMPILED.items():
        m = pat.search(text or "")
        if m:
            hits.append((m.start(), k))
    return [k for _, k in sorted(hits)]


# 지금 의도 세트의 다른 공종 문장(kind=other_trade) 20개에 에이전트 설계 담당이 붙인 정답(맞다고 볼 공종들)
OTHER_TRADE_GOLD = {
    "부엌 씽크대 통째로 바꿀라고요": {"kitchen"},
    "마루 긁힌 데 보수 되나여": {"floor"},
    "보일러 교체 견적도 받을 수 있나요": {"plumbing"},
    "안방 콘센트 위치 옮길 수 있나요": {"electric"},
    "현관 바닥 타일에 금이 갔어요": {"tile", "floor"},
    "스위치랑 콘센트 커버만 교체해 주시나요": {"electric"},
    "거실 바닥을 강마루로 바꾸려고요": {"floor"},
    "장판 들떠서 새로 깔고 싶어": {"floor"},
    "샷시 교체도 해줘요?": {"window"},
    "에어컨 매립 배관 공사도 같이 하나요": {"plumbing"},
    "욕조 철거하고 샤워부스로 바꾸고 싶어요": {"bath", "demolition"},
    "화장실 타일 싹 다 깨고 새로 하고싶음": {"bath", "tile"},
    "주방 벽 타일 위에 덧방하려고 하는데요": {"tile", "kitchen"},
    "방충망 새로 달고 싶어요": {"window"},
    "변기 밑에서 물이 계속 새요": {"bath", "plumbing"},
    "베란다 탄성코트도 해주시나요": {"paint"},
    "창틀 실리콘이 다 삭아서 시커매졌어요": {"window"},
    "세면대 수전 바꿔줄 수 있어여": {"bath"},
    "거실 조명을 전부 LED로 바꾸고 싶은데": {"electric"},
    "누전차단기가 자꾸 툭툭 내려가요": {"electric"},
}
