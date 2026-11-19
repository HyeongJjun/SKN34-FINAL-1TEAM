"""E3-D 실제판: LLM 모드가 보낼 지시문 · 근거를 그대로 Claude 모델별로 보내 답을 받아요(유료, 사용자 허락 2026-11-19).

    cd backend && uv run --no-sync --with anthropic python ../evaluation/v3/llm_live/run_claude.py --limit 1
    cd backend && uv run --no-sync --with anthropic python ../evaluation/v3/llm_live/run_claude.py
    cd backend && uv run --no-sync --with anthropic python ../evaluation/v3/llm_live/run_claude.py --report-only

- 입력: llm_sim/e3d_inputs.jsonl의 몫(task) 18개. `llm_mode.rewrite`가 LLM에 보낼 system · user 원문 그대로예요.
- 모델: --models(기본 Opus 5.5 · Sonnet 5.5 · Haiku 5.5). 모두 같은 생각 강도(effort medium)로 견줘요.
- 거르기: llm_sim/check_outputs.py의 `check_task`(제품 LLM 모드와 같은 검사: 출력 모양 → 4문장 → 숫자 · 인용 · 개인정보 · 지시문 새기)
- 출력: runs/<모델>/{outputs,usage}.jsonl · report.md(질문별 답 · 모델별 비용) · ../results/claude_live.json(요약).
  e3d 흉내 결과 파일은 건드리지 않아요. 이미 받은 몫은 건너뛰어요.
- 키: --env-file의 ANTHROPIC_API_KEY 한 줄만 이 프로세스에 넣어요. 값은 어디에도 찍지 않아요.
- 비용: 부를 때마다 응답 usage로 비용을 더하고, 모든 모델 합이 상한(--budget, 기본 2달러)을 넘기 전에 멈춰요.
- 제품 코드(app/agent/llm.py, OpenAI 공급자)는 바꾸지 않아요. 이 스크립트는 평가용이에요.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SIM = HERE.parent / "llm_sim"
RUNS = HERE / "runs"
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(SIM))

from check_outputs import check_task
from common import RESULTS, jsonl, utf8_stdout

MAIN_ENV = Path(r"C:\Workspace\SKN34\SKN34-FINAL-1TEAM\.env")
MODELS = ("claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5")
NAMES = {
    "claude-opus-5-5": "Opus 5.5",
    "claude-sonnet-5-5": "Sonnet 5.5",
    "claude-haiku-5-5": "Haiku 5.5",
}
EFFORT = "medium"  # 세 모델 모두 같게(Opus · Haiku 기본값, Sonnet 기본은 high)
FALLBACK_BETA = "server-side-fallback-2026-07-01"
FALLBACK_OK = {"claude-opus-5-5", "claude-sonnet-5-5"}  # Haiku 5.5는 서버 fallback이 없어요
# 가격(달러 / 100만 토큰). claude-api 스킬 모델 표(2026-11-03 캐시). 생각 토큰은 출력 토큰으로 매겨요
PRICE = {
    "claude-opus-5-5": {"in": 4.00, "out": 20.00, "cache_read": 0.20},
    "claude-sonnet-5-5": {"in": 2.00, "out": 10.00, "cache_read": 0.10},
    "claude-haiku-5-5": {"in": 0.10, "out": 0.50, "cache_read": 0.0},  # 10만 토큰 이하 프롬프트 값
}

# 제품 LlmSection과 같은 모양(구조화 출력은 additionalProperties: false가 필요해요)
SCHEMA = {
    "type": "object",
    "properties": {
        "sentences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "cites": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "cites"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["sentences"],
    "additionalProperties": False,
}


def load_key(env_file: Path) -> None:
    """env 파일에서 키 한 줄만 읽어 이 프로세스 환경에 넣어요(값은 찍지 않아요)."""
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("ANTHROPIC_API_KEY="):
            value = line.split("=", 1)[1].split(" #")[0].strip().strip('"').strip("'")
            if value:
                os.environ["ANTHROPIC_API_KEY"] = value
                return
    sys.exit(f"{env_file}에서 ANTHROPIC_API_KEY를 찾지 못했어요")


def cost_usd(model: str, usage) -> float | None:
    p = PRICE.get(model)
    if p is None:
        return None
    read = getattr(usage, "cache_read_input_tokens", 0) or 0
    return (
        usage.input_tokens * p["in"] + usage.output_tokens * p["out"] + read * p["cache_read"]
    ) / 1e6


def ask(client, model: str, task: dict):
    params = {
        "model": model,
        "max_tokens": 16000,
        "system": task["system"],
        "messages": [{"role": "user", "content": task["user"]}],
        "output_config": {"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
    }
    if model not in FALLBACK_OK:
        return client.messages.create(**params)
    # 안전 이유로 거절되면 서버가 다른 모델로 이어 답해요(Opus 5.5 · Sonnet 5.5 권장 설정)
    try:
        return client.beta.messages.create(**params, betas=[FALLBACK_BETA], fallbacks="default")
    except TypeError:  # 깔린 SDK가 아직 fallbacks 인자를 모르면 같은 값을 본문으로 보내요
        return client.beta.messages.create(
            **params, betas=[FALLBACK_BETA], extra_body={"fallbacks": "default"}
        )


def run_model(
    client, anthropic, model: str, rows: list[dict], limit: int | None, budget: float, spent: float
):
    """한 모델로 아직 안 받은 몫을 불러요. 돌려줌: 늘어난 비용 합 · 멈춘 이유(없으면 None)."""
    d = RUNS / model
    d.mkdir(parents=True, exist_ok=True)
    out_path, use_path = d / "outputs.jsonl", d / "usage.jsonl"
    done = {(r["pid"], r["tid"]) for r in jsonl(out_path)} if out_path.exists() else set()
    called = 0
    for r in rows:
        for t in r["tasks"]:
            if (r["pid"], t["tid"]) in done:
                continue
            if limit is not None and called >= limit:
                return spent, None
            if spent + 0.05 > budget:
                return spent, f"비용 상한 가까이 와서 멈춰요: 모든 모델 합 {spent:.4f}달러"
            t0 = time.perf_counter()
            try:
                resp = ask(client, model, t)
            except anthropic.AuthenticationError:
                sys.exit("키가 맞지 않아요(401). 다른 모델도 멈춰요")
            except anthropic.PermissionDeniedError:
                return spent, "이 키로는 이 모델을 쓸 수 없어요(403)"
            except anthropic.NotFoundError:
                return spent, "모델을 찾지 못했어요(404)"
            except anthropic.BadRequestError as e:
                return spent, f"요청이 거절됐어요(400): {e.message}"
            except anthropic.RateLimitError:
                return spent, "요청 한도에 걸렸어요(429). 조금 뒤 다시 돌려요"
            except anthropic.APIStatusError as e:
                return spent, f"API 오류({e.status_code}): {e.message}"
            except anthropic.APIConnectionError:
                return spent, "API에 닿지 못했어요(네트워크)"
            secs = round(time.perf_counter() - t0, 2)
            called += 1
            fallback = any(b.type == "fallback" for b in resp.content) or any(
                getattr(x, "type", "") == "fallback_message"
                for x in (getattr(resp.usage, "iterations", None) or [])
            )
            text = next((b.text for b in resp.content if b.type == "text"), "")
            try:
                output = (
                    json.loads(text) if resp.stop_reason not in ("refusal", "max_tokens") else None
                )
            except json.JSONDecodeError:
                output = None
            c = None if fallback else cost_usd(resp.model, resp.usage)
            spent += c or 0
            with out_path.open("a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {"pid": r["pid"], "tid": t["tid"], "output": output}, ensure_ascii=False
                    )
                    + "\n"
                )
            row = {
                "pid": r["pid"],
                "tid": t["tid"],
                "model_requested": model,
                "model": resp.model,
                "request_id": resp._request_id,
                "stop_reason": resp.stop_reason,
                "input_tokens": resp.usage.input_tokens,
                "output_tokens": resp.usage.output_tokens,
                "cache_read_input_tokens": getattr(resp.usage, "cache_read_input_tokens", 0) or 0,
                "cache_creation_input_tokens": getattr(resp.usage, "cache_creation_input_tokens", 0)
                or 0,
                "fallback": fallback,
                "cost_usd": c,
                "seconds": secs,
            }
            with use_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"{NAMES.get(model, model)} {r['pid']}: {resp.stop_reason} · 입력 {row['input_tokens']} · "
                  f"출력 {row['output_tokens']} · {c if c is not None else '?'}달러 · {secs}초")  # fmt: skip
    return spent, None


def total_spent() -> float:
    return sum(u.get("cost_usd") or 0 for p in RUNS.glob("*/usage.jsonl") for u in jsonl(p))


def report(rows: list[dict], models: list[str], notes: dict[str, str]) -> dict:
    """모델별 검사 결과 · 비용 요약과 질문별 답 비교(report.md)를 만들어요."""
    sim = {(x["pid"], x["tid"]): x.get("output") for x in jsonl(SIM / "e3d_outputs.jsonl")}
    per_model, answers = {}, {}
    for m in models:
        d = RUNS / m
        outs = (
            {(x["pid"], x["tid"]): x["output"] for x in jsonl(d / "outputs.jsonl")}
            if (d / "outputs.jsonl").exists()
            else {}
        )
        usage = jsonl(d / "usage.jsonl") if (d / "usage.jsonl").exists() else []
        status = Counter()
        for r in rows:
            for t in r["tasks"]:
                key = (r["pid"], t["tid"])
                if key not in outs:
                    continue
                res = check_task(t, outs[key])
                status[res["status"]] += 1
                answers.setdefault(key, {})[m] = res
        n = len(usage)
        per_model[m] = {
            "calls": n,
            "models_served": dict(Counter(u["model"] for u in usage)),
            "input_tokens": sum(u["input_tokens"] for u in usage),
            "output_tokens": sum(u["output_tokens"] for u in usage),
            "cost_usd": round(sum(u["cost_usd"] or 0 for u in usage), 4),
            "cost_per_call_usd": round(sum(u["cost_usd"] or 0 for u in usage) / n, 5)
            if n
            else None,
            "cost_unknown_calls": sum(u["cost_usd"] is None for u in usage),
            "fallback_calls": sum(u["fallback"] for u in usage),
            "seconds_avg": round(sum(u["seconds"] for u in usage) / n, 2) if n else None,
            "check_status": dict(status),
            "price_per_mtok": PRICE.get(m),
            "note": notes.get(m),
        }
    summary = {
        "effort": EFFORT,
        "models": per_model,
        "cost_usd_total": round(sum(v["cost_usd"] for v in per_model.values()), 4),
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "claude_live.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    def sents(res_or_out) -> str:
        if not res_or_out:
            return "(없음)"
        ss = res_or_out.get("sentences") or []
        return " ".join(s["text"] for s in ss) or "(없음)"

    lines = [
        "# Claude 모델별 시험 결과",
        "",
        f"- 생각 강도 `effort: {EFFORT}` · 질문 18개(E3-D 묶음) · 제품과 같은 출력 검사",
        "",
    ]
    lines += [
        "| 모델 | 부른 수 | 입력 토큰 | 출력 토큰 | 비용(달러) | 1번 평균 | 평균 초 | 검사 결과 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for m, v in per_model.items():
        lines.append(
            f"| {NAMES.get(m, m)} (`{m}`) | {v['calls']} | {v['input_tokens']:,} | {v['output_tokens']:,} | {v['cost_usd']:.4f} | "
            f"{v['cost_per_call_usd'] if v['cost_per_call_usd'] is not None else '-'} | {v['seconds_avg'] or '-'} | "
            f"{', '.join(f'{k} {c}' for k, c in v['check_status'].items()) or '-'} |"
        )
    lines += ["", f"- 합계 {summary['cost_usd_total']:.4f}달러", ""]
    for i, r in enumerate((r for r in rows if r["tasks"]), 1):
        t = r["tasks"][0]
        key = (r["pid"], t["tid"])
        lines += [
            f"## {i}. {r['question']}",
            "",
            f"- 무료 모드: {' '.join(t['free_sentences']) or '(없음)'}",
            f"- 흉내(하위 에이전트): {sents(sim.get(key))}",
        ]
        for m in models:
            res = answers.get(key, {}).get(m)
            if res is None:
                lines.append(f"- {NAMES.get(m, m)}: (안 부름)")
            elif res["sentences"]:
                drop = f" · 떨어진 문장 {len(res['dropped'])}" if res["dropped"] else ""
                lines.append(f"- {NAMES.get(m, m)}: {sents(res)} ({res['status']}{drop})")
            else:
                lines.append(
                    f"- {NAMES.get(m, m)}: 검사에서 모두 떨어져 무료 답을 그대로 써요 ({res['status']}: {'; '.join(res['dropped'])[:160]})"
                )
        lines.append("")
    (HERE / "report.md").write_text("\n".join(lines), encoding="utf-8")
    return summary


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=",".join(MODELS), help="쉼표로 나눈 모델 id")
    ap.add_argument(
        "--env-file", type=Path, default=MAIN_ENV, help="ANTHROPIC_API_KEY가 든 env 파일"
    )
    ap.add_argument("--limit", type=int, default=None, help="모델마다 이번에 새로 부를 몫 수")
    ap.add_argument("--budget", type=float, default=2.00, help="모든 모델 합 비용 상한(달러)")
    ap.add_argument(
        "--report-only", action="store_true", help="부르지 않고 report.md · 요약만 다시 만들어요"
    )
    a = ap.parse_args()
    models = [m.strip() for m in a.models.split(",") if m.strip()]
    rows = jsonl(SIM / "e3d_inputs.jsonl")
    notes: dict[str, str] = {}
    if not a.report_only:
        import anthropic

        load_key(a.env_file)
        client = anthropic.Anthropic()
        spent = total_spent()
        for m in models:
            spent, note = run_model(client, anthropic, m, rows, a.limit, a.budget, spent)
            if note:
                notes[m] = note
                print(f"{NAMES.get(m, m)}: {note}")
    print(json.dumps(report(rows, models, notes), ensure_ascii=False))


if __name__ == "__main__":
    main()
