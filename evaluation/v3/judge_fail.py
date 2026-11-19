"""판정 실패 분석 (dev만): 핵심 놓침 · 읽기 어려움 · 자료 없음 실패를 질문 유형별로 묶고 원인을 코드로 가른다. LLM 없음.

    cd backend && uv run --no-sync python ../evaluation/v3/judge_fail.py     # results/judge_fail_dev.{json,md}

- 판정: judge_results/A_e3_c_part{1,2,3}.jsonl(215, 주 판정) · B_e3_c_sub.jsonl(72, 같은 원인 표를 따로)
- 답: results/e3_outputs_dev_r0.jsonl의 C(채점 묶음을 만든 그 답, 개선 전 사본) · 카드 점수는 지금 카드로 다시 잰다
- 원인(한 항목이 여럿일 수 있음)
  - 카드 없음: 받은 카드가 없고 가장 가까운 카드 열쇠 점수 < 0.45(기준을 낮춰도 안 맞음)
  - 맞추기 기준: 받은 카드가 핵심을 놓침(잘못 받음) 또는 0.45 ≤ 점수 < 받는 기준이라 놓침(아깝게 놓침)
  - 조각이 엉뚱함: 조각 문장으로 답했는데 RAG 정답 조각과 겹치지 않음(정답이 있는 질문) · 질문 낱말이 문장에 절반 아래
  - 원문 -다 인용: 읽기 어려움 판정이고 따옴표 원문이 '-다'로 끝남
"""

import json
import re
from collections import Counter, defaultdict

from common import HERE, RESULTS, ROOT, jsonl, utf8_stdout
from kb3 import kb

from app.agent.v3 import answer as ans_mod
from app.knowledge import cards, extract

TYPES = (
    ("가격 · 비용", r"얼마|비용|가격|비싸|싸요|싼|견적|돈"),
    ("기간 · 일정", r"며칠|기간|얼마나\s*걸|언제|일정|몇\s*시간|몇\s*일"),
    (
        "하자 · 원인",
        r"왜|원인|하자|들뜨|들떠|들떴|곰팡|갈라|금이|틈이|누수|물이\s*새|변색|벌어|떨어|얼룩|냄새|결로|터져|울어|울고|휘",
    ),
    (
        "비교 · 고르기",
        r"차이|비교|어느\s*게|뭐가\s*나|뭘로|어떤\s*\S+\s*(?:게|걸|가)|고르|중에|중\s*어|vs|나아요|나을까|좋아요|달라요",
    ),
    ("책임 · 절차", r"누가|책임|허가|동의|신고|관리사무소|집주인|구청|대신|도움을\s*요청"),
    ("방법 · 순서", r"어떻게|방법|순서|먼저|과정|절차|하는\s*법|어디부터"),
    (
        "해도 되나 · 판단",
        r"해도\s*돼|해도\s*되|괜찮|되나요|될까|필요|해야\s*하|해야\s*해|가능|수\s*있|나요\?|까요\?|인가요|건가요|믿어도|하나요",
    ),
    ("용어 · 뜻", r"뭐예요|뭔가요|뜻이|무엇|이란|뭐죠"),
    ("준비 · 확인", r"챙길|확인|체크|준비|점검|주의"),
)
CAUSES = (
    "카드 없음",
    "맞추기 기준(잘못 받음)",
    "맞추기 기준(아깝게 놓침)",
    "조각이 엉뚱함",
    "원문 -다 인용",
)
T_LOOSE = 0.45
QUOTE = re.compile(r"“([^”]+)”")
DA_END = re.compile(r"(다|니다|함|음)[.…]?$")
RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]


def qtype(text: str) -> str:
    for name, pat in TYPES:
        if re.search(pat, text):
            return name
    return "기타"


def judged(names: tuple[str, ...]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for n in names:
        p = HERE / "judge_results" / n
        if p.exists():
            for r in jsonl(p):
                out.setdefault(r["pid"], r)
    return out


def diagnose(item: dict, out: dict, gold: set[str], K) -> dict:
    q = item["question"]
    srcs = {s["source"] for s in out["sections"]}
    used_card = bool(out["used_cards"])
    m = cards.find(K.cards, q, k=1)
    best = m[0].score if m else 0.0
    ext = [s for s in out["sections"] if s["source"] == "extract"]
    refs = [c for s in ext for x in s["sentences"] for c in x.get("cites", [])]
    qw = extract._words(q)
    cover = 0.0
    for r in refs:
        it = K.ix.by_ref.get(r)
        if it and qw:
            cover = max(
                [cover]
                + [len(qw & extract._words(s)) / len(qw) for s in extract.sentences(it.chunk.text)]
            )
    quotes = [m.group(1) for s in ext for x in s["sentences"] for m in QUOTE.finditer(x["text"])]
    return {
        "type": qtype(q),
        "sources": sorted(srcs),
        "unknown": bool(out["unknown"]),
        "card": used_card,
        "best_card": round(best, 3),
        "extract_refs": refs,
        "extract_cover": round(cover, 3),
        "gold_hit": bool(gold & set(refs)) if gold else None,
        "da_quote": any(DA_END.search(x.strip()) for x in quotes),
    }


def causes(f: dict, d: dict) -> list[str]:
    out = []
    if f.get("missed_point"):
        if d["card"]:
            out.append("맞추기 기준(잘못 받음)")
        elif d["best_card"] >= T_LOOSE:
            out.append("맞추기 기준(아깝게 놓침)")
        else:
            out.append("카드 없음")
        if d["extract_refs"] and (d["gold_hit"] is False or d["extract_cover"] < 0.5):
            out.append("조각이 엉뚱함")
    if f.get("hard_to_read") and d["da_quote"]:
        out.append("원문 -다 인용")
    return out


def table(rows: list[dict], title: str) -> list[str]:
    by = defaultdict(list)
    for r in rows:
        by[r["diag"]["type"]].append(r)
    head = (
        "| 질문 유형 | 항목 | 핵심 놓침 | 읽기 어려움 | 자료 없음 실패 | "
        + " | ".join(CAUSES)
        + " |"
    )
    lines = [
        f"**{title}**",
        "",
        head,
        "| --- | " + " | ".join("---" for _ in range(4 + len(CAUSES))) + " |",
    ]
    total = Counter()
    for t in [x for x, _ in TYPES] + ["기타"]:
        rs = by.get(t, [])
        if not rs:
            continue
        c = Counter(k for r in rs for k in r["causes"])
        mp = sum(bool(r["fail"].get("missed_point")) for r in rs)
        hr = sum(bool(r["fail"].get("hard_to_read")) for r in rs)
        ns = sum(bool(r["fail"].get("no_source_fail")) for r in rs)
        total.update({"n": len(rs), "mp": mp, "hr": hr, "ns": ns, **c})
        lines.append(
            f"| {t} | {len(rs)} | {mp} | {hr} | {ns} | "
            + " | ".join(str(c[k]) for k in CAUSES)
            + " |"
        )
    lines.append(
        f"| **합** | {total['n']} | {total['mp']} | {total['hr']} | {total['ns']} | "
        + " | ".join(str(total[k]) for k in CAUSES)
        + " |"
    )
    return lines


def main() -> None:
    utf8_stdout()
    K = kb()
    key = {r["pid"]: r for r in jsonl(HERE / "judge_packs/e3_c_dev_key.jsonl")}
    pack = {r["pid"]: r for r in jsonl(HERE / "judge_packs/e3_c_dev.jsonl")}
    outs = {r["qid"]: r for r in jsonl(RESULTS / "e3_outputs_dev_r0.jsonl") if r["variant"] == "C"}
    gold = {q["id"]: {g["ref"] for g in q.get("gold", [])} for p in RAG for q in jsonl(p)}
    res = {}
    for judge, names in (
        ("A", ("A_e3_c_part1.jsonl", "A_e3_c_part2.jsonl", "A_e3_c_part3.jsonl")),
        ("B", ("B_e3_c_sub.jsonl",)),
    ):
        rows = []
        for pid, j in judged(names).items():
            k = key[pid]
            d = diagnose(pack[pid], outs[k["qid"]], gold.get(k["qid"], set()), K)
            f = {n: bool(v) for n, v in (j.get("fail") or {}).items()}
            rows.append({"pid": pid, "qid": k["qid"], "fail": f, "answered": j.get("answered"),
                         "diag": d, "causes": causes(f, d)})  # fmt: skip
        res[judge] = rows
    # 조각 문장 답의 판정(핵심 놓침)과 문장 겹침 점수 — 기준을 dev로 고를 때 쓴다
    ext = [r for r in res["A"] if r["diag"]["extract_refs"] and not r["diag"]["card"]]
    curve = []
    for t in (0.3, 0.4, 0.5, 0.6, 0.7):
        keep = [r for r in ext if r["diag"]["extract_cover"] >= t]
        miss = sum(r["fail"].get("missed_point", False) for r in keep)
        drop_ok = sum(
            not r["fail"].get("missed_point", False) for r in ext if r["diag"]["extract_cover"] < t
        )
        curve.append(
            {"min_cover": t, "kept": len(keep), "kept_missed": miss, "dropped_but_ok": drop_ok}
        )
    md = (
        table(res["A"], "판정자 A · e3_c 215")
        + [""]
        + table(res["B"], "판정자 B · e3_c 72(같은 질문 부분)")
    )
    md += ["", "**조각 문장 답: 질문 낱말 겹침 기준별(판정자 A, 카드 없이 조각으로 답한 항목)**", "",
           "| 겹침 기준 | 남는 답 | 그중 핵심 놓침 | 버려지지만 괜찮던 답 |", "| --- | --- | --- | --- |"]  # fmt: skip
    md += [
        f"| {c['min_cover']} | {c['kept']} | {c['kept_missed']} | {c['dropped_but_ok']} |"
        for c in curve
    ]
    out = {"A": res["A"], "B": res["B"], "extract_curve": curve}
    (RESULTS / "judge_fail_dev.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (RESULTS / "judge_fail_dev.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    lst = Counter((r["diag"]["type"], ans_mod.T_CARD) for r in res["A"])
    print("\n유형별 항목:", dict(Counter(r["diag"]["type"] for r in res["A"])), len(lst))


if __name__ == "__main__":
    main()
