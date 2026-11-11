"""eval 러너. 지금은 의도 분류만 있다.

    python evaluation/run.py intent --split dev --clf all_orchestrator
    python evaluation/run.py intent --data evaluation/intent/example.jsonl
    cd backend && uv run python ../evaluation/run.py intent --clf intent_lr   # 서비스 학습 모델 (Jev 없이)

held-out은 마지막에 한 번만 본다. 이름에 heldout이 든 파일은 --final을 같이 줘야 돈다.
"""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from intent_metrics import Classifier, evaluate, format_report, load_examples

INTENT_DIR = Path(__file__).parent / "intent"


class AllOrchestrator:
    """모든 문장을 오케스트레이터로 보낸다. 분류 모델이 없을 때의 기준선."""

    name = "all_orchestrator"

    def predict(self, text: str) -> tuple[str, dict[str, float]]:
        return "orchestrator", {"orchestrator": 1.0}


class IntentLR:
    """서비스 입구 관문의 학습 모델(backend/app/agent/intent.py). backend 환경에서 돌린다."""

    name = "intent_lr"

    def __init__(self) -> None:
        sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
        from app.agent import intent

        self.probs = intent.probs

    def predict(self, text: str) -> tuple[str, dict[str, float]]:
        probs = self.probs(text)
        if probs is None:
            raise ValueError("모델 파일이 없어요: backend/app/agent/intent_lr_v1.json.gz")
        return max(probs, key=probs.__getitem__), probs


CLASSIFIERS: dict[str, type] = {"all_orchestrator": AllOrchestrator, "intent_lr": IntentLR}


def is_heldout(path: Path) -> bool:
    """--data로 직접 줘도 held-out 파일이면 막는다. held_out · held-out도 같이 본다."""
    name = path.name.lower().replace("_", "").replace("-", "")
    return "heldout" in name


def run_intent(args: argparse.Namespace) -> int:
    path = Path(args.data) if args.data else INTENT_DIR / f"{args.split}.jsonl"
    if is_heldout(path) and not args.final:
        print("held-out은 마지막 평가에서 한 번만 봐요. 정말이면 --final을 같이 주세요.")
        return 2
    if not path.exists():
        print(f"eval 파일이 없어요: {path}")
        return 2

    try:
        examples = load_examples(path)
    except ValueError as e:
        print(f"eval 파일을 읽지 못했어요: {e}")
        return 2
    clf: Classifier = CLASSIFIERS[args.clf]()
    report = evaluate(clf, examples, warmup=not args.no_warmup)
    print(format_report(report, show_wrong=args.show_wrong))
    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


def main(argv: list[str] | None = None) -> int:
    # 윈도우 콘솔에서 한글 표가 깨지지 않게. 노트북(Colab · Jupyter)의 stdout에는 이 메서드가 없다
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="믿집 eval 러너")
    sub = parser.add_subparsers(dest="suite", required=True)

    intent = sub.add_parser("intent", help="의도 분류")
    intent.add_argument("--split", choices=["dev", "heldout"], default="dev")
    intent.add_argument("--data", help="split 대신 직접 줄 jsonl 경로")
    intent.add_argument("--clf", choices=sorted(CLASSIFIERS), default="all_orchestrator")
    intent.add_argument("--final", action="store_true", help="held-out 평가를 허락")
    intent.add_argument("--show-wrong", type=int, default=10, help="출력할 오분류 수")
    intent.add_argument(
        "--no-warmup", action="store_true", help="첫 문장 미리 부르기를 끔 (유료 호출일 때)"
    )
    intent.add_argument("--json", help="결과를 저장할 json 경로")
    intent.set_defaults(func=run_intent)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
