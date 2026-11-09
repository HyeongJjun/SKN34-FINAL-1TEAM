"""의도 분류 eval: 데이터 읽기와 지표 계산. 표준 라이브러리만 쓴다."""

import json
import math
import statistics
import time
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

LABELS = ("orchestrator", "consult", "quote_explanation", "schedule", "out_of_scope")


@dataclass(frozen=True)
class Example:
    text: str
    label: str
    novice: bool = False
    kind: str = ""


class Classifier(Protocol):
    """문장 하나를 받아 (라벨, 라벨별 확률)을 돌려준다."""

    name: str

    def predict(self, text: str) -> tuple[str, dict[str, float]]: ...


TRUE_WORDS = {"true", "1", "yes", "y", "예"}
FALSE_WORDS = {"false", "0", "no", "n", "아니오", ""}


def parse_novice(value: object) -> bool:
    """시트에서 바꾼 "false" 같은 글자도 받는다. 모르는 값이면 ValueError."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    word = str(value).strip().lower()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    raise ValueError("novice는 true / false")


def load_examples(path: Path) -> list[Example]:
    """jsonl을 읽는다. 틀린 줄이 있으면 줄 번호와 이유를 알려 주고 멈춘다."""
    examples = []
    with path.open(encoding="utf-8") as f:
        for no, line in enumerate(f, start=1):
            if not line.strip():
                continue
            where = f"{path.name} {no}번째 줄"
            try:
                row = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"{where}: JSON 형식이 아님") from e
            if not isinstance(row, dict):
                # 데이터 오류는 모두 ValueError 하나로 받게 한다
                raise ValueError(f"{where}: {{...}} 한 줄이어야 함")  # noqa: TRY004
            text = row.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{where}: text가 비었음")
            if row.get("label") not in LABELS:
                raise ValueError(f"{where}: 모르는 라벨")
            try:
                novice = parse_novice(row.get("novice"))
            except ValueError as e:
                raise ValueError(f"{where}: {e}") from e
            examples.append(
                Example(text=text, label=row["label"], novice=novice, kind=row.get("kind", ""))
            )
    return examples


@dataclass
class Report:
    classifier: str
    count: int
    accuracy: float
    macro_f1: float
    per_label: dict[str, dict[str, float]]
    confusion: dict[str, dict[str, int]]
    novice_count: int
    novice_accuracy: float | None
    latency_ms_p50: float
    latency_ms_p95: float
    wrong: list[dict] = field(default_factory=list)
    # 문장별 예측과 신뢰도. 기준값 곡선(#70)을 모델을 다시 돌리지 않고 그리려고 남긴다
    predictions: list[dict] = field(default_factory=list)


def confusion_matrix(gold: Iterable[str], pred: Iterable[str]) -> dict[str, dict[str, int]]:
    """행 = 정답, 열 = 예측."""
    matrix = {g: dict.fromkeys(LABELS, 0) for g in LABELS}
    for g, p in zip(gold, pred, strict=True):
        matrix[g][p] += 1
    return matrix


def per_label_scores(matrix: dict[str, dict[str, int]]) -> dict[str, dict[str, float]]:
    scores = {}
    for label in LABELS:
        tp = matrix[label][label]
        support = sum(matrix[label].values())
        predicted = sum(matrix[g][label] for g in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        scores[label] = {"precision": precision, "recall": recall, "f1": f1, "support": support}
    return scores


def macro_f1(scores: dict[str, dict[str, float]], matrix: dict[str, dict[str, int]]) -> float:
    """정답이나 예측에 한 번이라도 나온 라벨만 평균한다."""
    used = [
        label
        for label in LABELS
        if scores[label]["support"] or any(matrix[g][label] for g in LABELS)
    ]
    return statistics.fmean(scores[label]["f1"] for label in used) if used else 0.0


def percentile(values: list[float], q: float) -> float:
    """가장 가까운 순위 방식(올림). q는 0~100."""
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, math.ceil(q / 100 * len(ordered)))
    return ordered[min(rank, len(ordered)) - 1]


def evaluate(clf: Classifier, examples: list[Example], warmup: bool = True) -> Report:
    """warmup이면 첫 문장을 한 번 미리 불러 모델 준비 시간을 지연에서 뺀다.
    Jev처럼 호출마다 돈이 들면 warmup=False."""
    if warmup and examples:
        clf.predict(examples[0].text)
    preds, confidences, latencies = [], [], []
    for ex in examples:
        start = time.perf_counter()
        label, probs = clf.predict(ex.text)
        latencies.append((time.perf_counter() - start) * 1000)
        if label not in LABELS:
            raise ValueError(f"{clf.name}: 모르는 라벨을 냄")
        preds.append(label)
        confidences.append(float(probs.get(label, 0.0)))

    gold = [ex.label for ex in examples]
    matrix = confusion_matrix(gold, preds)
    scores = per_label_scores(matrix)
    hits = [g == p for g, p in zip(gold, preds, strict=True)]
    novice_hits = [h for h, ex in zip(hits, examples, strict=True) if ex.novice]
    wrong = [
        {"text": ex.text, "gold": ex.label, "pred": p, "kind": ex.kind}
        for ex, p, h in zip(examples, preds, hits, strict=True)
        if not h
    ]
    return Report(
        classifier=clf.name,
        count=len(examples),
        accuracy=statistics.fmean(hits) if hits else 0.0,
        macro_f1=macro_f1(scores, matrix),
        per_label=scores,
        confusion=matrix,
        novice_count=len(novice_hits),
        novice_accuracy=statistics.fmean(novice_hits) if novice_hits else None,
        latency_ms_p50=percentile(latencies, 50),
        latency_ms_p95=percentile(latencies, 95),
        predictions=[
            {"gold": ex.label, "pred": p, "confidence": c, "novice": ex.novice, "kind": ex.kind}
            for ex, p, c in zip(examples, preds, confidences, strict=True)
        ],
        wrong=wrong,
    )


def format_report(report: Report, show_wrong: int = 10) -> str:
    """결과서에 붙이기 쉬운 마크다운 표."""
    novice = "-" if report.novice_accuracy is None else f"{report.novice_accuracy:.3f}"
    lines = [
        f"## {report.classifier} ({report.count}건)",
        "",
        "| 정확도 | 매크로 F1 | 초보자 정확도 | 지연 p50 | 지연 p95 |",
        "| --- | --- | --- | --- | --- |",
        (
            f"| {report.accuracy:.3f} | {report.macro_f1:.3f} | {novice} ({report.novice_count}건) "
            f"| {report.latency_ms_p50:.1f}ms | {report.latency_ms_p95:.1f}ms |"
        ),
        "",
        "| 라벨 | 정밀도 | 재현율 | F1 | 건수 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for label, s in report.per_label.items():
        lines.append(
            f"| {label} | {s['precision']:.3f} | {s['recall']:.3f} | {s['f1']:.3f} "
            f"| {int(s['support'])} |"
        )
    lines += ["", "혼동행렬 (행 = 정답, 열 = 예측)", "", "| | " + " | ".join(LABELS) + " |"]
    lines.append("| --- " * (len(LABELS) + 1) + "|")
    for g in LABELS:
        lines.append(f"| {g} | " + " | ".join(str(report.confusion[g][p]) for p in LABELS) + " |")
    if report.wrong and show_wrong:
        lines += ["", f"오분류 (앞 {min(show_wrong, len(report.wrong))}건)", ""]
        for w in report.wrong[:show_wrong]:
            lines.append(f"- {w['text']} · 정답 {w['gold']} · 예측 {w['pred']}")
    return "\n".join(lines)
