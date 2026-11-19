"""초보 말투 열쇠 달기 (사용자 요청 2026-11-19, 고칠 것 1번). LLM · DB 없음.

    cd backend && uv run --no-sync python ../evaluation/v3/beginner_keys.py candidates   # 후보 파일 만들기
    cd backend && uv run --no-sync python ../evaluation/v3/beginner_keys.py apply        # 고른 짝을 카드 열쇠에 더하기

- candidates: 초보 질문 중 dev만(heldout은 손대지 않아요) 질문마다 가장 가까운 카드 후보를 적어요.
  - 후보: 모든 공종에서 5장 + 질문 공종 · 공통에서 3장, 중복 빼고
  - → data/v3/questions/beginner_web/card_candidates_dev.jsonl
- apply: 사람(하위 에이전트)이 고른 짝 파일 card_keys_dev.jsonl을 읽어요.
  - 한 줄 모양: {"qid", "card_id" 또는 null, "why"}
  - 고른 카드의 keys 끝에 질문 글을 더해요(카드당 12개까지, 같은 글은 빼요).
  - 카드 판(version)은 그대로예요. 열쇠는 맞추기용이고 답 글은 바뀌지 않아요.
"""

import json
import sys
from collections import defaultdict

from common import ROOT, jsonl, utf8_stdout

from app.knowledge import cards

DIR = ROOT / "data/v3/questions/beginner_web"
CARD_DIR = ROOT / "backend/app/agent/cards"
MAX_KEYS = 12


def candidates() -> None:
    cs = cards.default()
    out = []
    for q in jsonl(DIR / "questions.jsonl"):
        if q["split"] != "dev":
            continue
        tr = None if q["trade"] == "common" else [q["trade"]]
        seen, cand = set(), []
        for m in cards.find(cs, q["text"], k=5) + cards.find(cs, q["text"], trades=tr, k=3):
            if m.card.id in seen:
                continue
            seen.add(m.card.id)
            cand.append({
                "card_id": m.card.id, "trade": m.card.trade, "kind": m.card.kind, "score": m.score,
                "keys": m.card.keys[:4], "answer": " ".join(s.text for s in m.card.answer)[:320],
            })  # fmt: skip
        out.append(
            {
                "qid": q["id"],
                "trade": q["trade"],
                "question": q["text"],
                "expect": q.get("expect"),
                "candidates": cand,
            }
        )
    (DIR / "card_candidates_dev.jsonl").write_text(
        "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in out), encoding="utf-8"
    )
    print(f"dev 질문 {len(out)}개 후보 → {DIR.relative_to(ROOT)}/card_candidates_dev.jsonl")


def overlap(a: str, b: str) -> float:
    """글자 두 개 묶음 자카드(공백 뺌)."""
    ga, gb = (
        {s[i : i + 2] for i in range(len(s) - 1)} for s in (a.replace(" ", ""), b.replace(" ", ""))
    )
    return len(ga & gb) / max(len(ga | gb), 1)


def apply() -> None:
    qtext = {q["id"]: q["text"] for q in jsonl(DIR / "questions.jsonl") if q["split"] == "dev"}
    picks = defaultdict(list)
    for p in jsonl(DIR / "card_keys_dev.jsonl"):
        if p.get("card_id") and p["qid"] in qtext:  # heldout · 모르는 id는 건너뛰어요
            picks[p["card_id"]].append(qtext[p["qid"]])
    # 열쇠는 모든 카드에서 하나뿐이어야 해요(cards_check · test_v3_agent_cards). 이미 어딘가 있으면 건너뛰어요
    used = {k.strip() for c in cards.default().cards for k in c.keys}
    added, full, dup, missing = 0, [], [], set(picks)
    for f in sorted(CARD_DIR.glob("*.jsonl")):
        rows, changed = [], False
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            c = json.loads(line)
            if c["id"] in picks:
                missing.discard(c["id"])
                # 자리가 모자라면 있는 열쇠와 가장 덜 겹치는 질문부터 넣어요(새 말투를 더 넓게 덮게)
                for t in sorted(
                    picks[c["id"]], key=lambda t: max((overlap(t, k) for k in c["keys"]), default=0)
                ):
                    if t.strip() in used:
                        dup.append((c["id"], t))
                        continue
                    if len(c["keys"]) >= MAX_KEYS:
                        full.append((c["id"], t))
                        continue
                    c["keys"].append(t)
                    used.add(t.strip())
                    added += 1
                    changed = True
            rows.append(json.dumps(c, ensure_ascii=False))
        if changed:
            f.write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(
        f"열쇠 {added}개 더함 · 카드 {len(picks) - len(missing)}장 · 자리 없어 못 넣음 {len(full)} · "
        f"이미 있는 열쇠 {len(dup)} · 없는 카드 {sorted(missing)}"
    )
    for cid, t in full:
        print(f"  자리 없음: {cid} ← {t}")
    for cid, t in dup:
        print(f"  이미 있음: {cid} ← {t}")


if __name__ == "__main__":
    utf8_stdout()
    {"candidates": candidates, "apply": apply}[sys.argv[1]]()
