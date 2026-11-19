"""판정 결과 채점 (E3 · E4 뜻 채점, PLAN 5절 · agent-04). 판정 줄 + 열쇠 파일만 읽는다. LLM · DB 없음.

    cd backend && uv run --no-sync python ../evaluation/v3/judge_score.py          # results/judge_summary.{json,md}
    cd backend && uv run --no-sync python ../evaluation/v3/judge_score.py --doc    # b5.md '판정 결과' 칸도 바꿈
    (시험용) --results DIR --packs DIR --out DIR --doc-path FILE

입력
- 판정(없는 파일은 건너뛰고 표시): judge_results/A_e3_c_part{1,2,3}.jsonl · B_e3_c_sub.jsonl · A_e3_abc.jsonl ·
  B_e3_abc.jsonl · A_e4_pairs.jsonl. 판정 줄 모양은 judge_packs/rubric.md.
- 묶음 · 열쇠: judge_packs/{e3_c_dev,e3_abc_dev,e4_pairs_dev}.jsonl · *_key.jsonl (방식 · 순서는 열쇠에만 있다)

재는 것
- E3 방식별(A 카드만 · B 조각만 · C 카드 → 조각 → 모름): 문장 근거율(정해 둔 안내 글 policy는 뺌), 실패 유형 비율
  (기대 행동이 있는 셋은 그 기대 행동 항목 안에서), 질문 핵심에 답함(yes · partial), 지어낸 숫자가 0인지
- 판정자 A–B 겹치는 항목: answered · 실패 유형마다 Cohen's kappa와 일치율, 문장 근거 일치율(두 판정자가 문장을
  같은 수로 나눈 항목만), 항목 단위 '모든 문장 받침' 일치
- E4 단일 vs 다중: 같은 질문의 두 순서(AB · BA)가 같은 쪽을 고른 것만 '이김', 둘 다 비김이면 '비김', 다르면 '순서 영향'
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from common import HERE, ROOT, utf8_stdout, wilson

FAILS = (
    "unsupported",
    "made_up_number",
    "out_of_scope_fail",
    "ask_back_fail",
    "no_source_fail",
    "recommend",
    "defect_verdict",
    "missed_point",
    "hard_to_read",
)
EXPECT_OF = {
    "out_of_scope_fail": "out_of_scope",
    "ask_back_fail": "ask_back",
    "no_source_fail": "no_source",
}
LABELS = ("supported", "partial", "unsupported", "policy")
ANSWERED = ("yes", "partial", "no")
BETTER = {"1": "1", "2": "2", "tie": "tie", "동점": "tie", "비김": "tie"}
SIDE = {"단일-다중": {"1": "단일", "2": "다중"}, "다중-단일": {"1": "다중", "2": "단일"}}
JUDGE_FILES = {  # (묶음, 판정자) → 파일들
    ("e3_c", "A"): ("A_e3_c_part1.jsonl", "A_e3_c_part2.jsonl", "A_e3_c_part3.jsonl"),
    ("e3_c", "B"): ("B_e3_c_sub.jsonl",),
    ("e3_abc", "A"): ("A_e3_abc.jsonl",),
    ("e3_abc", "B"): ("B_e3_abc.jsonl",),
    ("e4", "A"): ("A_e4_pairs.jsonl",),
    ("e3_c2", "A"): ("A_e3_c2.jsonl",),  # 개선 1회차 C(같은 질문, 열쇠 prev_pid로 지난 판정과 짝)
    ("e3_c2", "B"): ("B_e3_c2.jsonl",),
    ("e3d", "A"): ("A_e3d.jsonl",),  # D = LLM 모드 흉내(abc와 같은 30문항)
    ("e3_c3", "A"): ("A_e3_c3.jsonl",),  # 개선 2회차 C(c2와 같은 90문항, prev_pid = c2 pid)
    ("e3_c3", "B"): ("B_e3_c3.jsonl",),
    ("e3_c3_heldout", "A"): ("A_e3_c3_heldout.jsonl",),  # held-out 최종(기록만, 고르기에 안 씀)
    ("e3_c3_heldout", "B"): ("B_e3_c3_heldout.jsonl",),
    ("e3d", "B"): ("B_e3d.jsonl",),
}
PACKS = {
    "e3_c": "e3_c_dev",
    "e3_abc": "e3_abc_dev",
    "e4": "e4_pairs_dev",
    "e3_c2": "e3_c2_dev",
    "e3d": "e3d_dev",
    "e3_c3": "e3_c3_dev",
    "e3_c3_heldout": "e3_c3_heldout",
}
RANK = {"yes": 2, "partial": 1, "no": 0}
MARK_START, MARK_END = "<!-- judge-summary:start -->", "<!-- judge-summary:end -->"
FAIL_KO = {
    "unsupported": "근거 없음",
    "made_up_number": "지어낸 숫자",
    "out_of_scope_fail": "범위 밖 실패",
    "ask_back_fail": "되묻기 실패",
    "no_source_fail": "자료 없음 실패",
    "recommend": "추천",
    "defect_verdict": "하자 단정",
    "missed_point": "핵심 놓침",
    "hard_to_read": "읽기 어려움",
}


def read_lines(path: Path) -> tuple[list[dict], int]:
    """한 줄 JSON. 코드 울타리(```) · 빈 줄은 넘기고, 읽지 못한 줄 수를 센다."""
    rows, bad = [], 0
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        s = line.strip()
        if not s or s.startswith("```"):
            continue
        try:
            x = json.loads(s)
        except json.JSONDecodeError:
            bad += 1
            continue
        if isinstance(x, dict):
            rows.append(x)
        else:
            bad += 1
    return rows, bad


def keyed(path: Path) -> dict[str, dict]:
    return {r["pid"]: r for r in read_lines(path)[0]} if path.exists() else {}


def e3_row(r: dict) -> dict | None:
    """판정 한 줄 → {labels, fail, answered}. 모양이 틀린 칸은 버리고 bad_fields를 센다."""
    bad = 0
    sents = r.get("sentences") or []
    pairs = []
    for k, x in enumerate(sents):
        i, lab = (x.get("i", k), x.get("label")) if isinstance(x, dict) else (k, x)
        lab = str(lab or "").strip().lower()
        if lab in LABELS:
            pairs.append((int(i) if str(i).lstrip("-").isdigit() else k, lab))
        else:
            bad += 1
    raw = r.get("fail") or {}
    if isinstance(raw, list):  # 참인 이름만 적은 판정
        raw = {str(n): True for n in raw}
    fail = {f: bool(raw.get(f, False)) for f in FAILS}
    ans = str(r.get("answered") or "").strip().lower()
    if ans not in ANSWERED:
        bad += 1
        ans = None
    return {"labels": dict(sorted(pairs)), "fail": fail, "answered": ans, "bad_fields": bad}


def ratio(k: int, n: int) -> dict:
    return {"k": k, "n": n, "rate": round(k / n, 3) if n else None, "ci95": list(wilson(k, n))}


def score_e3(items: list[tuple[dict, dict]]) -> dict:
    """items: (판정, 묶음 항목) 쌍들."""
    n = len(items)
    sent = Counter(lab for j, _ in items for lab in j["labels"].values())
    judged = sent["supported"] + sent["partial"] + sent["unsupported"]
    with_claims = [j for j, _ in items if any(v != "policy" for v in j["labels"].values())]
    all_ok = sum(
        all(v in ("supported", "policy") for v in j["labels"].values()) for j in with_claims
    )
    fails = {}
    for f in FAILS:
        if f in EXPECT_OF:
            group = [j for j, it in items if it.get("expect") == EXPECT_OF[f]]
            fails[f] = ratio(sum(j["fail"][f] for j in group), len(group)) | {"of": EXPECT_OF[f]}
        else:
            fails[f] = ratio(sum(j["fail"][f] for j, _ in items), n)
    ans = Counter(j["answered"] for j, _ in items if j["answered"])
    n_ans = sum(ans.values())
    return {
        "n": n,
        "expect": dict(Counter(it.get("expect", "?") for _, it in items)),
        "sentences": {
            "all": sum(sent.values()),
            "policy": sent["policy"],
            "supported": ratio(sent["supported"], judged),
            "partial": ratio(sent["partial"], judged),
            "unsupported": ratio(sent["unsupported"], judged),
        },
        "items_all_supported": ratio(all_ok, len(with_claims)),
        "fail": fails,
        "answered": {
            "counts": {a: ans[a] for a in ANSWERED},
            "yes": ratio(ans["yes"], n_ans),
            "yes_or_partial": ratio(ans["yes"] + ans["partial"], n_ans),
        },
        "made_up_number": sum(j["fail"]["made_up_number"] for j, _ in items),
        "made_up_number_zero": not any(j["fail"]["made_up_number"] for j, _ in items),
    }


def kappa(pairs: list[tuple]) -> float | None:
    """Cohen's kappa(가중치 없음). 두 판정자가 모두 한 값만 냈으면 정의되지 않아 None."""
    n = len(pairs)
    if not n:
        return None
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[c] * cb[c] for c in set(ca) | set(cb)) / (n * n)
    if pe >= 1:
        return None
    return round((po - pe) / (1 - pe), 3)


def agree(pairs: list[tuple]) -> dict:
    n = len(pairs)
    return {
        "n": n,
        "agree": round(sum(a == b for a, b in pairs) / n, 3) if n else None,
        "kappa": kappa(pairs),
    }


def agreement(a: dict[str, dict], b: dict[str, dict]) -> dict:
    both = sorted(set(a) & set(b))
    out: dict = {"overlap": len(both)}
    out["answered"] = agree(
        [
            (a[p]["answered"], b[p]["answered"])
            for p in both
            if a[p]["answered"] and b[p]["answered"]
        ]
    )
    out["fail"] = {}
    for f in FAILS:
        pr = [(a[p]["fail"][f], b[p]["fail"][f]) for p in both]
        out["fail"][f] = agree(pr) | {
            "a_true": sum(x for x, _ in pr),
            "b_true": sum(y for _, y in pr),
        }
    same, split = [], 0
    for p in both:
        la, lb = a[p]["labels"], b[p]["labels"]
        if not la and not lb:
            continue
        if set(la) != set(lb):
            split += 1
            continue
        same += [(la[i], lb[i]) for i in la]
    out["sentences"] = agree(same) | {"split_mismatch": split}

    def ok(j: dict) -> bool:
        return all(v in ("supported", "policy") for v in j["labels"].values())

    out["items_all_supported"] = agree([(ok(a[p]), ok(b[p])) for p in both])
    return out


def score_e4(rows: dict[str, dict], key: dict[str, dict], pack: dict[str, dict]) -> dict:
    side: dict[str, dict[str, str]] = {}
    cover: dict[str, list[float]] = {"단일": [], "다중": []}
    bad = 0
    for pid, r in rows.items():
        k = key[pid]
        better = BETTER.get(str(r.get("better", "")).strip().lower())
        if better is None or k["order"] not in SIDE:
            bad += 1
            continue
        side.setdefault(k["qid"], {})[k["order"]] = (
            "tie" if better == "tie" else SIDE[k["order"]][better]
        )
        want = len(pack.get(pid, {}).get("expected_parts") or []) or None
        for slot in ("1", "2"):
            got = r.get(f"parts_covered_{slot}")
            if want and isinstance(got, int | float):
                cover[SIDE[k["order"]][slot]].append(min(float(got), want) / want)
    qids = {k["qid"] for k in key.values()}
    out = Counter()
    for q in qids:
        got = side.get(q, {})
        if len(got) < 2:
            out["incomplete"] += 1
            continue
        x, y = got["단일-다중"], got["다중-단일"]
        out[f"win_{x}" if x == y and x != "tie" else "tie" if x == y else "order_effect"] += 1
    done = len(qids) - out["incomplete"]
    decisive = out["win_다중"] + out["win_단일"]
    return {
        "questions": len(qids),
        "complete": done,
        "incomplete": out["incomplete"],
        "win_multi": out["win_다중"],
        "win_single": out["win_단일"],
        "tie": out["tie"],
        "order_effect": out["order_effect"],
        "multi_win_rate": ratio(out["win_다중"], done),
        "single_win_rate": ratio(out["win_단일"], done),
        "multi_share_of_decided": ratio(out["win_다중"], decisive),
        "order_effect_rate": ratio(out["order_effect"], done),
        "parts_covered_mean": {
            s: round(sum(v) / len(v), 3) if v else None for s, v in cover.items()
        },
        "bad_rows": bad,
    }


def _supported(items: list[dict]) -> dict:
    c = Counter(v for j in items for v in j["labels"].values())
    judged = c["supported"] + c["partial"] + c["unsupported"]
    return ratio(c["supported"], judged)


def before_after(
    new: dict[str, dict], old: dict[str, dict], key: dict[str, dict], pack: dict[str, dict]
) -> dict:
    """같은 판정자가 같은 질문의 개선 전(e3_c) · 뒤(e3_c2)를 매긴 짝: answered 옮겨 감 · 근거율 · 실패 유형 고침과 새로 생김."""
    pairs = [(p, key[p]["prev_pid"]) for p in new if key.get(p, {}).get("prev_pid") in old]
    if not pairs:
        return {"pairs": 0}
    n = len(pairs)
    moves = Counter((old[o]["answered"] or "?", new[q]["answered"] or "?") for q, o in pairs)
    better = sum(k for (a, b), k in moves.items() if RANK.get(b, -1) > RANK.get(a, -1))
    worse = sum(k for (a, b), k in moves.items() if RANK.get(b, -1) < RANK.get(a, -1))
    fails = {}
    for f in FAILS:
        fixed = sum(old[o]["fail"][f] and not new[q]["fail"][f] for q, o in pairs)
        added = sum(new[q]["fail"][f] and not old[o]["fail"][f] for q, o in pairs)
        fails[f] = {
            "before": sum(old[o]["fail"][f] for _, o in pairs),
            "after": sum(new[q]["fail"][f] for q, _ in pairs),
            "fixed": fixed,
            "new": added,
        }
    unknown = [q for q, _ in pairs if "확인하지 못했어요" in pack.get(q, {}).get("answer", "")]
    return {
        "pairs": n,
        "answered_before": {a: sum(k for (x, _), k in moves.items() if x == a) for a in ANSWERED},
        "answered_after": {a: sum(k for (_, y), k in moves.items() if y == a) for a in ANSWERED},
        "yes_before": ratio(sum(k for (x, _), k in moves.items() if x == "yes"), n),
        "yes_after": ratio(sum(k for (_, y), k in moves.items() if y == "yes"), n),
        "better": better,
        "same": n - better - worse,
        "worse": worse,
        "moves": {f"{a}->{b}": k for (a, b), k in sorted(moves.items())},
        "supported_before": _supported([old[o] for _, o in pairs]),
        "supported_after": _supported([new[q] for q, _ in pairs]),
        "fail": fails,
        "now_unknown": len(unknown),
        "now_unknown_answered": dict(Counter(new[q]["answered"] or "?" for q in unknown)),
    }


def d_vs_abc(
    d: dict[str, dict], abc: dict[str, dict], dkey: dict[str, dict], akey: dict[str, dict]
) -> dict:
    """D(LLM 흉내)와 abc의 A · B · C를 같은 질문끼리: 방식별 점수 + D가 C보다 나은 · 같은 · 못한 질문 수(answered 기준)."""
    by_q: dict[str, dict[str, dict]] = {}
    for p, j in abc.items():
        by_q.setdefault(akey[p]["qid"], {})[akey[p]["variant"]] = j
    for p, j in d.items():
        by_q.setdefault(dkey[p]["qid"], {})["D"] = j
    both = [q for q, v in by_q.items() if "D" in v and "C" in v]
    cmp = Counter()
    for q in both:
        c_, d_ = (
            RANK.get(by_q[q]["C"]["answered"] or "", -1),
            RANK.get(by_q[q]["D"]["answered"] or "", -1),
        )
        cmp["d_better" if d_ > c_ else "d_worse" if d_ < c_ else "same"] += 1
    per = {}
    for v in ("A", "B", "C", "D"):
        js = [x[v] for x in by_q.values() if v in x and "D" in x]
        if js:
            per[v] = {
                "n": len(js),
                "yes": ratio(sum(j["answered"] == "yes" for j in js), len(js)),
                "yes_or_partial": ratio(
                    sum(j["answered"] in ("yes", "partial") for j in js), len(js)
                ),
                "supported": _supported(js),
                "missed_point": sum(j["fail"]["missed_point"] for j in js),
                "unsupported": sum(j["fail"]["unsupported"] for j in js),
                "hard_to_read": sum(j["fail"]["hard_to_read"] for j in js),
                "made_up_number": sum(j["fail"]["made_up_number"] for j in js),
            }
    return {"questions": len(both), "d_vs_c": dict(cmp), "per_variant": per}


def load_judge(
    results: Path, names: tuple[str, ...], key: dict[str, dict], files: dict
) -> dict[str, dict]:
    """같은 판정자의 파일들을 합친다. 열쇠에 없는 pid · 두 번 나온 pid는 세고 버린다(먼저 온 것만)."""
    got: dict[str, dict] = {}
    for name in names:
        path = results / name
        if not path.exists():
            files[name] = {"status": "missing"}
            continue
        rows, bad = read_lines(path)
        st = {"status": "ok", "rows": len(rows), "bad_lines": bad, "unknown_pid": 0, "dup": 0}
        for r in rows:
            pid = str(r.get("pid", ""))
            if pid not in key:
                st["unknown_pid"] += 1
            elif pid in got:
                st["dup"] += 1
            else:
                got[pid] = r
        st["used"] = st["rows"] - st["unknown_pid"] - st["dup"]
        files[name] = st
    return got


def summarize(results: Path, packs: Path) -> dict:
    files: dict[str, dict] = {}
    keys = {p: keyed(packs / f"{f}_key.jsonl") for p, f in PACKS.items()}
    items = {p: keyed(packs / f"{f}.jsonl") for p, f in PACKS.items()}
    judged: dict[tuple[str, str], dict[str, dict]] = {}
    for (pack, judge), names in JUDGE_FILES.items():
        judged[(pack, judge)] = load_judge(results, names, keys[pack], files)
    out: dict = {"files": files, "e3": {}, "agreement": {}, "e4": {}}
    norm: dict[tuple[str, str], dict[str, dict]] = {}
    for (pack, judge), rows in judged.items():
        if pack == "e4" or not rows:
            continue
        norm[(pack, judge)] = {p: e3_row(r) for p, r in rows.items()}
        by_var: dict[str, list] = {}
        for p, j in norm[(pack, judge)].items():
            by_var.setdefault(keys[pack][p]["variant"], []).append((j, items[pack].get(p, {})))
        out["e3"].setdefault(pack, {})[judge] = {
            "variants": {v: score_e3(x) for v, x in sorted(by_var.items())},
            "bad_fields": sum(j["bad_fields"] for j in norm[(pack, judge)].values()),
        }
    for pack in ("e3_c", "e3_abc", "e3_c2", "e3d", "e3_c3", "e3_c3_heldout"):
        if (pack, "A") in norm and (pack, "B") in norm:
            out["agreement"][pack] = agreement(norm[(pack, "A")], norm[(pack, "B")])
    out["before_after"] = {
        j: before_after(norm[("e3_c2", j)], norm[("e3_c", j)], keys["e3_c2"], items["e3_c2"])
        for j in ("A", "B")
        if ("e3_c2", j) in norm and ("e3_c", j) in norm
    }
    out["before_after_c3"] = {
        j: before_after(norm[("e3_c3", j)], norm[("e3_c2", j)], keys["e3_c3"], items["e3_c3"])
        for j in ("A", "B")
        if ("e3_c3", j) in norm and ("e3_c2", j) in norm
    }
    out["d_vs_abc"] = {
        j: d_vs_abc(norm[("e3d", j)], norm[("e3_abc", j)], keys["e3d"], keys["e3_abc"])
        for j in ("A", "B")
        if ("e3d", j) in norm and ("e3_abc", j) in norm
    }
    if judged[("e4", "A")]:
        out["e4"]["A"] = score_e4(judged[("e4", "A")], keys["e4"], items["e4"])
    out["missing"] = sorted(n for n, st in files.items() if st["status"] == "missing")
    out["missing_packs"] = sorted(f for p, f in PACKS.items() if not keys[p])
    return out


def pct(x: dict) -> str:
    if not x or x.get("rate") is None:
        return "-"
    lo, hi = x["ci95"]
    return f"{x['rate']:.3f} ({x['k']}/{x['n']}, {lo:.2f}~{hi:.2f})"


def kap(x: dict) -> str:
    if not x or not x.get("n"):
        return "-"
    k = "정의 안 됨" if x["kappa"] is None else f"{x['kappa']:.2f}"
    return f"κ {k} · 일치 {x['agree']:.2f} (n {x['n']})"


def to_md(s: dict) -> str:
    out = [
        "**판정 파일**",
        "",
        "| 파일 | 상태 | 읽은 줄 · 쓴 줄 | 못 읽음 · 열쇠에 없음 · 겹침 |",
        "| --- | --- | --- | --- |",
    ]
    for name in sorted(s["files"]):
        st = s["files"][name]
        if st["status"] == "missing":
            out.append(f"| `{name}` | 아직 없음(건너뜀) | - | - |")
        else:
            out.append(
                f"| `{name}` | 읽음 | {st['rows']} · {st['used']} | {st['bad_lines']} · {st['unknown_pid']} · {st['dup']} |"
            )
    if s.get("missing_packs"):
        out += ["", f"- 묶음 · 열쇠가 없음: {', '.join(s['missing_packs'])}"]
    name = {"A": "A 카드만", "B": "B 조각만", "C": "C 카드 → 조각 → 모름"}
    if s["e3"]:
        out += [
            "",
            "**E3 방식별** (근거율은 정해 둔 안내 글을 뺀 문장 중, 괄호는 건수 · Wilson 95%)",
            "",
        ]
        out += [
            "| 묶음 · 판정자 | 방식 | 항목 | 문장 받침 | 안 받침 | 모든 문장 받침 | 핵심에 답함(yes) | yes + partial | 지어낸 숫자 |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for pack, by_j in s["e3"].items():
            for judge, g in by_j.items():
                for v, r in g["variants"].items():
                    zero = "0" if r["made_up_number_zero"] else f"**{r['made_up_number']}**"
                    out.append(
                        f"| {pack} · {judge} | {name.get(v, v)} | {r['n']} | {pct(r['sentences']['supported'])} | "
                        f"{pct(r['sentences']['unsupported'])} | {pct(r['items_all_supported'])} | "
                        f"{pct(r['answered']['yes'])} | {pct(r['answered']['yes_or_partial'])} | {zero} |"
                    )
        out += ["", "| 묶음 · 판정자 | 방식 | " + " | ".join(FAIL_KO[f] for f in FAILS) + " |"]
        out.append("| --- | --- | " + " | ".join("---" for _ in FAILS) + " |")
        for pack, by_j in s["e3"].items():
            for judge, g in by_j.items():
                for v, r in g["variants"].items():
                    cells = []
                    for f in FAILS:
                        x = r["fail"][f]
                        cells.append("-" if not x["n"] else f"{x['k']}/{x['n']}")
                    out.append(f"| {pack} · {judge} | {v} | " + " | ".join(cells) + " |")
        out += ["", "- 범위 밖 · 되묻기 · 자료 없음 실패는 그 기대 행동 항목 안에서 센 수예요."]
    if s["agreement"]:
        out += [
            "",
            "**판정자 A–B 일치** (겹치는 항목)",
            "",
            "| 묶음 | 겹침 | 핵심에 답함 | 문장 근거 | 모든 문장 받침 | 실패 유형(κ) |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for pack, g in s["agreement"].items():
            fk = " · ".join(
                f"{FAIL_KO[f]} {('-' if g['fail'][f]['kappa'] is None else format(g['fail'][f]['kappa'], '.2f'))}"
                f"({g['fail'][f]['a_true']}/{g['fail'][f]['b_true']})"
                for f in FAILS
            )
            sen = kap(g["sentences"]) + f", 나누기 다름 {g['sentences']['split_mismatch']}"
            out.append(
                f"| {pack} | {g['overlap']} | {kap(g['answered'])} | {sen} | {kap(g['items_all_supported'])} | {fk} |"
            )
        out += [
            "",
            "- 실패 유형 괄호는 (A가 참 · B가 참) 건수. 둘 다 한 값만 내면 κ는 '-'(정의 안 됨)예요.",
        ]
    if s["e4"]:
        e = s["e4"]["A"]
        out += [
            "",
            "**E4 단일 vs 다중** (판정자 A, 두 순서가 같은 쪽을 고른 것만 '이김')",
            "",
            "| 질문 | 두 순서 다 판정 | 다중 이김 | 단일 이김 | 비김 | 순서 영향 | 다중 승률 | 공종 덮음 평균(단일 · 다중) |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
            (
                f"| {e['questions']} | {e['complete']} | {e['win_multi']} | {e['win_single']} | {e['tie']} | "
                f"{e['order_effect']} | {pct(e['multi_win_rate'])} | "
                f"{e['parts_covered_mean']['단일']} · {e['parts_covered_mean']['다중']} |"
            ),
        ]
    for field, title in (("before_after", "e3_c → e3_c2"), ("before_after_c3", "e3_c2 → e3_c3")):
        if not s.get(field):
            continue
        out += [
            "",
            f"**E3 개선 전후** (같은 판정자 · 같은 질문, {title})",
            "",
            (
                "| 판정자 | 짝 | 핵심에 답함 yes 전 → 뒤 | 나아짐 · 같음 · 나빠짐 | 문장 받침 전 → 뒤 "
                "| 핵심 놓침 전 → 뒤(고침 · 새로) | 읽기 어려움 전 → 뒤 | 근거 없음 전 → 뒤 | 이제 '모름'(그 판정) |"
            ),
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for j, b in s[field].items():
            if not b.get("pairs"):
                continue
            f = b["fail"]
            unk = ", ".join(f"{k} {v}" for k, v in b["now_unknown_answered"].items())
            out.append(
                f"| {j} | {b['pairs']} | {pct(b['yes_before'])} → {pct(b['yes_after'])} "
                f"| {b['better']} · {b['same']} · {b['worse']} "
                f"| {pct(b['supported_before'])} → {pct(b['supported_after'])} "
                f"| {f['missed_point']['before']} → {f['missed_point']['after']}"
                f"({f['missed_point']['fixed']} · {f['missed_point']['new']}) "
                f"| {f['hard_to_read']['before']} → {f['hard_to_read']['after']} "
                f"| {f['unsupported']['before']} → {f['unsupported']['after']} | {b['now_unknown']} ({unk}) |"
            )
    if s.get("d_vs_abc"):
        out += [
            "",
            "**E3-D(LLM 흉내) vs A · B · C** (같은 30문항, 판정자별)",
            "",
            "| 판정자 | 방식 | 항목 | 핵심에 답함 yes | yes + partial | 문장 받침 | 핵심 놓침 | 근거 없음 | 읽기 어려움 | 지어낸 숫자 |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for j, g in s["d_vs_abc"].items():
            for v, r in g["per_variant"].items():
                out.append(
                    f"| {j} | {v} | {r['n']} | {pct(r['yes'])} | {pct(r['yes_or_partial'])} | {pct(r['supported'])} "
                    f"| {r['missed_point']} | {r['unsupported']} | {r['hard_to_read']} | {r['made_up_number']} |"
                )
            c = g["d_vs_c"]
            out.append(
                f"| {j} | D vs C | {g['questions']} | D가 나음 {c.get('d_better', 0)} · 같음 {c.get('same', 0)} "
                f"· C가 나음 {c.get('d_worse', 0)} | | | | | | |"
            )
        out += [
            "",
            "- D는 하위 에이전트가 LLM 역할을 흉내 낸 값이에요(유료 0회). 실제 공급자 모델 품질로 말하지 않아요.",
        ]
    if s["missing"]:
        out += ["", f"- 아직 없는 판정 파일(건너뜀): {', '.join(s['missing'])}"]
    return "\n".join(out) + "\n"


def write_doc(path: Path, md: str) -> bool:
    if not path.exists():
        return False
    t = path.read_text(encoding="utf-8")
    m = re.search(re.escape(MARK_START) + r".*?" + re.escape(MARK_END), t, flags=re.DOTALL)
    if not m:
        return False
    path.write_text(
        t[: m.start()] + f"{MARK_START}\n{md}{MARK_END}" + t[m.end() :], encoding="utf-8"
    )
    return True


def main(argv: list[str] | None = None) -> dict:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, default=HERE / "judge_results")
    ap.add_argument("--packs", type=Path, default=HERE / "judge_packs")
    ap.add_argument("--out", type=Path, default=HERE / "results")
    ap.add_argument("--doc", action="store_true", help="b5.md 판정 결과 칸(표시 줄 사이)을 바꾼다")
    ap.add_argument(
        "--doc-path", type=Path, default=ROOT / "docs" / "v3" / "verification" / "b5.md"
    )
    a = ap.parse_args(argv)
    s = summarize(a.results, a.packs)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "judge_summary.json").write_text(
        json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    md = to_md(s)
    (a.out / "judge_summary.md").write_text(md, encoding="utf-8")
    print(md)
    if a.doc:
        print(
            "b5.md 바꿈" if write_doc(a.doc_path, md) else "b5.md 표시 줄을 찾지 못해 그대로 둠",
            file=sys.stderr,
        )
    return s


if __name__ == "__main__":
    main()
