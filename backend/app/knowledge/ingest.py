"""수동 RAG 적재와 임베딩. 서버·worker 시작 경로에서는 부르지 않는다."""

import asyncio
import hashlib
import math
import re
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

from openai import APIConnectionError, APIStatusError, AsyncOpenAI
from sqlalchemy import select, update

from app.knowledge.models import RagChunk
from app.refprice.models import RefDatasetVersion

# 공식 표준 API 가격, USD/백만 입력 토큰. 변경 시 CLI에서 덮어쓸 수 있다.
PRICES = {"text-embedding-3-small": Decimal("0.02"), "text-embedding-3-large": Decimal("0.13")}
MAX_DIMENSIONS = {"text-embedding-3-small": 1536, "text-embedding-3-large": 3072}


def check_profile(model: str, dimensions: int) -> None:
    if model not in MAX_DIMENSIONS or not 1 <= dimensions <= MAX_DIMENSIONS[model]:
        raise ValueError("지원하는 임베딩 모델과 차원을 지정해 주세요")


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def convert(raw: dict[str, str]) -> dict:
    content = raw["content"]
    if not content.strip():
        raise ValueError("빈 RAG 본문")
    if not re.fullmatch(r"\d+(?:\s*[;,]\s*\d+)*", raw["page"]):
        raise ValueError("페이지는 양의 정수 목록이어야 해요")
    pages = [int(p) for p in re.split(r"[;,]", raw["page"])]
    if min(pages) < 1:
        raise ValueError("페이지는 1 이상이어야 해요")
    return {
        "record_key": raw["id"],
        "dataset_kind": "knowledge",
        "content": content,
        "content_hash": content_hash(content),
        "section": raw["section"],
        "page_numbers": pages,
        "provenance": raw,
    }


def token_counter() -> Callable[[str], int]:
    import tiktoken

    encoding = tiktoken.get_encoding("cl100k_base")
    return lambda text: len(encoding.encode(text, disallowed_special=()))


def valid_vector(vector, dimensions: int) -> list[float]:
    # pgvector는 float32로 저장하므로 Python float 범위만 검사하면 부족하다.
    try:
        values = [float(v) for v in vector]
    except (TypeError, ValueError, OverflowError):
        raise ValueError("유효하지 않은 임베딩 값") from None
    if len(values) != dimensions:
        raise ValueError("임베딩 차원이 설정과 달라요")
    if any(not math.isfinite(v) or abs(v) > 3.402823466e38 for v in values):
        raise ValueError("유효하지 않은 임베딩 값")
    if not any(abs(v) >= 1.401298464e-45 for v in values):
        raise ValueError("영벡터는 저장할 수 없어요")
    return values


async def cached_vectors(session, hashes, model: str, dimensions: int) -> dict:
    if not hashes:
        return {}
    rows = await session.execute(
        select(RagChunk.content_hash, RagChunk.content, RagChunk.embedding)
        .join(RefDatasetVersion, RefDatasetVersion.id == RagChunk.dataset_id)
        .where(
            RagChunk.content_hash.in_(hashes),
            RagChunk.embedding.is_not(None),
            RefDatasetVersion.embedding_model == model,
            RefDatasetVersion.embedding_dimensions == dimensions,
        )
    )
    result = {}
    for digest, content, vector in rows:
        if digest != content_hash(content):
            raise ValueError("저장된 본문 해시가 일치하지 않아요")
        result[digest] = valid_vector(vector, dimensions)
    return result


@dataclass
class EmbeddingUsage:
    api_calls: int = 0
    input_tokens: int = 0
    generated: int = 0
    reused: int = 0

    def report(self, price: Decimal) -> dict:
        return {**vars(self), "estimated_usd": str(price * self.input_tokens / 1_000_000)}


class OpenAIEmbedder:
    """SDK 내부 재시도를 끄고 실제 시도마다 호출 상한에 포함한다."""

    def __init__(
        self, api_key: str, model: str, dimensions: int, max_calls: int, usage: EmbeddingUsage
    ):
        if not api_key:
            raise ValueError("OPENAI_API_KEY가 필요해요")
        self.client = AsyncOpenAI(api_key=api_key, max_retries=0, timeout=60)
        self.model, self.dimensions = model, dimensions
        self.max_calls, self.usage = max_calls, usage

    async def close(self):
        await self.client.close()

    async def __call__(self, texts: list[str]) -> list[list[float]]:
        for attempt in range(4):
            if self.usage.api_calls >= self.max_calls:
                raise ValueError("API 호출 상한에 도달했어요. 저장된 배치부터 재개할 수 있어요")
            self.usage.api_calls += 1
            try:
                response = await self.client.embeddings.create(
                    model=self.model,
                    dimensions=self.dimensions,
                    input=texts,
                    encoding_format="float",
                )
            except (APIConnectionError, APIStatusError) as exc:
                retryable = isinstance(exc, APIConnectionError) or exc.status_code in (
                    408,
                    409,
                    429,
                    500,
                    502,
                    503,
                    504,
                )
                if not retryable or attempt == 3:
                    raise ValueError(
                        "임베딩 API 실패. 키·본문·원문 오류는 출력하지 않아요"
                    ) from None
                await asyncio.sleep(min(2**attempt, 8))
                continue
            self.usage.input_tokens += response.usage.total_tokens
            if response.model != self.model:
                raise ValueError("API 응답 모델이 설정과 달라요")
            if sorted(item.index for item in response.data) != list(range(len(texts))):
                raise ValueError("API 응답의 입력 인덱스가 일치하지 않아요")
            return [
                valid_vector(item.embedding, self.dimensions)
                for item in sorted(response.data, key=lambda item: item.index)
            ]
        raise ValueError("임베딩 재시도 실패")


async def embed_versions(
    factory,
    versions,
    model,
    dimensions,
    embedder,
    *,
    batch_size=64,
    count_tokens=None,
    usage=None,
    progress=None,
):
    """호출자는 수동 실행 잠금을 확보한다. API를 기다리는 동안 DB 세션은 없다."""
    check_profile(model, dimensions)
    if not 1 <= batch_size <= 2048:
        raise ValueError("배치 크기는 1~2048이어야 해요")
    if any(
        v.kind == "knowledge"
        and (
            v.embedding_model != model
            or v.embedding_dimensions != dimensions
            or not v.provenance.get("load_complete")
        )
        for v in versions
    ):
        raise ValueError("임베딩 대상 버전의 적재 상태·모델·차원이 일치하지 않아요")
    usage = usage if usage is not None else EmbeddingUsage()
    count_tokens = count_tokens or token_counter()
    ids = [v.id for v in versions if v.kind == "knowledge"]
    async with factory() as session:
        chunks = list(
            (
                await session.scalars(
                    select(RagChunk)
                    .where(RagChunk.dataset_id.in_(ids), RagChunk.embedding.is_(None))
                    .order_by(RagChunk.dataset_id, RagChunk.record_key)
                )
            ).all()
        )
        unique = {c.content_hash: c.content for c in chunks}
        cache = await cached_vectors(session, list(unique), model, dimensions)
    pending = []
    for digest, text in unique.items():
        if digest != content_hash(text):
            raise ValueError("저장된 본문 해시가 일치하지 않아요")
        tokens = count_tokens(text)
        if not 1 <= tokens <= 8192:
            raise ValueError("RAG 본문의 임베딩 입력 토큰 한도를 초과했어요")
        if digest not in cache:
            pending.append((digest, text, tokens))

    completed = 0
    if progress:
        progress(0, len(chunks))

    # 재사용 벡터도 API 실패 전에 먼저 저장한다.
    async def save(vectors):
        nonlocal completed
        saved = 0
        async with factory.begin() as session:
            for digest, vector in vectors.items():
                result = await session.execute(
                    update(RagChunk)
                    .where(
                        RagChunk.dataset_id.in_(ids),
                        RagChunk.content_hash == digest,
                        RagChunk.embedding.is_(None),
                    )
                    .values(embedding=valid_vector(vector, dimensions))
                )
                usage.reused += result.rowcount
                saved += result.rowcount
        completed += saved
        if progress and saved:
            progress(completed, len(chunks))

    await save(cache)
    offset = 0
    while offset < len(pending):
        batch, tokens = [], 0
        while offset < len(pending) and len(batch) < batch_size:
            item = pending[offset]
            if tokens + item[2] > 300_000:
                break
            batch.append(item)
            tokens += item[2]
            offset += 1
        vectors = await embedder([item[1] for item in batch])
        if len(vectors) != len(batch):
            raise ValueError("임베딩 응답 수가 입력 수와 달라요")
        await save(
            {
                item[0]: valid_vector(vector, dimensions)
                for item, vector in zip(batch, vectors, strict=True)
            }
        )
        usage.generated += len(batch)
        usage.reused -= len(batch)
    return usage


async def search_version(session, dataset_id, status, vector, model, dimensions, limit=5):
    """검색 버전·상태·모델을 호출자가 명시한다. 과거·신규 행을 섞지 않는다."""
    vector = valid_vector(vector, dimensions)
    version = await session.get(RefDatasetVersion, dataset_id)
    if (
        version is None
        or version.status != status
        or version.kind != "knowledge"
        or version.embedding_model != model
        or version.embedding_dimensions != dimensions
    ):
        raise ValueError("검색 버전과 임베딩 설정을 확인해 주세요")
    return list(
        (
            await session.scalars(
                select(RagChunk)
                .where(RagChunk.dataset_id == dataset_id, RagChunk.embedding.is_not(None))
                .order_by(RagChunk.embedding.cosine_distance(vector))
                .limit(limit)
            )
        ).all()
    )
