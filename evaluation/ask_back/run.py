"""되물음 표시 eval (#120). 실제 LLM(유료)으로 상담 한 턴을 돌려 답 끝 [되물음] 비율을 잰다.

    cd backend && uv run python ../evaluation/ask_back/run.py --split dev
    cd backend && uv run python ../evaluation/ask_back/run.py --split heldout --final   # 마지막에 한 번만

- 되물어야 하는 질문(ask=true)에 붙인 비율(놓침 확인)과, 되물으면 안 되는 질문(ask=false)에 붙인 비율(남발 확인)
- 화면 도구 결과는 빈 값으로 돌려준다. 지식 검색은 '맞는 자료 없음'
- Jev는 끈다(JEV_ENABLED=false). 표시만 재고 입구 분류 비용을 쓰지 않는다
- 키는 루트 .env에서 읽고 출력하지 않는다. Redis가 켜져 있어야 한다(docker compose up -d redis)
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
KEYS = ("OPENAI_API_KEY", "OPENAI_AGENT_MODEL", "OPENAI_REASONING_EFFORT")


def _env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key in KEYS and value and key not in os.environ:
            os.environ[key] = value
    os.environ.update({"LLM_LIVE": "true", "JEV_ENABLED": "false", "APP_ENV": "local"})
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")


async def _one(text: str) -> tuple[str, bool]:
    from app.shared.clock import today_seoul
    from app.v2 import ask
    from app.v2 import schemas as v2

    out = await ask.start("eval", v2.V2AskIn(message=text), today_seoul())
    for _ in range(6):
        if out.done:
            break
        results = [
            {
                "id": c.id,
                "content": json.dumps(
                    {"enough": False, "hits": []} if c.name == "search_knowledge" else {"ok": True}
                ),
            }
            for c in out.tool_calls
        ]
        out = await ask.resume("eval", out.turn or "", v2.V2AskResumeIn(results=results))
    return out.text, bool(out.failed)


async def main(split: str) -> None:
    from app.agent import llm

    calls = [0]
    real = llm.chat_tools

    async def counted(*a, **k):
        calls[0] += 1
        return await real(*a, **k)

    llm.chat_tools = counted
    rows = [
        json.loads(x) for x in (HERE / f"{split}.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    hit = {True: [0, 0], False: [0, 0]}  # ask: [표시 붙임, 전체]
    failed = 0
    for r in rows:
        text, fail = await _one(r["text"])
        marked = "[되물음]" in text
        failed += fail
        hit[r["ask"]][0] += marked
        hit[r["ask"]][1] += 1
        ok = "O" if marked == r["ask"] else "X"
        print(f"{ok} ask={r['ask']!s:5} marked={marked!s:5} {r['text']} -> {text[-60:]!r}")
    a, n = hit[True], hit[False]
    print(
        f"\n[{split}] 되물어야 할 때 붙임 {a[0]}/{a[1]} · 붙이면 안 될 때 붙임 {n[0]}/{n[1]} · "
        f"실패 {failed} · LLM 호출 {calls[0]}회"
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--split", choices=["dev", "heldout"], default="dev")
    p.add_argument("--final", action="store_true")
    args = p.parse_args()
    if args.split == "heldout" and not args.final:
        sys.exit("held-out은 마지막에 한 번만: --final을 같이 주세요")
    _env()
    sys.path.insert(0, str(ROOT / "backend"))
    asyncio.run(main(args.split))
