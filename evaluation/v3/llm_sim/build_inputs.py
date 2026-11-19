"""E3-D(LLM 모드 가늠) 입력 만들기: 방식 비교 30문항(dev)에 LLM 모드가 실제로 보낼 지시문 · 자료 · 출력 모양을 그대로 담는다.

    cd backend && uv run --no-sync python ../evaluation/v3/llm_sim/build_inputs.py

- 제품 코드를 그대로 돌린다: run_turn(mode="llm")에서 llm_mode.rewrite가 llm.structured에 넘기는 messages를 가로채 적고,
  LLM 호출은 실패로 돌려 무료 답으로 떨어지게 한다(유료 호출 0, LLM_LIVE=false).
- 출력: llm_sim/e3d_inputs.jsonl(문항마다 한 줄: 답 자리 slots · 다시 쓸 몫 tasks · 출력 모양) · llm_sim/e3d_key.jsonl(pid → qid)
- LLM 역할 하위 에이전트는 README.md대로 tasks마다 출력 한 줄을 쓰고, check_outputs.py가 제품 출력 검사로 거른다.
"""

import asyncio
import json
import random
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from common import ROOT, jsonl, utf8_stdout
from kb3 import TODAY, bank, kb

from app.agent import llm
from app.agent.v3 import llm_mode
from app.agent.v3 import turn as turn_mod
from app.agent.v3.schemas import TurnContext

PACKS = HERE.parent / "judge_packs"
RAG = [ROOT / "evaluation/rag/questions.jsonl", ROOT / "evaluation/rag/questions_300.jsonl"]
SEED = 20261120
SCHEMA = llm_mode.LlmSection.model_json_schema()


def main() -> None:
    utf8_stdout()
    K = kb()
    qtext = {q["id"]: q["text"] for q in bank()} | {
        q["id"]: q["text"] for p in RAG for q in jsonl(p)
    }
    qids = list(dict.fromkeys(r["qid"] for r in jsonl(PACKS / "e3_abc_dev_key.jsonl")))
    rnd = random.Random(SEED)
    captured: list[dict] = []
    original = llm_mode.rewrite

    async def fake_structured(role, schema, messages, *a, **k):  # LLM 대신: 보낼 messages만 적는다
        captured[-1]["messages"] = [list(m) for m in messages]
        captured[-1]["role"] = role
        raise llm.LLMError("e3d: 가로챔")

    async def spy(sec, *, route, question, evidence, calc):
        captured.append(
            {"sec": sec, "route": route, "question": question, "evidence": evidence, "calc": calc}
        )
        return await original(sec, route=route, question=question, evidence=evidence, calc=calc)

    llm.structured = fake_structured  # type: ignore[assignment]
    llm_mode.rewrite = spy  # type: ignore[assignment]
    rows, keys = [], []
    for qid in qids:
        captured.clear()
        ctx = TurnContext(user_id=uuid.uuid4(), today=TODAY, mode="llm")
        res = asyncio.run(turn_mod.run_turn(qtext[qid], ctx, kb=K))
        tasks, sig = [], {}
        for n, c in enumerate(x for x in captured if "messages" in x):
            tid = f"t{n + 1}"
            sec = c["sec"]
            sig[tuple(s.text for s in sec.sentences)] = tid
            tasks.append({
                "tid": tid, "route": c["route"], "prompt_version": llm_mode.VERSION[c["route"]],
                "system": c["messages"][0][1], "user": c["messages"][1][1],
                "evidence": [{"ref": r, "text": t, "source": K.ix.by_ref[r].doc.title[:60], "kind": K.ix.by_ref[r].doc.kind}
                             for r, t in c["evidence"].items()],
                "free_sentences": [s.text for s in sec.sentences],
                "free_cites": sorted({x for s in sec.sentences for x in s.cites}),
                "calc": c["calc"], "question_masked": c["question"],
            })  # fmt: skip
        slots = []
        for s in res.answer.sections:
            tid = sig.get(tuple(x.text for x in s.sentences))
            if tid:
                slots.append({"kind": "task", "tid": tid, "title": s.title})
            else:
                slots.append({"kind": "keep", "title": s.title, "source": s.source,
                              "sentences": [{"text": x.text, "cites": x.cites} for x in s.sentences]})  # fmt: skip
        pid = f"d{rnd.randrange(16**8):08x}"
        rows.append({
            "pid": pid, "question": qtext[qid],
            "context": {"mode": "llm", "screen": None, "project": "없음(프로젝트 없이 묻는 일반 질문 · 계산 결과 없음)",
                        "route": res.answer.trace.route},
            "slots": slots, "unknown": res.answer.unknown, "tasks": tasks, "output_schema": SCHEMA,
        })  # fmt: skip
        keys.append({"pid": pid, "qid": qid})
    rnd.shuffle(rows)
    for name, data in (("e3d_inputs", rows), ("e3d_key", keys)):
        (HERE / f"{name}.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in data) + "\n", encoding="utf-8"
        )
    n_tasks = sum(len(r["tasks"]) for r in rows)
    print(
        f"e3d_inputs {len(rows)}문항 · 다시 쓸 몫 {n_tasks}개 · 몫 없음(정해 둔 글 · 높은 카드만) {sum(not r['tasks'] for r in rows)}문항"
    )


if __name__ == "__main__":
    main()
