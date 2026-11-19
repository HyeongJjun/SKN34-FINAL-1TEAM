"""E3-D 출력 검사: LLM 역할 하위 에이전트가 쓴 답을 제품 LLM 모드와 똑같이 거른다(숫자 대조 · 인용 · 개인정보 가림 · 지시문 새기).

    cd backend && uv run --no-sync python ../evaluation/v3/llm_sim/check_outputs.py            # 검사 · 요약
    cd backend && uv run --no-sync python ../evaluation/v3/llm_sim/check_outputs.py --pack     # + 채점 묶음 judge_packs/e3d_dev.jsonl

- 입력: llm_sim/e3d_inputs.jsonl · llm_sim/e3d_outputs.jsonl(한 줄 = {"pid", "tid", "output": {"sentences": [{"text", "cites"}]}})
- 몫마다 llm_mode.rewrite와 같은 검사: 출력 모양(LlmSection) → 4문장까지 → check.section(근거 · 계산 글 · 질문의 숫자만,
  보인 근거 번호만 인용, 개인정보 가림, 지시문 30자 새기 금지). 남은 문장이 없거나 출력이 없으면 그 몫은 무료 답 그대로(제품과 같음).
- 출력: llm_sim/e3d_checked.jsonl(문항별 최종 답 · 몫별 결과) · results/e3d_check.json(요약)
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from common import RESULTS, jsonl, utf8_stdout
from pydantic import ValidationError

from app.agent.v3 import check, llm_mode
from app.agent.v3.schemas import Section, Sentence

PACKS = HERE.parent / "judge_packs"


def check_task(task: dict, out: dict | None) -> dict:
    """제품 rewrite()와 같은 순서로 거른다. 돌려줌: 남은 문장 · 떨어진 이유 · 무료 답으로 돌아갔는지."""
    if out is None:
        return {"status": "no_output", "sentences": None, "dropped": []}
    try:
        got = llm_mode.LlmSection.model_validate(out)
    except ValidationError as e:
        return {"status": "bad_schema", "sentences": None, "dropped": [str(e.errors()[0]["msg"])]}
    new = Section(
        title="", source="llm", route="trade",
        sentences=[Sentence(text=x.text, cites=x.cites) for x in got.sentences][:4],
    )  # fmt: skip
    evidence = {e["ref"]: e["text"] for e in task["evidence"]}
    allowed = "\n".join([*evidence.values(), task["calc"], task["question_masked"]])
    masked = sum(check.mask(x.text) != x.text for x in new.sentences)
    kept, dropped = check.section(
        new,
        allowed,
        calc_text=task["calc"],
        shown=set(evidence) | set(task["free_cites"]),
        prompt=task["system"],
    )
    if kept is None:
        return {"status": "all_dropped", "sentences": None, "dropped": dropped, "masked": masked}
    cites_before = sum(len(x.cites) for x in new.sentences)
    cites_after = sum(len(x.cites) for x in kept.sentences)
    return {
        "status": "kept" if not dropped else "partly_dropped",
        "sentences": [{"text": x.text, "cites": x.cites} for x in kept.sentences],
        "dropped": dropped,
        "masked": masked,
        "cites_dropped": cites_before - cites_after,
    }


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", type=Path, default=HERE / "e3d_inputs.jsonl")
    ap.add_argument("--outputs", type=Path, default=HERE / "e3d_outputs.jsonl")
    ap.add_argument(
        "--pack",
        action="store_true",
        help="최종 답으로 채점 묶음 judge_packs/e3d_dev.jsonl을 만든다",
    )
    a = ap.parse_args()
    rows = jsonl(a.inputs)
    outs = {}
    bad_lines = 0
    if a.outputs.exists():
        for r in jsonl(a.outputs):
            if isinstance(r, dict) and "pid" in r and "tid" in r:
                outs[(r["pid"], r["tid"])] = r.get("output")
            else:
                bad_lines += 1
    status, reasons = Counter(), Counter()
    checked, cites_dropped, masked = [], 0, 0
    for r in rows:
        results, final = {}, []
        for t in r["tasks"]:
            res = check_task(t, outs.get((r["pid"], t["tid"])))
            results[t["tid"]] = res
            status[res["status"]] += 1
            reasons.update(x.split(":")[0] for x in res["dropped"])
            cites_dropped += res.get("cites_dropped", 0)
            masked += res.get("masked", 0)
        tasks = {t["tid"]: t for t in r["tasks"]}
        for s in r["slots"]:
            if s["kind"] == "task":
                res = results[s["tid"]]
                sents = res["sentences"] or [
                    {"text": x, "cites": []} for x in tasks[s["tid"]]["free_sentences"]
                ]
                final.append(
                    {
                        "title": s["title"],
                        "source": "llm" if res["sentences"] else "free",
                        "sentences": sents,
                    }
                )
            else:
                final.append(
                    {"title": s["title"], "source": s["source"], "sentences": s["sentences"]}
                )
        checked.append(
            {
                "pid": r["pid"],
                "question": r["question"],
                "answer": final,
                "unknown": r["unknown"],
                "tasks": results,
            }
        )
    (HERE / "e3d_checked.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in checked) + "\n", encoding="utf-8"
    )
    n = sum(status.values())
    summary = {
        "questions": len(rows),
        "tasks": n,
        "outputs_found": n - status["no_output"],
        "status": dict(status),
        "llm_kept_rate": round((status["kept"] + status["partly_dropped"]) / n, 3) if n else None,
        "fallback_to_free": status["no_output"] + status["bad_schema"] + status["all_dropped"],
        "dropped_reasons": dict(reasons.most_common()),
        "cites_dropped": cites_dropped,
        "pii_masked_sentences": masked,
        "bad_output_lines": bad_lines,
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "e3d_check.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    if a.pack:
        key = {r["pid"]: r["qid"] for r in jsonl(HERE / "e3d_key.jsonl")}
        qid_of = {r["pid"]: r["qid"] for r in jsonl(PACKS / "e3_abc_dev_key.jsonl")}
        meta: dict[str, dict] = {}
        for r in jsonl(PACKS / "e3_abc_dev.jsonl"):
            meta.setdefault(
                qid_of[r["pid"]],
                {k: r[k] for k in ("expect", "trade", "kind", "route", "must") if k in r},
            )
        ev = {r["pid"]: {e["ref"]: e for t in r["tasks"] for e in t["evidence"]} for r in rows}
        items = []
        for c in checked:
            text = (
                " ".join(x["text"] for s in c["answer"] for x in s["sentences"])
                + " "
                + " ".join(c["unknown"])
            )
            evidence = [
                {
                    "ref": k,
                    "source": e.get("source", ""),
                    "kind": e.get("kind", ""),
                    "text": e["text"][:500],
                }
                for k, e in list(ev[c["pid"]].items())[:6]
            ]
            items.append({"pid": c["pid"], "question": c["question"], "answer": text.strip(), "evidence": evidence,
                          **meta.get(key[c["pid"]], {"expect": "answer"})})  # fmt: skip
        (PACKS / "e3d_dev.jsonl").write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in items) + "\n", encoding="utf-8"
        )
        (PACKS / "e3d_dev_key.jsonl").write_text(
            "\n".join(
                json.dumps({"pid": p, "qid": q, "variant": "D"}, ensure_ascii=False)
                for p, q in key.items()
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"채점 묶음: judge_packs/e3d_dev.jsonl {len(items)}항목 (+ 열쇠)")


if __name__ == "__main__":
    main()
