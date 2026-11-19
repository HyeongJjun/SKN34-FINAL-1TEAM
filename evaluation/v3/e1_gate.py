"""E1 v3 관문: 규칙만 · 분류기만 · 분류기 + 12공종 낱말 · v3 관문(설계안) + 기준값 곡선. LLM · DB 없음(무료).

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e1_gate.py            # dev만(고르기)
    cd backend && .venv/Scripts/python.exe ../evaluation/v3/e1_gate.py --final    # + held-out 한 번(기록)

세트
- 의도 세트(evaluation/intent dev 133 · held-out 67)를 v3 라벨로: 다른 공종(other_trade) → trade, 복합(kind=multi) → multi,
  그 밖 orchestrator → guide. 프로젝트가 있다고 본다(견적 · 일정 라벨이 프로젝트를 전제).
- 질문 은행(data/v3/questions, 13공종): 정답 담당 = kb3.bank 규칙, 정답 공종 = trade 칸. 프로젝트 없음.
되묻기(ask_back)는 틀림으로 세되 '되묻기 수'를 따로 적는다(버튼 2~3개로 끝나는 길).
"""

import argparse
from collections import Counter

from common import ROOT, save, utf8_stdout, wilson
from intent_metrics import load_examples
from kb3 import bank

from app.agent import intent
from app.agent.v3 import gate as g3
from app.agent.v3 import policy
from app.agent.v3.trades import trades_in

LABELS = ["guide", "trade", "quote_explanation", "schedule", "multi", "out_of_scope"]
REFUSE = {"brand_reco", "vendor_reco", "legal_case"}
INTENT_FLAG = {"가격": "price", "기간": "period", "업체": "vendor_reco", "하자": "defect_judgement"}


def v3_gold(e) -> str:
    """v2 라벨 → v3 라벨(agents.md 9.1 규칙, 점수를 보기 전에 정함):
    다른 공종 → trade, 복합 → multi, 공종 낱말이 있는 용어 · 가격 문장(공종 하나) → trade, 그 밖 orchestrator → guide."""
    if e.kind == "other_trade":
        return "trade"
    if e.label == "orchestrator":
        if e.kind == "multi":
            return "multi"
        if e.kind in ("term", "price") and len(trades_in(e.text)) == 1:
            return "trade"
        return "guide"
    return e.label


def clf(text: str) -> tuple[str, float]:
    p = intent.probs(text) or {}
    lab = max(p, key=p.__getitem__)
    return lab, p[lab]


def methods(text: str, has_project: bool) -> dict[str, tuple[str, list[str], list[str]]]:
    found = trades_in(text)
    lab, _ = clf(text)
    plain = g3.LABEL_ROUTE[lab]
    lex = "trade" if plain == "out_of_scope" and found else plain
    g = g3.gate(text, has_project=has_project)
    return {
        "규칙만": (g3.rule_route(text, found) or "guide", found, []),
        "분류기만(v1)": (plain, found, []),
        "분류기 + 12공종 낱말": (lex, found, []),
        "v3 관문(설계안)": (g.route, g.trades, g.policy),
    }


def macro_f1(gold: list[str], pred: list[str]) -> float:
    f1s = []
    for lab in [x for x in LABELS if x in gold or x in pred]:
        tp = sum(g == p == lab for g, p in zip(gold, pred, strict=True))
        fp = sum(g != lab and p == lab for g, p in zip(gold, pred, strict=True))
        fn = sum(g == lab and p != lab for g, p in zip(gold, pred, strict=True))
        pr, rc = (tp / (tp + fp) if tp + fp else 0.0), (tp / (tp + fn) if tp + fn else 0.0)
        f1s.append(2 * pr * rc / (pr + rc) if pr + rc else 0.0)
    return round(sum(f1s) / len(f1s), 3) if f1s else 0.0


def score(gold: list[str], pred: list[str]) -> dict:
    k = sum(g == p for g, p in zip(gold, pred, strict=True))
    asked = sum(p == "ask_back" for p in pred)
    ans = [(g, p) for g, p in zip(gold, pred, strict=True) if p != "ask_back"]
    per = {}
    for lab in LABELS:
        tp = sum(g == p == lab for g, p in zip(gold, pred, strict=True))
        npred, ngold = pred.count(lab), gold.count(lab)
        if ngold or npred:
            per[lab] = {
                "p": round(tp / npred, 3) if npred else None,
                "r": round(tp / ngold, 3) if ngold else None,
                "n": ngold,
            }
    return {
        "n": len(gold), "accuracy": round(k / len(gold), 3), "acc_ci95": wilson(k, len(gold)),
        "macro_f1": macro_f1(gold, pred), "ask_back": asked,
        "acc_when_answered": round(sum(g == p for g, p in ans) / len(ans), 3) if ans else None,
        "per_label": per,
    }  # fmt: skip


def run_intent(split: str) -> dict:
    ex = load_examples(ROOT / "evaluation/intent" / f"{split}.jsonl")
    gold = [v3_gold(e) for e in ex]
    preds: dict[str, list[str]] = {}
    for e in ex:
        for name, (route, _, _) in methods(e.text, True).items():
            preds.setdefault(name, []).append(route)
    return {name: score(gold, p) for name, p in preds.items()}


def run_bank(split: str) -> dict:
    qs = bank(split)
    gold = [q["gold_route"] for q in qs]
    out: dict = {}
    for name in ["규칙만", "분류기만(v1)", "분류기 + 12공종 낱말", "v3 관문(설계안)"]:
        pred, first_ok, contains, multi_single, handled, flags = [], 0, 0, 0, 0, Counter()
        for q in qs:
            route, tr, pol = methods(q["text"], False)[name]
            # 공종 담당이면 trade · multi 모두 '공종 길'로 본다(정답 공종이 들어 있는지 따로 잰다)
            r = (
                "trade"
                if route == "multi" and q["gold_route"] == "trade" and q["trade"] in tr
                else route
            )
            pred.append(r)
            if q["gold_route"] == "trade":
                first_ok += bool(tr) and tr[0] == q["trade"]
                contains += q["trade"] in tr
                multi_single += route == "multi"
            if q["expect"] == "out_of_scope":
                handled += route == "out_of_scope" or bool(REFUSE & set(pol))
            want = INTENT_FLAG.get(q["intent"])
            if want and name == "v3 관문(설계안)":
                flags[q["intent"]] += want in pol
                flags[q["intent"] + "_n"] += 1
        n_trade = sum(1 for q in qs if q["gold_route"] == "trade")
        n_out = sum(1 for q in qs if q["expect"] == "out_of_scope")
        res = score(gold, pred)
        res |= {
            "trade_first_correct": round(first_ok / n_trade, 3), "trade_first_ci95": wilson(first_ok, n_trade),
            "trade_contains": round(contains / n_trade, 3), "multi_on_single_trade": multi_single,
            "out_of_scope_handled": f"{handled}/{n_out}",
        }  # fmt: skip
        if flags:
            res["policy_flag_recall"] = {
                k: f"{flags[k]}/{flags[k + '_n']}" for k in INTENT_FLAG if flags[k + "_n"]
            }
        if name == "v3 관문(설계안)":
            ab = [q for q in qs if q["expect"] == "ask_back"]
            flagged = sum(
                1
                for q in ab
                if set(policy.policy_of(q["text"]))
                & {"my_house", "price", "period", "defect_judgement"}
            )
            res["ask_back_questions_flagged"] = f"{flagged}/{len(ab)}"
        out[name] = res
    return out


def curve(split: str) -> list[dict]:
    """관문 기준값(분류기 신뢰도) 곡선: dev에서만 고른다."""
    ex = load_examples(ROOT / "evaluation/intent" / f"{split}.jsonl")
    gold = [v3_gold(e) for e in ex]
    rows, old = [], g3.THRESHOLD
    try:
        for t in (0.5, 0.6, 0.7, 0.8, 0.9):
            g3.THRESHOLD = t
            pred = [g3.gate(e.text, has_project=True).route for e in ex]
            s = score(gold, pred)
            rows.append({"t": t, "accuracy": s["accuracy"], "macro_f1": s["macro_f1"], "ask_back": s["ask_back"],
                         "acc_when_answered": s["acc_when_answered"]})  # fmt: skip
    finally:
        g3.THRESHOLD = old
    return rows


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    out = {"threshold": g3.THRESHOLD, "intent_v3": {}, "bank": {}, "curve_dev": curve("dev")}
    for split in ("dev", "heldout") if a.final else ("dev",):
        out["intent_v3"][split] = run_intent(split)
        out["bank"][split] = run_bank(split)
        print(f"\n## {split}")
        for name, s in out["intent_v3"][split].items():
            print(
                f"- 의도 세트 {name}: 정확도 {s['accuracy']} {s['acc_ci95']} · macro-F1 {s['macro_f1']} · 되묻기 {s['ask_back']} (n {s['n']})"
            )
        for name, s in out["bank"][split].items():
            print(
                f"- 질문 은행 {name}: 정확도 {s['accuracy']} {s['acc_ci95']} · macro-F1 {s['macro_f1']} · 되묻기 {s['ask_back']} · "
                f"공종 첫 맞음 {s['trade_first_correct']} {s['trade_first_ci95']} · 포함 {s['trade_contains']} · "
                f"단일 공종인데 multi {s['multi_on_single_trade']} · 범위 밖 처리 {s['out_of_scope_handled']} (n {s['n']})"
            )
        v = out["bank"][split]["v3 관문(설계안)"]
        print(
            f"- 정책 표시 재현율: {v.get('policy_flag_recall')} · 되묻기 질문 표시 {v.get('ask_back_questions_flagged')}"
        )
    print("\n## 기준값 곡선(dev, 의도 세트 v3 라벨)")
    for r in out["curve_dev"]:
        print(f"- {r}")
    p = save(f"e1_gate_{'final' if a.final else 'dev'}.json", out)
    print(f"\n저장: {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
