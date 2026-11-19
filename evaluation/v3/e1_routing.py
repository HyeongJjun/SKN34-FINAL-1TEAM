"""E1 라우팅 기준선: 규칙 vs 분류기(intent_lr_v1) vs 둘 다. LLM · DB 없음(무료).

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e1_routing.py            # dev
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e1_routing.py --final    # held-out 기록(고르기에 쓰지 않음)

재는 것
1. 방식별 정확도 · macro-F1 (지금 라벨 5개: orchestrator · trade · quote_explanation · schedule · out_of_scope)
2. 분류기 신뢰도 기준값별 '바로 받는 비율 / 받은 것의 정확도' (나머지는 되묻기)
3. v3 라벨로 바꿀 때: 다른 공종 문장(kind=other_trade)은 범위 밖이 아니라 공종 지식 답으로 가야 한다
   → 지금 분류기가 그 문장을 어디로 보내는지, 12공종 낱말표(trades_v3)가 공종을 맞히는지
4. 공종 고르기: RAG 질문 390개(도배 · 목공 · 공통)와 질문 은행 1,109개(있으면)에서 지금 낱말 vs v3 낱말
"""

import argparse
import re
from collections import Counter
from pathlib import Path

from common import ROOT, jsonl, save, utf8_stdout, wilson
from intent_metrics import LABELS, load_examples
from trades_v3 import OTHER_TRADE_GOLD, trades_v3

from app.agent import intent
from app.knowledge.bm25 import trades_of

BANK = Path("C:/Workspace/SKN34/d10-/research_notes/처음 고객 질문과 자재 지식 설계")

# ---- 규칙 라우터 (라벨 정의(gate.JEV_CRITERIA)에서 바로 쓴 낱말 규칙. held-out을 보고 고치지 않았다) ----
CHITCHAT = re.compile(r"로또|주식|집값|영화|점심|저녁\s*뭐|강아지|번역|날씨|심심|짜증")
SERVICE = re.compile(
    r"할부|카드|간편결제|결제|현금영수증|세금계산서|계좌|입금|송금|전자계약|계약서\s*도장|계약\s*체결"
)
GREETING = re.compile(r"^\s*(안녕|반갑|하이|hi\b|hello|저기요|처음\s*뵙)", re.IGNORECASE)
GUIDE = re.compile(
    r"처음|순서|뭐부터|어떻게\s*진행|믿집|가입|대신\s*신청|골라야|고르는|뜻|뭐예요|뭔가요|뭐에요"
)
QUOTE_MINE = re.compile(
    r"표준\s*견적|가견적|실측\s*견적|견적서|견적\s*(?:이|가|에서|은|받았)|합계|부가세|줄\s*하나"
)
PRICE = re.compile(r"얼마|비용|시세|평당|비싸|싸지|금액")
SCHEDULE = re.compile(
    r"일정|날짜|공정표|연기|미뤄|미루|며칠|언제\s*(?:시작|끝|와)|끝나는\s*날|시작하는\s*날|순서가\s*바뀌"
)


def rule_label(text: str) -> str | None:
    if CHITCHAT.search(text) or SERVICE.search(text):
        return "out_of_scope"
    own = trades_of(text)  # 지금 범위: 도배 · 목공
    other = [t for t in trades_v3(text) if t not in ("dobae", "mokgong")]
    if other and not own:
        return "out_of_scope"  # 지금 라벨 체계에서 다른 공종은 범위 밖
    fired = {
        "quote_explanation": bool(QUOTE_MINE.search(text)),
        "schedule": bool(SCHEDULE.search(text)),
        "trade": bool(own),
    }
    if sum(fired.values()) >= 2:
        return "orchestrator"  # 두 담당 이상 = 복합
    for label, hit in fired.items():
        if hit:
            return label
    if PRICE.search(text) or GREETING.search(text) or GUIDE.search(text):
        return "orchestrator"  # 일반 시세 · 인사 · 처음 안내
    return None


def clf(text: str) -> tuple[str, float]:
    p = intent.probs(text)
    if p is None:
        raise SystemExit("모델 파일이 없어요: backend/app/agent/intent_lr_v1.json.gz")
    lab = max(p, key=p.__getitem__)
    return lab, p[lab]


THRESHOLD = 0.7  # 지금 설정(settings.intent_confidence_threshold)


def methods(text: str) -> dict[str, str]:
    c, conf = clf(text)
    r = rule_label(text)
    return {
        "규칙만(못 정하면 orchestrator)": r or "orchestrator",
        "분류기만": c,
        "규칙 먼저 → 분류기": r or c,
        "분류기(≥0.7) → 규칙 → 분류기": c if conf >= THRESHOLD else (r or c),
    }


def macro_f1(gold: list[str], pred: list[str]) -> float:
    used = [lab for lab in LABELS if lab in gold or lab in pred]
    f1s = []
    for lab in used:
        tp = sum(1 for g, p in zip(gold, pred, strict=True) if g == lab and p == lab)
        fp = sum(1 for g, p in zip(gold, pred, strict=True) if g != lab and p == lab)
        fn = sum(1 for g, p in zip(gold, pred, strict=True) if g == lab and p != lab)
        pr = tp / (tp + fp) if tp + fp else 0.0
        rc = tp / (tp + fn) if tp + fn else 0.0
        f1s.append(2 * pr * rc / (pr + rc) if pr + rc else 0.0)
    return sum(f1s) / len(f1s) if f1s else 0.0


def run_split(split: str) -> dict:
    ex = load_examples(ROOT / "evaluation/intent" / f"{split}.jsonl")
    gold = [e.label for e in ex]
    out: dict = {"n": len(ex), "methods": {}, "threshold_curve": [], "v3": {}}
    preds: dict[str, list[str]] = {}
    for e in ex:
        for name, lab in methods(e.text).items():
            preds.setdefault(name, []).append(lab)
    for name, p in preds.items():
        k = sum(1 for g, x in zip(gold, p, strict=True) if g == x)
        out["methods"][name] = {
            "accuracy": round(k / len(ex), 3),
            "acc_ci95": wilson(k, len(ex)),
            "macro_f1": round(macro_f1(gold, p), 3),
        }
    # 규칙이 정한 문장만 보면 (규칙의 정밀도와 덮는 비율)
    fired = [(e.label, rule_label(e.text)) for e in ex]
    got = [(g, r) for g, r in fired if r is not None]
    out["rule_fired"] = {
        "coverage": round(len(got) / len(ex), 3),
        "precision": round(sum(1 for g, r in got if g == r) / len(got), 3) if got else None,
    }
    # 신뢰도 기준값 곡선
    scored = [(e.label, *clf(e.text)) for e in ex]
    for t in (0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        acc = [(g, p) for g, p, c in scored if c >= t]
        ok = sum(1 for g, p in acc if g == p)
        out["threshold_curve"].append(
            {
                "t": t,
                "auto_rate": round(len(acc) / len(ex), 3),
                "auto_acc": round(ok / len(acc), 3) if acc else None,
                "ask_back": len(ex) - len(acc),
            }
        )
    # v3: 다른 공종 문장
    other = [(e, *clf(e.text)) for e in ex if e.kind == "other_trade"]
    lex_ok = lex_none = 0
    rows = []
    for e, lab, conf in other:
        found = trades_v3(e.text)
        goldset = OTHER_TRADE_GOLD.get(e.text, set())
        ok = bool(found) and found[0] in goldset
        lex_ok += ok
        lex_none += not found
        rows.append(
            {"text": e.text, "clf": lab, "conf": round(conf, 3), "v3_trades": found, "ok": ok}
        )
    out["v3"]["other_trade"] = {
        "n": len(other),
        "clf_to_out_of_scope": sum(1 for _, lab, _ in other if lab == "out_of_scope"),
        "lexicon_first_trade_correct": lex_ok,
        "lexicon_none": lex_none,
        "rows": rows,
    }
    # v3 라벨로 다시 매기면: other_trade → trade(공종 지식 답). 분류기 + 낱말 덮어쓰기
    v3_gold = ["trade" if e.kind == "other_trade" else e.label for e in ex]
    v3_pred = []
    for e in ex:
        lab, _ = clf(e.text)
        if lab == "out_of_scope" and trades_v3(e.text):
            lab = "trade"  # 다른 공종 낱말이 있으면 범위 밖 대신 공종 지식 답
        v3_pred.append(lab)
    plain = [clf(e.text)[0] for e in ex]
    for name, p in (("분류기 그대로", plain), ("분류기 + v3 낱말 덮어쓰기", v3_pred)):
        k = sum(1 for g, x in zip(v3_gold, p, strict=True) if g == x)
        out["v3"][name] = {"accuracy": round(k / len(ex), 3), "acc_ci95": wilson(k, len(ex))}
    return out


def trade_routing(final: bool) -> dict:
    """공종 고르기: RAG 질문(도배 · 목공 · 공통) + 질문 은행(도배 · 목공 · 일반)"""
    sets = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
    qs = [q for p in sets for q in jsonl(p) if final or q["split"] == "dev"]
    name = {"도배": "dobae", "목공": "mokgong", "공통": None}
    res: dict = {}
    for label, fn in (("지금 낱말(2공종)", lambda t: trades_of(t)), ("v3 낱말(12공종)", trades_v3)):
        c = Counter()
        for q in qs:
            got = fn(q["text"])
            got = [{"도배": "dobae", "목공": "mokgong"}.get(x, x) for x in got]
            want = name[q["trade"]]
            if want is None:
                c["공통: 공종 안 걸림"] += not got
                c["공통: 다른 공종 걸림"] += bool(got)
            else:
                c[f"{q['trade']}: 첫 공종 맞음"] += bool(got) and got[0] == want
                c[f"{q['trade']}: 정답 공종 포함"] += want in got
                c[f"{q['trade']}: 공종 못 찾음"] += not got
                c[f"{q['trade']}: 다른 공종 먼저"] += bool(got) and got[0] != want
        res[label] = dict(c) | {"n": len(qs)}
    bank = {}
    if BANK.is_dir():
        for f, want in (("q_dobae.jsonl", "dobae"), ("q_mokgong.jsonl", "mokgong")):
            rows = jsonl(BANK / f)
            first = Counter((trades_v3(r["question"]) or ["(없음)"])[0] for r in rows)
            ko = {"dobae": "도배", "mokgong": "목공"}[want]
            now = sum(1 for r in rows if ko in trades_of(r["question"]))
            bank[f] = {
                "n": len(rows),
                "지금 낱말 정답 공종 포함": now,
                "v3 낱말 정답 공종 포함": sum(1 for r in rows if want in trades_v3(r["question"])),
                "v3 낱말 첫 공종 맞음": first[want],
                "v3 못 찾음": first["(없음)"],
                "v3 첫 공종 분포": dict(first.most_common(8)),
            }
        rows = jsonl(BANK / "q_general.jsonl")
        any_trade = Counter((trades_v3(r["question"]) or ["(없음)"])[0] for r in rows)
        bank["q_general.jsonl"] = {
            "n": len(rows),
            "v3 첫 공종 분포": dict(any_trade.most_common(10)),
        }
    res["질문 은행 1,109"] = bank or "없음"
    return res


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true", help="held-out도 잰다 (기록용)")
    a = ap.parse_args()
    out = {"model": "intent_lr_v1", "threshold": THRESHOLD, "splits": {}}
    for split in ("dev", "heldout") if a.final else ("dev",):
        r = run_split(split)
        out["splits"][split] = r
        print(f"\n## {split} ({r['n']}문장)")
        for name, m in r["methods"].items():
            print(f"- {name}: 정확도 {m['accuracy']} {m['acc_ci95']} · macro-F1 {m['macro_f1']}")
        print(
            f"- 규칙이 정한 비율 {r['rule_fired']['coverage']} · 그 정밀도 {r['rule_fired']['precision']}"
        )
        print("- 분류기 기준값: " + " / ".join(
            f"{x['t']}: 바로 {x['auto_rate']} 정확 {x['auto_acc']} 되묻기 {x['ask_back']}" for x in r["threshold_curve"]
        ))  # fmt: skip
        o = r["v3"]["other_trade"]
        print(
            f"- v3 다른 공종 {o['n']}문장: 분류기가 범위 밖으로 {o['clf_to_out_of_scope']} · "
            f"12공종 낱말 첫 공종 맞음 {o['lexicon_first_trade_correct']} · 못 찾음 {o['lexicon_none']}"
        )
        for name in ("분류기 그대로", "분류기 + v3 낱말 덮어쓰기"):
            m = r["v3"][name]
            print(f"- v3 라벨 정확도({name}): {m['accuracy']} {m['acc_ci95']}")
    out["trade_routing"] = trade_routing(a.final)
    print("\n## 공종 고르기 (RAG 질문" + (" dev+held-out)" if a.final else " dev)"))
    for k, v in out["trade_routing"].items():
        print(f"- {k}: {v}")
    path = save(f"e1_routing_{'final' if a.final else 'dev'}.json", out)
    print(f"\n저장: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
