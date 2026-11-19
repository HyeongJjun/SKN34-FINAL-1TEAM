"""v3 에이전트 실험 공용: 경로 · 읽기 · 신뢰구간. 표준 라이브러리만 쓴다 (LLM · DB 없음)."""

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / ".cache"  # git 밖 (말뭉치 · 순위 · 11-13 의미 검색 순위 사본)
RESULTS = HERE / "results"

for p in (ROOT / "backend", ROOT / "evaluation", ROOT / "evaluation" / "rag"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))


def corpus_path() -> Path:
    """v3 말뭉치(v3 지식 요지 포함, corpus3.py)가 있으면 그것, 없으면 지금 말뭉치."""
    p = CACHE / "corpus3.json"
    return p if p.exists() else CACHE / "corpus.json"


def utf8_stdout() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def jsonl(path: Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8-sig").splitlines() if x.strip()]


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """이항 비율 k/n의 95% Wilson 구간. 작은 세트에서 정규근사보다 덜 낙관적이다."""
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(c - h, 3), round(c + h, 3))


def save(name: str, data: dict) -> Path:
    RESULTS.mkdir(parents=True, exist_ok=True)
    out = RESULTS / name
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return out
