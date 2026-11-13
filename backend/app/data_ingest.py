"""전처리 CSV 수동 CLI: python -m app.data_ingest --help."""

import argparse
import asyncio
import csv
import hashlib
import json
import re
import sys
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, insert, select, text, update
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.db import SessionLocal, engine
from app.knowledge import ingest as rag
from app.knowledge.models import RagChunk
from app.refprice import ingest as ref
from app.refprice.models import RefDatasetVersion
from app.shared.ids import uuid7

MODELS = {**ref.MODELS, "knowledge": RagChunk}
BUILD_PROFILE = "processed-csv-v1"
LOCK_KEY = 718234019  # 수동 load·embed 실행끼리만 직렬화한다.
COMMON = {"id", "source", "source_sha256", "effective_date"}


def digest_file(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def fingerprint(values: dict) -> str:
    def canonical(value):
        if isinstance(value, Decimal):
            if value == 0:
                return "0"
            number = format(value, "f")
            return number.rstrip("0").rstrip(".") if "." in number else number
        return str(value)

    return hashlib.sha256(
        json.dumps(values, ensure_ascii=False, sort_keys=True, default=canonical).encode()
    ).hexdigest()


def row_values(kind: str, raw: dict) -> dict:
    if not raw["id"].strip() or not raw["source"].strip():
        raise ValueError("ID와 출처는 비어 있을 수 없어요")
    if not re.fullmatch(r"[0-9a-f]{64}", raw["source_sha256"]):
        raise ValueError("원본 SHA-256 형식이 올바르지 않아요")
    if raw["effective_date"]:
        date.fromisoformat(raw["effective_date"])
    if any("\x00" in v for v in raw.values()):
        raise ValueError("CSV에 NUL 문자가 있어요")
    return rag.convert(raw) if kind == "knowledge" else ref.convert(kind, raw)


def records(path: Path, kind: str):
    # 큰 셀은 허용하되 파일 전체를 메모리에 올리지 않는다.
    csv.field_size_limit(16 * 1024 * 1024)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        for line, raw in enumerate(reader, 2):
            if None in raw or any(v is None for v in raw.values()):
                raise ValueError(f"{path.name}:{line}: 열 수가 맞지 않아요")
            try:
                values = row_values(kind, raw)
            except (ValueError, KeyError, OverflowError):
                raise ValueError(
                    f"{path.name}:{line}: 열 값·타입·메타데이터를 확인해 주세요"
                ) from None
            yield values


@dataclass
class CsvDataset:
    path: Path
    kind: str
    sha256: str
    hashes: dict[str, str]
    sources: list[str]
    source_hashes: list[str]
    effective_date: date | None

    @property
    def key(self):
        return self.path.stem


def inspect_csv(path: Path) -> CsvDataset:
    digest = digest_file(path)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        header = next(csv.reader(stream), [])
    if len(header) != len(set(header)) or not COMMON <= set(header):
        raise ValueError(f"{path.name}: 필수 열이 없거나 열 이름이 중복돼요")
    candidates = [kind for kind, cols in ref.SIGNATURES.items() if cols <= set(header)]
    if {"content", "section", "page", "category", "trade"} <= set(header):
        candidates.append("knowledge")
    if len(candidates) != 1:
        raise ValueError(f"{path.name}: 알 수 없거나 모호한 CSV 구조예요")
    kind = candidates[0]
    if kind != "knowledge":
        required = {c.name for c in MODELS[kind].__table__.columns} - {
            "dataset_id",
            "dataset_kind",
            "record_key",
            "parent_key",
            "provenance",
        }
        if not required | {"parent_id"} <= set(header):
            raise ValueError(f"{path.name}: 정형 데이터 필수 열이 없어요")
    hashes, parents, sources, source_hashes, dates = {}, {}, set(), set(), set()
    published = set()
    for values in records(path, kind):
        key, raw = values["record_key"], values["provenance"]
        if key in hashes:
            raise ValueError(f"{path.name}: ID 중복")
        hashes[key] = fingerprint(values)
        parents[key] = values.get("parent_key")
        if kind == "wage" and values["record_type"] == "occupation_wage":
            identity = (
                values["occupation_code"],
                values["publication_date"],
                values["basis_hours"],
            )
            if identity in published:
                raise ValueError(f"{path.name}: 직종·공표일·근무시간이 중복돼요")
            published.add(identity)
        sources.add(raw["source"])
        source_hashes.add(raw["source_sha256"])
        dates.add(raw["effective_date"])
    for key, parent in parents.items():
        if parent and (parent not in hashes or parent == key):
            raise ValueError(f"{path.name}: 부모 참조 무결성 오류")
    # 부모 그래프의 순환도 막는다.
    done = set()
    for start in tuple(parents):
        key = start
        visiting = set()
        while key and key not in done:
            if key in visiting:
                raise ValueError(f"{path.name}: 부모 참조 순환")
            visiting.add(key)
            key = parents[key]
        done.update(visiting)
    if digest_file(path) != digest:
        raise ValueError(f"{path.name}: 검사 중 파일이 바뀌었어요")
    effective = (
        date.fromisoformat(next(iter(dates))) if len(dates) == 1 and "" not in dates else None
    )
    return CsvDataset(path, kind, digest, hashes, sorted(sources), sorted(source_hashes), effective)


def discover(directory: Path, selected=None):
    if not directory.is_dir():
        raise ValueError("CSV 디렉터리를 찾을 수 없어요")
    files = [p for p in sorted(directory.glob("*.csv")) if not selected or p.stem in selected]
    missing = set(selected or []) - {p.stem for p in files}
    if missing:
        raise ValueError(f"지정한 CSV를 찾을 수 없어요: {', '.join(sorted(missing))}")
    return [inspect_csv(p) for p in files]


async def matching_version(session, dataset, model, dimensions, profile):
    return await session.scalar(
        select(RefDatasetVersion).where(
            RefDatasetVersion.dataset_key == dataset.key,
            RefDatasetVersion.processed_sha256 == dataset.sha256,
            RefDatasetVersion.build_profile == profile,
            RefDatasetVersion.embedding_model.is_not_distinct_from(
                model if dataset.kind == "knowledge" else None
            ),
            RefDatasetVersion.embedding_dimensions.is_not_distinct_from(
                dimensions if dataset.kind == "knowledge" else None
            ),
        )
    )


async def stored_hashes(session, version):
    model = MODELS[version.kind]
    columns = [c for c in model.__table__.columns if c.name not in {"dataset_id", "embedding"}]
    result = await session.stream(select(*columns).where(model.dataset_id == version.id))
    return {row["record_key"]: fingerprint(dict(row)) async for row in result.mappings()}


async def assert_snapshot(session, dataset, version):
    if (
        version.kind != dataset.kind
        or not version.provenance.get("load_complete")
        or version.provenance.get("row_count") != len(dataset.hashes)
        or await stored_hashes(session, version) != dataset.hashes
    ):
        raise ValueError(f"{dataset.path.name}: DB 스냅샷이 불완전하거나 CSV와 달라요")


async def plan(session, datasets, model, dimensions, profile, count_tokens, price, selected=None):
    reports, unique_content = [], {}
    for dataset in datasets:
        existing = await matching_version(session, dataset, model, dimensions, profile)
        previous = await session.scalar(
            select(RefDatasetVersion)
            .where(RefDatasetVersion.dataset_key == dataset.key)
            .order_by(RefDatasetVersion.version.desc())
            .limit(1)
        )
        if previous and previous.kind != dataset.kind:
            raise ValueError(f"{dataset.path.name}: 기존 데이터셋과 자료 종류가 달라요")
        old = await stored_hashes(session, previous) if previous else {}
        new = dataset.hashes
        report = {
            "file": dataset.path.name,
            "kind": dataset.kind,
            "rows": len(new),
            "new_version": existing is None,
            "added": len(new.keys() - old.keys()),
            "deleted": len(old.keys() - new.keys()),
            "changed": sum(new[k] != old[k] for k in new.keys() & old.keys()),
        }
        if existing:
            await assert_snapshot(session, dataset, existing)
            report["dataset_id"] = str(existing.id)
            report["version"] = existing.version
        if dataset.kind == "knowledge":
            embedded = (
                set(
                    (
                        await session.scalars(
                            select(RagChunk.record_key).where(
                                RagChunk.dataset_id == existing.id, RagChunk.embedding.is_not(None)
                            )
                        )
                    ).all()
                )
                if existing
                else set()
            )
            needed = {}
            for values in records(dataset.path, dataset.kind):
                tokens = count_tokens(values["content"])
                if not 1 <= tokens <= 8192:
                    raise ValueError(f"{dataset.path.name}: 본문 입력 토큰 한도 초과")
                if values["record_key"] not in embedded:
                    needed[values["content_hash"]] = values["content"]
            cached = await rag.cached_vectors(session, list(needed), model, dimensions)
            unique_content.update({h: c for h, c in needed.items() if h not in cached})
            report["embedding_missing_rows"] = len(new) - len(embedded)
            report["embedding_new_contents"] = len(needed.keys() - cached.keys())
        reports.append(report)
    known = (
        await session.scalars(
            select(RefDatasetVersion).where(
                RefDatasetVersion.provenance["load_complete"].as_boolean().is_(True)
            )
        )
    ).all()
    present = {d.key for d in datasets}
    missing = sorted(
        {
            v.dataset_key
            for v in known
            if v.dataset_key not in present and (not selected or v.dataset_key in selected)
        }
    )
    tokens = sum(count_tokens(content) for content in unique_content.values())
    return {
        "files": reports,
        "missing_files": missing,
        "warnings": [f"CSV 누락: {key} (DB 버전과 상태 유지)" for key in missing],
        "embedding_unique_inputs": len(unique_content),
        "estimated_input_tokens": tokens,
        "estimated_usd": str(price * tokens / 1_000_000),
        "price_usd_per_million": str(price),
    }


@asynccontextmanager
async def execution_lock(db_engine):
    # autocommit 연결의 세션 잠금: 외부 API 대기 중 열린 트랜잭션은 없다.
    async with db_engine.connect() as connection:
        connection = await connection.execution_options(isolation_level="AUTOCOMMIT")
        locked = await connection.scalar(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": LOCK_KEY}
        )
        if not locked:
            raise ValueError("다른 수동 적재·임베딩 작업이 실행 중이에요")
        try:
            yield
        finally:
            await connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": LOCK_KEY})


async def load_dataset(factory, dataset, model, dimensions, profile):
    async with factory.begin() as session:
        # CLI 잠금과 별개로 버전 생성 트랜잭션도 같은 dataset_key끼리 직렬화한다.
        await session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"), {"key": dataset.key}
        )
        existing = await matching_version(session, dataset, model, dimensions, profile)
        if existing:
            await assert_snapshot(session, dataset, existing)
            return existing
        latest = await session.scalar(
            select(func.max(RefDatasetVersion.version)).where(
                RefDatasetVersion.dataset_key == dataset.key
            )
        )
        previous_kind = await session.scalar(
            select(RefDatasetVersion.kind)
            .where(RefDatasetVersion.dataset_key == dataset.key)
            .limit(1)
        )
        if previous_kind and previous_kind != dataset.kind:
            raise ValueError(f"{dataset.path.name}: 기존 데이터셋과 자료 종류가 달라요")
        version = RefDatasetVersion(
            id=uuid7(),
            dataset_key=dataset.key,
            kind=dataset.kind,
            version=(latest or 0) + 1,
            source="; ".join(dataset.sources) or "empty CSV snapshot",
            processed_path=dataset.path.name,
            processed_sha256=dataset.sha256,
            build_profile=profile,
            effective_date=dataset.effective_date,
            embedding_model=model if dataset.kind == "knowledge" else None,
            embedding_dimensions=dimensions if dataset.kind == "knowledge" else None,
            provenance={
                "sources": dataset.sources,
                "source_sha256": dataset.source_hashes,
                "row_count": len(dataset.hashes),
                "load_complete": True,
            },
            status=False,
        )
        session.add(version)
        await session.flush()
        batch = []
        seen = {}
        for values in records(dataset.path, dataset.kind):
            seen[values["record_key"]] = fingerprint(values)
            batch.append({**values, "dataset_id": version.id})
            if len(batch) == 250:
                await session.execute(insert(MODELS[dataset.kind].__table__), batch)
                batch.clear()
        if batch:
            await session.execute(insert(MODELS[dataset.kind].__table__), batch)
        if seen != dataset.hashes or digest_file(dataset.path) != dataset.sha256:
            raise ValueError(f"{dataset.path.name}: 적재 중 파일이 바뀌었어요. 전체 롤백해요")
        return version


async def verify(
    session, datasets, model, dimensions, profile, require_embeddings=False, progress=None
):
    if not datasets:
        raise ValueError("검증할 CSV가 없어요")
    results = []
    total = sum(len(dataset.hashes) for dataset in datasets)
    completed = 0
    if progress:
        progress(0, total)
    for dataset in datasets:
        version = await matching_version(session, dataset, model, dimensions, profile)
        if version is None:
            raise ValueError(f"{dataset.path.name}: 해당 설정의 적재 버전이 없어요")
        await assert_snapshot(session, dataset, version)
        missing = 0
        if dataset.kind == "knowledge":
            chunks = await session.stream_scalars(
                select(RagChunk).where(RagChunk.dataset_id == version.id)
            )
            async for chunk in chunks:
                if chunk.content_hash != rag.content_hash(chunk.content):
                    raise ValueError("본문 해시 불일치")
                if chunk.embedding is None:
                    missing += 1
                else:
                    rag.valid_vector(chunk.embedding, dimensions)
            if require_embeddings and missing:
                raise ValueError(f"{dataset.path.name}: 임베딩 미완료 {missing}행")
        results.append(
            {
                "file": dataset.path.name,
                "dataset_id": str(version.id),
                "version": version.version,
                "rows": len(dataset.hashes),
                "status": version.status,
                "embedding_missing": missing,
            }
        )
        completed += len(dataset.hashes)
        if progress:
            progress(completed, total)
    return results


async def activate_versions(factory, datasets, model, dimensions, profile):
    """검증한 스냅샷 전체의 활성 여부를 한 트랜잭션으로 전환한다."""
    if not datasets:
        raise ValueError("활성화할 CSV가 없어요")
    async with factory.begin() as session:
        for dataset in sorted(datasets, key=lambda item: item.key):
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"), {"key": dataset.key}
            )
        # 잠금 획득 뒤 다시 검증한다. 한 파일이라도 실패하면 상태를 바꾸지 않는다.
        verified = await verify(session, datasets, model, dimensions, profile, True)
        targets = []
        for dataset in datasets:
            if digest_file(dataset.path) != dataset.sha256:
                raise ValueError(f"{dataset.path.name}: 활성화 전 CSV가 바뀌었어요")
            target = await matching_version(session, dataset, model, dimensions, profile)
            versions = list(
                (
                    await session.scalars(
                        select(RefDatasetVersion)
                        .where(RefDatasetVersion.dataset_key == dataset.key)
                        .order_by(RefDatasetVersion.version)
                        .with_for_update()
                        .execution_options(populate_existing=True)
                    )
                ).all()
            )
            if not target.status and target.version != max(v.version for v in versions):
                raise ValueError(f"{dataset.path.name}: 최신 비활성 버전만 활성화할 수 있어요")
            targets.append((target, versions))

        async def transition(version, previous, status):
            changed = await session.execute(
                update(RefDatasetVersion)
                .where(RefDatasetVersion.id == version.id, RefDatasetVersion.status == previous)
                .values(status=status)
                .execution_options(synchronize_session=False)
            )
            if changed.rowcount != 1:
                raise ValueError("상태 변경 충돌(409): 다시 검증해 주세요")

        for target, versions in targets:
            if target.status:
                continue
            for previous in versions:
                if previous.status:
                    await transition(previous, True, False)
            await transition(target, False, True)
        for item in verified:
            item["status"] = True
        return verified


def show_progress(label, completed, total):
    percent = completed * 100 / total if total else 100
    print(f"  {label}: {percent:5.1f}%  ({completed:,}/{total:,}행)", flush=True)


def show_report(report, command, as_json=False):
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    names = {"plan": "계획 확인", "load": "CSV 적재", "embed": "임베딩", "verify": "검증"}
    print(f"\n믿집 · {names[command]} 결과")
    files = report["files"]
    print(f"CSV {len(files):,}개 | 전체 {sum(f['rows'] for f in files):,}행")
    if "verified" in report:
        print("파일 | 검증한 행 | 버전 | 상태 | 임베딩 미완료")
        states = {False: "비활성", True: "활성"}
        for item in report["verified"]:
            print(
                f"  {item['file']} | {item['rows']:,}행 | {item['version']}차 | "
                f"{states[item['status']]} | {item['embedding_missing']:,}행"
            )
        missing = sum(item["embedding_missing"] for item in report["verified"])
        print("검증 통과" + (f" · 임베딩 대기 {missing:,}행" if missing else " · 임베딩 누락 없음"))
    else:
        print("파일 | 전체 행 | 추가 | 변경 | 삭제 | 버전")
        for item in files:
            state = "새 버전 필요" if item["new_version"] else "기존 버전 재사용"
            print(
                f"  {item['file']} | {item['rows']:,} | +{item['added']:,} | "
                f"{item['changed']:,} | -{item['deleted']:,} | {state}"
            )
        print(
            f"신규 임베딩 본문: {report['embedding_unique_inputs']:,}종 | "
            f"예상 입력: {report['estimated_input_tokens']:,}토큰 | "
            f"예상 비용: USD {report['estimated_usd']}"
        )
    for warning in report["warnings"]:
        print(f"주의: {warning}")
    if not report["executed"]:
        print("읽기 전용 · DB 변경 및 OpenAI API 호출 없음")
        if command in {"load", "embed"}:
            print("실제로 실행하려면 --execute를 붙여 주세요.")
    else:
        if report.get("activated"):
            print("활성화 완료 · 새 버전은 활성, 이전 활성 버전은 비활성으로 보존해요.")
        print("요청한 작업과 최종 검증이 끝났어요.")


async def run(args):
    if args.activate and (args.command != "verify" or not args.require_embeddings):
        raise ValueError("--activate는 verify --require-embeddings와 함께 사용해 주세요")
    rag.check_profile(args.model, args.dimensions)
    if settings.app_env not in {"local", "test"}:
        raise ValueError("수동 CLI는 local/test 환경에서만 실행해요")
    if args.batch_size < 1 or args.batch_size > 2048 or args.max_api_calls < 1:
        raise ValueError("배치 크기·호출 상한을 확인해 주세요")
    price = args.price_per_million if args.price_per_million is not None else rag.PRICES[args.model]
    if not price.is_finite() or price < 0:
        raise ValueError("비용 단가가 올바르지 않아요")
    if not args.json:
        print("[준비] CSV 구조·행 수·변경 사항을 확인하고 있어요…", flush=True)
    datasets = discover(args.directory, args.dataset)
    count_tokens = rag.token_counter()
    async with SessionLocal() as session:
        await session.execute(text("SET TRANSACTION READ ONLY"))
        report = await plan(
            session,
            datasets,
            args.model,
            args.dimensions,
            args.build_profile,
            count_tokens,
            price,
            args.dataset,
        )
        if args.command == "verify":
            report["verified"] = await verify(
                session,
                datasets,
                args.model,
                args.dimensions,
                args.build_profile,
                args.require_embeddings,
                progress=None
                if args.json
                else lambda done, total: show_progress("검증", done, total),
            )
    if args.activate:
        async with execution_lock(engine):
            report["verified"] = await activate_versions(
                SessionLocal,
                datasets,
                args.model,
                args.dimensions,
                args.build_profile,
            )
        report["executed"] = True
        report["activated"] = True
        show_report(report, args.command, args.json)
        return
    if args.command in {"plan", "verify"} or not args.execute:
        report["executed"] = False
        show_report(report, args.command, args.json)
        return
    async with execution_lock(engine):
        if args.command == "load":
            total = sum(len(dataset.hashes) for dataset in datasets)
            completed = 0
            if not args.json:
                show_progress("CSV 적재", 0, total)
            for dataset in datasets:
                await load_dataset(
                    SessionLocal, dataset, args.model, args.dimensions, args.build_profile
                )
                completed += len(dataset.hashes)
                if not args.json:
                    show_progress(f"적재 확인 · {dataset.path.name}", completed, total)
        else:
            async with SessionLocal() as session:
                versions = []
                for dataset in datasets:
                    version = await matching_version(
                        session, dataset, args.model, args.dimensions, args.build_profile
                    )
                    if version is None:
                        raise ValueError(
                            f"{dataset.path.name}: 먼저 load --execute를 실행해 주세요"
                        )
                    await assert_snapshot(session, dataset, version)
                    versions.append(version)
            usage = rag.EmbeddingUsage()
            embedder = None
            try:
                # 재사용만 필요하면 SDK 클라이언트·키 없이도 실행한다.
                async def call(texts):
                    nonlocal embedder
                    if embedder is None:
                        embedder = rag.OpenAIEmbedder(
                            settings.openai_api_key.get_secret_value(),
                            args.model,
                            args.dimensions,
                            args.max_api_calls,
                            usage,
                        )
                    return await embedder(texts)

                await rag.embed_versions(
                    SessionLocal,
                    versions,
                    args.model,
                    args.dimensions,
                    call,
                    batch_size=args.batch_size,
                    count_tokens=count_tokens,
                    usage=usage,
                    progress=None
                    if args.json
                    else lambda done, total: show_progress("임베딩 저장", done, total),
                )
            finally:
                if embedder:
                    await embedder.close()
                report["embedding_usage"] = usage.report(price)
                # JSON 성공 결과는 마지막에 한 번만 출력하고, 실패 사용량은 stderr에 남긴다.
                if not args.json or sys.exception() is not None:
                    print(
                        f"임베딩 사용량 · API 시도 {usage.api_calls:,}회 | 신규 본문 {usage.generated:,}종 | "
                        f"재사용 행 {usage.reused:,}개 | 입력 {usage.input_tokens:,}토큰 | "
                        f"추정 비용 USD {usage.report(price)['estimated_usd']}",
                        file=sys.stderr if args.json else sys.stdout,
                        flush=True,
                    )
        async with SessionLocal() as session:
            report["verified"] = await verify(
                session,
                datasets,
                args.model,
                args.dimensions,
                args.build_profile,
                args.command == "embed",
                progress=None
                if args.json
                else lambda done, total: show_progress("검증", done, total),
            )
    report["executed"] = True
    show_report(report, args.command, args.json)


def parser():
    result = argparse.ArgumentParser(description="전처리 CSV 수동 적재·임베딩 (기본: 읽기 전용)")
    result.add_argument(
        "--activate",
        action="store_true",
        help="verify --require-embeddings 통과 후 버전을 활성화 (DB 상태 변경)",
    )
    result.add_argument("--json", action="store_true", help="기계 처리용 JSON으로 출력")
    result.add_argument("command", choices=("plan", "load", "embed", "verify"))
    result.add_argument(
        "--directory", type=Path, default=Path(__file__).resolve().parents[2] / "data" / "processed"
    )
    result.add_argument(
        "--dataset", action="append", help="CSV 확장자를 제외한 이름. 반복 지정 가능"
    )
    result.add_argument(
        "--execute", action="store_true", help="load의 DB 쓰기 / embed의 API 호출 허용"
    )
    result.add_argument("--model", default=settings.openai_embedding_model)
    result.add_argument("--dimensions", type=int, default=1536)
    result.add_argument("--build-profile", default=BUILD_PROFILE)
    result.add_argument("--batch-size", type=int, default=64)
    result.add_argument(
        "--max-api-calls", type=int, default=50, help="재시도를 포함한 실제 호출 상한"
    )
    result.add_argument("--price-per-million", type=Decimal, help="USD/백만 입력 토큰, 예상 비용용")
    result.add_argument(
        "--require-embeddings", action="store_true", help="verify에서 미완료 임베딩을 실패 처리"
    )
    return result


def main():
    try:
        asyncio.run(run(parser().parse_args()))
    except (ValueError, OSError, csv.Error, SQLAlchemyError):
        # SDK/DB/파일 오류에는 비밀키·원문 값이 포함될 수 있어 예외 원문은 출력하지 않는다.
        # 자체 검증 오류만 안전한 메시지로 출력한다.
        exc = sys.exception()
        message = str(exc) if isinstance(exc, ValueError) else "파일·DB 연결·스키마 오류"
        print(f"실패: {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
