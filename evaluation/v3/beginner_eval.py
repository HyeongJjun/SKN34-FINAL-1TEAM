"""초보 고객 질문 227개(data/v3/questions/beginner_web) 무료 모드 평가 (사용자 요청 2026-11-19). LLM · DB 없음(무료).

    cd backend && uv run --no-sync python ../evaluation/v3/beginner_eval.py

- 답: 지금 제품 코드(run_turn, 무료 모드 C)로 질문마다 한 번 돌려요. 프로젝트 없는 일반 질문으로 물어요.
- 코드 검사(이상한 곳 찾기)
  - 길(route) · 공종 분포, 기대(expect)별 처리
    - 범위 밖이면 out_of_scope 길로 가야 해요.
    - 되묻기면 되묻기 칸 · 정책 글 · '확인하지 못했어요' 중 하나가 있어야 해요.
  - 내용 없음: 카드 · 조각 묶음이 하나도 없음
  - 공종 어긋남: 질문 공종(공통 빼고)과 다른 공종 묶음만 나옴
  - 글 이상: 코드 말(None · undefined · dobae 같은 영어 값), 해요체가 아닌 끝(-다. · -니다.), 같은 문장 되풀이,
    600자 넘는 답, 빈 문장
- 출력
  - results/beginner_eval.json(요약, by_split에 dev · heldout 따로) · results/beginner_answers.jsonl(질문별 답 · 흔적 · 검사)
  - judge_packs/beginner_all.jsonl + beginner_all_key.jsonl(뜻 채점 묶음, rubric.md 판 2와 같은 모양)
"""

import asyncio
import json
import random
import re
import uuid
from collections import Counter, defaultdict

from common import RESULTS, ROOT, jsonl, utf8_stdout
from judge_pack import OUT, evidence, expect_of, plain
from kb3 import TODAY, kb

from app.agent.v3.schemas import TurnContext
from app.agent.v3.turn import run_turn

SRC = ROOT / "data/v3/questions/beginner_web/questions.jsonl"
SEED = 20261119
CONTENT = {"card", "extract", "llm", "calc"}
CODE_WORD = re.compile(
    r"\b(None|null|undefined|NaN|true|false|dobae|mokgong|out_of_scope|ask_back)\b|[a-z]+_[a-z]+"
)
NOT_HAEYO = re.compile(r"(?:[^요]다|니다)[.!]?$")  # '-다.' · '-니다.'로 끝남(해요체가 아님)
LONG = 600


def record(a) -> dict:
    return {
        "sections": [
            {
                "source": s.source,
                "title": s.title,
                "route": s.route,
                "trade": s.trade,
                "sentences": [{"text": x.text, "cites": x.cites} for x in s.sentences],
            }
            for s in a.sections
        ],
        "unknown": list(a.unknown),
        "ask": a.ask.model_dump() if a.ask else None,
        "suggest": list(a.suggest),
        "trace": {
            "route": a.trace.route,
            "source": a.trace.source,
            "confidence": round(a.trace.confidence, 3),
            "trades": list(a.trace.trades),
            "policy": list(a.trace.policy),
            "cards": list(a.trace.cards),
            "chunks": list(a.trace.chunks),
        },
    }


def checks(q: dict, r: dict) -> dict:
    content = [s for s in r["sections"] if s["source"] in CONTENT and s["sentences"]]
    texts = [x["text"] for s in r["sections"] for x in s["sentences"]] + r["unknown"]
    body = " ".join(texts)
    trades = {s["trade"] for s in content if s["trade"]}
    exp = q.get("expect", "answer")
    out = {
        "has_content": bool(content),
        "unknown": bool(r["unknown"]),
        "ask": bool(r["ask"]),
        "trade_mismatch": bool(content)
        and q["trade"] != "common"
        and not (trades & {q["trade"], "common"}),
        "code_word": sorted({m.group(0) for m in CODE_WORD.finditer(body)}),
        "not_haeyo": [t for t in texts if NOT_HAEYO.search(t.strip())],
        "repeat": len(texts) != len(set(texts)),
        "long": len(body) > LONG,
        "empty_sentence": any(not t.strip() for t in texts),
        "chars": len(body),
    }
    if exp == "out_of_scope":
        out["expect_ok"] = r["trace"]["route"] == "out_of_scope"
    elif exp == "ask_back":
        out["expect_ok"] = bool(r["ask"]) or bool(r["trace"]["policy"]) or bool(r["unknown"])
    else:
        out["expect_ok"] = bool(content)
    return out


def main() -> None:
    utf8_stdout()
    rnd = random.Random(SEED)
    K = kb()
    qs = jsonl(SRC)
    qmap = {q["id"]: q for q in qs}
    rows, items, keys = [], [], []
    for q in qs:
        ctx = TurnContext(user_id=uuid.uuid4(), today=TODAY)
        r = record(asyncio.run(run_turn(q["text"], ctx, kb=K)).answer)
        c = checks(q, r)
        rows.append({"id": q["id"], "trade": q["trade"], "intent": q["intent"], "expect": q.get("expect"), "split": q["split"],
                     "question": q["text"], "answer": plain(r), "record": r, "check": c})  # fmt: skip
        pid = f"b{rnd.randrange(16**8):08x}"
        items.append(
            {
                "pid": pid,
                "question": q["text"],
                "answer": plain(r),
                "evidence": evidence(r),
                **expect_of(q["id"], qmap),
            }
        )
        keys.append(
            {
                "pid": pid,
                "qid": q["id"],
                "trade": q["trade"],
                "expect": q.get("expect"),
                "split": q["split"],
            }
        )
    rnd.shuffle(items)

    n = len(rows)
    group = lambda t: t if t in ("dobae", "common", "mokgong") else "others"
    by_trade = defaultdict(lambda: Counter())
    for x in rows:
        g = by_trade[group(x["trade"])]
        g["n"] += 1
        g["content"] += x["check"]["has_content"]
        g["unknown_only"] += x["check"]["unknown"] and not x["check"]["has_content"]
    by_expect = defaultdict(lambda: Counter())
    for x in rows:
        e = by_expect[x["expect"]]
        e["n"] += 1
        e["ok"] += x["check"]["expect_ok"]
    # dev(열쇠 · 규칙을 고를 때 본 질문) · heldout(고칠 때 안 본 질문)을 나눠서 봐요
    by_split = defaultdict(lambda: Counter())
    for x in rows:
        g = by_split[x["split"]]
        g["n"] += 1
        g["content"] += x["check"]["has_content"]
        g["unknown_only"] += x["check"]["unknown"] and not x["check"]["has_content"]
        g[f"{x['expect']}_n"] += 1
        g[f"{x['expect']}_ok"] += x["check"]["expect_ok"]
        g["repeat"] += x["check"]["repeat"]
        g["trade_mismatch"] += x["check"]["trade_mismatch"]
        g["ask_back_route"] += x["record"]["trace"]["route"] == "ask_back"
    odd = {
        "trade_mismatch": [x for x in rows if x["check"]["trade_mismatch"]],
        "code_word": [x for x in rows if x["check"]["code_word"]],
        "not_haeyo": [x for x in rows if x["check"]["not_haeyo"]],
        "repeat": [x for x in rows if x["check"]["repeat"]],
        "long": [x for x in rows if x["check"]["long"]],
        "empty_sentence": [x for x in rows if x["check"]["empty_sentence"]],
        "no_content_answer_expected": [
            x for x in rows if x["expect"] == "answer" and not x["check"]["has_content"]
        ],
        "oos_missed": [
            x for x in rows if x["expect"] == "out_of_scope" and not x["check"]["expect_ok"]
        ],
        "askback_missed": [
            x for x in rows if x["expect"] == "ask_back" and not x["check"]["expect_ok"]
        ],
    }
    summary = {
        "questions": n,
        "routes": dict(Counter(x["record"]["trace"]["route"] for x in rows).most_common()),
        "gate_source": dict(Counter(x["record"]["trace"]["source"] for x in rows).most_common()),
        "has_content": sum(x["check"]["has_content"] for x in rows),
        "unknown_only": sum(x["check"]["unknown"] and not x["check"]["has_content"] for x in rows),
        "by_trade": {k: dict(v) for k, v in by_trade.items()},
        "by_expect": {k: dict(v) for k, v in by_expect.items()},
        "by_split": {k: dict(sorted(v.items())) for k, v in sorted(by_split.items())},
        "odd_counts": {k: len(v) for k, v in odd.items()},
        "odd_examples": {
            k: [{"id": x["id"], "q": x["question"], "a": x["answer"][:160]} for x in v[:6]]
            for k, v in odd.items()
        },
        "chars_avg": round(sum(x["check"]["chars"] for x in rows) / n),
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "beginner_eval.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (RESULTS / "beginner_answers.jsonl").write_text(
        "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in rows), encoding="utf-8"
    )
    for name, data in (("beginner_all", items), ("beginner_all_key", keys)):
        (OUT / f"{name}.jsonl").write_text(
            "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in data), encoding="utf-8"
        )
    print(
        json.dumps(
            {
                k: summary[k]
                for k in (
                    "questions",
                    "routes",
                    "has_content",
                    "unknown_only",
                    "by_trade",
                    "by_expect",
                    "by_split",
                    "odd_counts",
                    "chars_avg",
                )
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
