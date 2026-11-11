"""직접 학습한 의도 분류 모델 추론: 문장 → (라벨, 신뢰도).

모델은 TF-IDF(글자 2~4개 묶음) + 로지스틱 회귀. scikit-learn 없이 가중치 파일(intent_lr_v1.json.gz)로 계산한다.
가중치는 학습 저장소의 export.py가 만들고, 파일 안 checks(학습 쪽 확률)로 같은 값이 나오는지 테스트한다.
"""

import gzip
import json
import math
import re
import unicodedata
from collections import Counter
from functools import cache
from pathlib import Path

from app.agent.schemas import Intent

MODEL = Path(__file__).with_name("intent_lr_v1.json.gz")

PHONE = re.compile(r"0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}")  # 휴대폰 · 일반 전화
DONGHO = re.compile(r"(\d{1,4}\s?동\s?)?\d{3,4}\s?호(?!선)")  # 105동 1203호 · 1503호 (3호선은 뺌)


def clean(text: str) -> str:
    """학습 전처리와 같다. 전화번호 · 동호수를 가려서 Jev로 보낼 때도 이 결과만 쓴다."""
    text = unicodedata.normalize("NFC", text)
    text = PHONE.sub("<전화>", text)
    text = DONGHO.sub("<동호수>", text)
    return re.sub(r"\s+", " ", text).strip()


@cache
def _model() -> dict | None:
    if not MODEL.exists():
        return None  # 모델이 없으면 분류하지 않는다 → Jev → 되묻기
    return json.loads(gzip.decompress(MODEL.read_bytes()))


def _grams(text: str, lo: int, hi: int) -> Counter[str]:
    """scikit-learn char_wb와 같은 글자 묶음: 단어 양옆에 공백을 붙여 단어 안에서만 자른다."""
    out: Counter[str] = Counter()
    for word in text.lower().split():
        w = f" {word} "
        for n in range(lo, hi + 1):
            if len(w) <= n:  # 단어가 n보다 짧거나 같으면 통째로 한 번만
                out[w] += 1
                break
            out.update(w[i : i + n] for i in range(len(w) - n + 1))
    return out


def probs(text: str) -> dict[str, float] | None:
    model = _model()
    if model is None:
        return None
    features, labels = model["features"], model["labels"]
    tfidf = {
        g: (1 + math.log(c)) * features[g][0]
        for g, c in _grams(clean(text), *model["ngram"]).items()
        if g in features
    }
    norm = math.sqrt(sum(v * v for v in tfidf.values())) or 1.0
    scores = list(model["intercept"])
    for g, v in tfidf.items():
        for k, w in enumerate(features[g][1:]):
            scores[k] += v / norm * w
    top = max(scores)
    exp = [math.exp(s - top) for s in scores]
    total = sum(exp)
    return {label: e / total for label, e in zip(labels, exp, strict=True)}


def predict(text: str) -> Intent | None:
    p = probs(text)
    if p is None:
        return None
    label = max(p, key=p.__getitem__)
    return Intent(label=label, confidence=p[label], source="model")
