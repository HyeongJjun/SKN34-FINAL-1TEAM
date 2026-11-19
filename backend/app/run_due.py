"""개발 전용 '기한 당기기' (시나리오 · e2e): 정한 시각을 '지금'으로 보고 그때까지 기한이 된 일을 다 거둔다.

    uv run python -m app.run_due --now 2026-11-21T10:00+09:00

- APP_ENV가 local · test일 때만 돈다(아니면 exit 2). 실제 시계 · DB 시각 · 행의 기한은 바꾸지 않는다.
- worker.sweep을 거둘 것이 없을 때까지 되풀이하고 kind별 결과 수를 찍는다. 실패한 일은 '지금 + 1분'
  뒤로 미뤄져 이번 실행에서 다시 거두지 않는다.
- jobs 패키지(기반 층)는 worker · 기능(visit · schedule)을 import하지 못한다. 처리 함수 표
  (worker.JOB_HANDLERS)가 조립 층에 있어서 이 명령도 조립 층에 둔다.
"""

import argparse
import asyncio
import contextlib
import sys
from collections import Counter
from collections.abc import Sequence
from datetime import datetime

from app.config import settings
from app.shared.clock import SEOUL

ALLOWED_ENVS = ("local", "test")
MAX_ROUNDS = 200  # 처리 함수가 기한이 이미 된 새 일을 계속 넣는 경우에도 멈춘다
RESULTS = ("done", "skipped", "retry", "failed")


def _when(text: str) -> datetime:
    """ISO 시각. 시간대가 없으면 서울로 본다."""
    try:
        at = datetime.fromisoformat(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("시각은 2026-11-21T10:00+09:00 꼴로 적어 주세요.") from exc
    return at if at.tzinfo else at.replace(tzinfo=SEOUL)


async def run(now: datetime) -> Counter[tuple[str, str]]:
    """now까지 기한이 된 일을 거둘 것이 없을 때까지 처리한다. 돌려주는 값: (kind, 결과) → 수."""
    from app import worker  # 조립 층: 처리 함수 표를 쓴다

    total: Counter[tuple[str, str]] = Counter()
    for _ in range(MAX_ROUNDS):
        got = await worker.sweep(now)
        if not got:
            break
        total.update(got)
    return total


def report(now: datetime, total: Counter[tuple[str, str]]) -> str:
    lines = [f"기한 당기기: {now.astimezone(SEOUL):%Y-%m-%d %H:%M} (서울) 기준"]
    for kind in sorted({k for k, _ in total}):
        parts = [f"{r} {total[(kind, r)]}" for r in RESULTS if total[(kind, r)]]
        lines.append(f"  {kind}: {' · '.join(parts)}")
    n = sum(total.values())
    lines.append(f"모두 {n}건" if n else "거둘 일이 없어요")
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.run_due", description=__doc__.split("\n")[0]
    )
    parser.add_argument("--now", type=_when, required=True, help="이 시각을 지금으로 봐요 (ISO)")
    args = parser.parse_args(argv)
    if settings.app_env not in ALLOWED_ENVS:
        print(
            f"기한 당기기는 개발(APP_ENV={'·'.join(ALLOWED_ENVS)})에서만 돌아요."
            f" 지금 APP_ENV={settings.app_env}",
            file=sys.stderr,
        )
        return 2
    print(report(args.now, asyncio.run(_main(args.now))))
    return 0


async def _main(now: datetime) -> Counter[tuple[str, str]]:
    from app import db, queue

    try:
        return await run(now)
    finally:  # 이 실행의 이벤트 루프에서 연 연결을 닫는다 (닫기 실패는 결과와 상관없다)
        await db.engine.dispose()
        with contextlib.suppress(Exception):
            await queue.redis.connection_pool.disconnect()


if __name__ == "__main__":
    sys.exit(main())
