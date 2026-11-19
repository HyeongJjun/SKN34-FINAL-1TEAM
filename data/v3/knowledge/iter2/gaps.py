"""지식 보강 2회차: 무료 모드 답이 '확인하지 못했어요'로 끝난 dev 질문을 주제로 묶고, 같은 유형 dev 질문 수를 세요.

- 빠진 질문: evaluation/v3/judge_packs/e3_c2_dev.jsonl + judge_results/A_e3_c2.jsonl · B_e3_c2.jsonl에서
  판정자 둘 중 하나라도 answered가 no/partial이고 답에 '확인하지 못했어요'가 든 것
- 같은 유형 dev 질문: 아래 DEV_SETS의 split == dev 줄만 봐요. 이름에 heldout · held_out이 든 파일은 열지 않아요.
- 주제 배정: 빠진 질문은 qid로 직접(GAPS), 같은 유형 질문은 주제마다 정한 낱말 규칙(KEYS)으로 세요(대략값).
출력: data/v3/knowledge/iter2/gaps.json · gaps.csv
실행: python -X utf8 data/v3/knowledge/iter2/gaps.py
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EV = ROOT / "evaluation"
OUT = Path(__file__).resolve().parent
PACK = EV / "v3" / "judge_packs" / "e3_c2_dev.jsonl"
KEY = EV / "v3" / "judge_packs" / "e3_c2_dev_key.jsonl"
JUDGES = [
    EV / "v3" / "judge_results" / "A_e3_c2.jsonl",
    EV / "v3" / "judge_results" / "B_e3_c2.jsonl",
]
DEV_SETS = [
    *sorted((ROOT / "data" / "v3" / "questions").glob("*.jsonl")),
    EV / "rag" / "questions.jsonl",
    EV / "rag" / "questions_300.jsonl",
    EV / "rag" / "questions_sigong.jsonl",
    EV / "v3" / "sets" / "multi.jsonl",
]
UNKNOWN = "확인하지 못했어요"

# 주제: (공종, 질문 유형, 이름, 빠진 질문 qid, 같은 유형 낱말 규칙)
TOPICS: dict[str, tuple[str, str, str, list[str], str]] = {
    "G01": ("common", "계약 · 분쟁", "업체 등록 · 자격 확인", ["xd046", "c16"],
            r"등록|면허|실내건축공사업|무등록|키스콘|KISCON|자격.*(업체|확인)|업체.*자격"),
    "G02": ("common", "계약 · 분쟁", "계약서에 적을 것(착공 · 준공 · 지체)", ["xc055"],
            r"계약서|착공|준공|지체상금|표준계약"),
    "G03": ("common", "계약 · 분쟁", "견적만 받고 계약 안 하기 · 계약 취소", ["xc041"],
            r"계약.*(안 해|취소|해지|해제|철회|파기)|청약철회|계약금.*(돌려|환불|반환)|견적.*(거절|안 하)"),
    "G04": ("common", "계약 · 분쟁", "피해 구제 · 분쟁 조정 창구", ["c20"],
            r"피해|분쟁|조정|소비자원|1372|구제|어디에.*(도움|신고|요청|말해)"),
    "G05": ("common", "하자 · 원인", "공사 뒤 하자 보수 기간", ["qv3-common-009"],
            r"하자.*(기간|몇 년|언제까지|지나|지난|개월|년)|담보책임|AS.*(기간|언제)|보수.*(기간|요구)"),
    "G06": ("common", "계약 · 분쟁", "하자보수 보증 · 보증보험", ["xd067"],
            r"보증보험|이행보증|하자보수보증|보증금|보증서|보증증권"),
    "G07": ("common", "가격", "부가세 · 영수증", ["xc010"],
            r"부가세|VAT|세금계산서|현금영수증|간이과세|카드.*(결제|수수료)"),
    "G08": ("dobae", "하자 · 원인", "고객이 산 자재의 하자 책임", ["xd102"],
            r"(제가|직접|내가|고객이|따로).*(산|사 온|구매|구입|준비한)|사급|자재.*책임"),
    "G09": ("common", "하자 · 원인", "신축 입주 전 하자 · 사전방문", ["xd095"],
            r"신축|입주 전|사전점검|사전방문|분양|시공사.*하자|건설사.*하자"),
    "G10": ("dobae", "하자 · 원인", "도배 하자 보수 뒤 재발 막기", ["qv3-dobae-020"],
            r"(도배|벽지).*(들뜸|들떠|곰팡이|얼룩|재발|다시|보수|터|울|주름|변색|이음)"),
    "G11": ("dobae", "해도 되나 · 판단", "페인트 · 타일 · 시트 위 도배(바탕)", ["xd009"],
            r"(페인트|칠한|타일|시트|필름|합판|석고|콘크리트|바탕).*(위에|위|바로).*(도배|벽지|붙)|벽지 위에|바탕"),
    "G12": ("dobae", "가격", "도배 인건비 · 품 계산", ["xd107"],
            r"일당|'품'|품으로|(?<![제상작부])품[이은을] |인건비|인부|몇 명|노임|사람 수"),
    "G13": ("mokgong", "해도 되나 · 판단", "커튼박스 · 천장 매립 목공", ["xm021"],
            r"커튼\s?박스|매립|우물천장|간접조명|천장.*(평탄|내리|덧|몰딩)"),
    "G14": ("mokgong", "해도 되나 · 판단", "붙박이장 · 가벽 · 문 위치", ["qv3-mokgong-010"],
            r"붙박이장.*(짜|설치|만들|가운데|사이|맞춤)|드레스룸.*(만들|짜)|가벽.*(세우|설치|만들|치)|문.*(위치|옮기|새로 내)|문틀.*(설치|달|새로)"),
    "G15": ("common", "순서", "반셀프 공정 잇기 · 공정 순서", ["xc099"],
            r"반셀프|셀프|공정.*순서|순서|직영|분리 발주|업체.*(이어|나눠|따로)"),
    "G16": ("demolition", "해도 되나 · 판단", "석면 자재 철거", ["qv3-demolition-017"],
            r"석면|텍스|슬레이트"),
    "G17": ("demolition", "해도 되나 · 판단", "오래된 아파트 욕실 전체 철거", ["qv3-demolition-021"],
            r"(오래된|노후|구축|\d+년 (넘|된)).*(철거|욕실|배관|방수)|욕실.*(철거|덧방|방수)"),
    "G18": ("plumbing", "하자 · 원인", "보일러 · 난방 배관 누수와 수리 책임", ["qv3-plumbing-004"],
            r"누수|물이 새|새는|배관|분배기|난방.*(물|새)"),
    "G19": ("plumbing", "하자 · 원인", "보일러 고장 증상 · 점검", ["qv3-plumbing-003"],
            r"보일러|순환펌프|온수|난방.*(안|약|고장)"),
    "G20": ("floor", "관리사무소 · 이웃", "층간소음 줄이기(매트 · 바닥)", ["qv3-floor-010"],
            r"층간소음|매트|아랫집|윗집|소음|차음|완충"),
    "G21": ("film", "기간", "필름 수명 · 교체 주기", ["qv3-film-008"],
            r"필름.*(몇 년|수명|오래|버티|버텨|변색|주기|가요)|시트지.*(몇 년|수명)"),
    "G22": ("film", "하자 · 원인", "필름 들뜸 · 주름 · 이음부 보수", ["qv3-film-010"],
            r"필름.*(들뜸|들떠|주름|벌어|기포|찢|보수|재시공|하자|이음)"),
    "G23": ("film", "순서", "필름과 주변 마감(벽지) 순서", ["qv3-film-003"],
            r"필름.*(벽지|도배|순서|먼저|같이)|(도배|벽지).*필름"),
    "G24": ("paint", "자재", "페인트 고르기(수성 · 유성 · 문틀)", ["qv3-paint-020"],
            r"수성|유성|에나멜|페인트.*(종류|뭐|어떤|고르|나아)|문틀.*(칠|페인트|도장)"),
    "G25": ("kitchen", "해도 되나 · 판단", "주방 기기 더하기(식기세척기 · 전기 · 급배수)", ["qv3-kitchen-004"],
            r"식기세척기|식세기|인덕션|전용\s?콘센트|전기 용량|급수|배수구|수전"),
    "G26": ("kitchen", "기간", "싱크대 교체 날 주방 쓰기 · 실리콘 굳는 시간", ["qv3-kitchen-036"],
            r"싱크대.*(언제|당일|쓰|사용|며칠|기간)|실리콘.*(마르|굳|경화|시간)|상판.*(언제|시간)"),
}  # fmt: skip

# 공종 낱말(같은 유형을 셀 때 공종도 맞는지 봐요). common은 공종을 따지지 않아요
TRADE_WORDS = {
    "dobae": r"도배|벽지|초배|정배",
    "mokgong": r"목공|몰딩|천장|붙박이|문틀|문짝|걸레받이|가벽|커튼",
    "floor": r"바닥|마루|장판|타일|매트|층간",
    "film": r"필름|시트지|랩핑",
    "paint": r"페인트|도장|칠",
    "kitchen": r"주방|싱크|상판|식기세척기|후드|인덕션",
    "plumbing": r"보일러|배관|누수|수도|분배기|온수|난방",
    "demolition": r"철거|석면|폐기물|뜯",
}
TRADE_KO = {"도배": "dobae", "목공": "mokgong", "공통": "common"}


def jl(path: Path) -> list[dict]:
    if re.search(r"held_?out", path.name):
        raise SystemExit(f"held-out 파일은 열지 않아요: {path.name}")
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def gap_items() -> list[dict]:
    pack = {r["pid"]: r for r in jl(PACK)}
    key = {r["pid"]: r for r in jl(KEY)}
    judged = [{r["pid"]: r for r in jl(p)} for p in JUDGES]
    out = []
    for pid, p in pack.items():
        verdicts = [j[pid]["answered"] for j in judged]
        if any(v in ("no", "partial") for v in verdicts) and UNKNOWN in p["answer"]:
            out.append({"pid": pid, "qid": key[pid]["qid"], "question": p["question"],
                        "answered": verdicts, "evidence": len(p["evidence"])})  # fmt: skip
    return out


def dev_questions() -> list[dict]:
    rows = []
    for path in DEV_SETS:
        for r in jl(path):
            if r.get("split") != "dev":
                continue
            trade = r.get("trade")
            trade = TRADE_KO.get(trade, trade)
            rows.append({"id": r["id"], "text": r["text"], "trade": trade, "set": path.name})
    return rows


def main() -> None:
    gaps = gap_items()
    by_qid = {g["qid"]: g for g in gaps}
    assigned = {q for t in TOPICS.values() for q in t[3]}
    missing = sorted(set(by_qid) - assigned)
    extra = sorted(assigned - set(by_qid))
    if missing or extra:
        raise SystemExit(f"주제에 안 묶인 빠진 질문 {missing} · 빠진 질문이 아닌 qid {extra}")
    dev = dev_questions()
    topics = []
    for tid, (trade, kind, name, qids, pat) in TOPICS.items():
        rx = re.compile(pat)
        tw = re.compile(TRADE_WORDS[trade]) if trade in TRADE_WORDS else None
        same = [
            q
            for q in dev
            if rx.search(q["text"]) and (tw is None or q["trade"] == trade or tw.search(q["text"]))
        ]
        topics.append({
            "id": tid, "trade": trade, "kind": kind, "name": name,
            "gap_questions": [{"qid": q, "text": by_qid[q]["question"], "answered": by_qid[q]["answered"]} for q in qids],
            "dev_same_type": len(same),
            "dev_examples": [f"{q['id']}: {q['text']}" for q in same[:6]],
        })  # fmt: skip
    res = {
        "made": "2026-11-19",
        "source": "e3_c2_dev 판정(A · B) 중 답에 '확인하지 못했어요'가 들고 no/partial인 것",
        "gap_count": len(gaps),
        "dev_pool": {p.name: sum(1 for q in dev if q["set"] == p.name) for p in DEV_SETS},
        "method": "같은 유형 = 주제 낱말 규칙에 걸리고 공종도 맞는 dev 질문(대략값, 한 질문이 여러 주제에 걸릴 수 있어요)",
        "topics": topics,
    }
    (OUT / "gaps.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    with (OUT / "gaps.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "trade", "kind", "name", "gap_qids", "dev_same_type"])
        for t in topics:
            w.writerow([t["id"], t["trade"], t["kind"], t["name"],
                        ";".join(q["qid"] for q in t["gap_questions"]), t["dev_same_type"]])  # fmt: skip
    print(
        f"빠진 질문 {len(gaps)}개 → 주제 {len(topics)}개 · dev 질문 {len(dev)}개에서 같은 유형을 셈"
    )
    for t in topics:
        print(
            f"{t['id']} {t['trade']:10} {t['kind']:10} {t['name']} · 빠진 {len(t['gap_questions'])} · 같은 유형 dev {t['dev_same_type']}"
        )


if __name__ == "__main__":
    main()
