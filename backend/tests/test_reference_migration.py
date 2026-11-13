"""기존 테스트 DB에서 상태 변환·실패 롤백·행 보존을 확인한다."""

import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from conftest import query
from sqlalchemy.exc import DBAPIError


def migrate(target, *, downgrade=False):
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "migrations"))
    (command.downgrade if downgrade else command.upgrade)(config, target)


@pytest.mark.parametrize("unknown", [False, True])
def test_status_conversion_and_data_preservation(unknown):
    migrate("0020_ingest_provenance", downgrade=True)
    statuses = ["active", "draft", "approved", "retired", "rejected"]
    kinds = ["knowledge", "floorplan", "unit_price", "productivity", "wage"]
    ids = [uuid.uuid4() for _ in kinds]
    tables = ["rag_chunks"] + [f"ref_{kind}_rows" for kind in kinds[1:]]
    removed = {"rag_chunks": "review_reason", "ref_productivity_rows": "semantic_status"}

    def snapshot(table):
        return query(
            f"SELECT to_jsonb(t) - $1::text AS value FROM {table} t ORDER BY record_key",
            removed.get(table, ""),
        )

    try:
        for ident, kind, status in zip(ids, kinds, statuses, strict=True):
            query(
                """INSERT INTO ref_dataset_versions
                (id,dataset_key,kind,version,source,processed_path,processed_sha256,build_profile,
                 historical,current_rule_usable,calculation_usable,reference_usable,
                 embedding_model,embedding_dimensions,provenance,status)
                VALUES ($1,$2,$2,1,'합성 출처','sample.csv',$3,'test',true,true,true,true,
                        $4,$5,'{}'::jsonb,$6)""",
                ident,
                kind,
                "a" * 64,
                "test-model" if kind == "knowledge" else None,
                3 if kind == "knowledge" else None,
                status,
            )
            query(
                """INSERT INTO ref_dataset_events
                (dataset_id,event_no,from_status,to_status,actor,details)
                VALUES ($1,1,NULL,'draft','test','{}')""",
                ident,
            )
        query(
            """INSERT INTO rag_chunks
            (dataset_id,record_key,section,content,page_numbers,review_reason,content_hash,embedding)
            VALUES ($1,'row','절','보존할 본문',ARRAY[1],'검토',$2,'[1,2,3]')""",
            ids[0],
            "a" * 64,
        )
        query(
            """INSERT INTO ref_floorplan_rows
            (dataset_id,record_key,record_type,original_value,aggregation_role,page,normalized_value)
            VALUES ($1,'row','detail','12.5','detail',1,12.5)""",
            ids[1],
        )
        query(
            """INSERT INTO ref_unit_price_rows(dataset_id,record_key,record_type,normalized_value)
            VALUES ($1,'row','component',-0.125)""",
            ids[2],
        )
        query(
            """INSERT INTO ref_productivity_rows
            (dataset_id,record_key,record_type,division,page,normalized_value,semantic_status)
            VALUES ($1,'row','table_cell','건축',1,0.125,'검토')""",
            ids[3],
        )
        query(
            """INSERT INTO ref_wage_rows
            (dataset_id,record_key,record_type,page,source_text,normalized_value)
            VALUES ($1,'row','page_context',1,'보존할 문맥',NULL)""",
            ids[4],
        )
        before = {table: snapshot(table) for table in tables}
        if unknown:
            query("ALTER TABLE ref_dataset_versions DROP CONSTRAINT ck_ref_dataset_versions_status")
            query("UPDATE ref_dataset_versions SET status='unknown' WHERE id=$1", ids[4])
            with pytest.raises(DBAPIError, match="undefined dataset status"):
                migrate("head")
            assert query("SELECT version_num FROM alembic_version")[0]["version_num"] == (
                "0020_ingest_provenance"
            )
            assert query("SELECT count(*) n FROM ref_dataset_events")[0]["n"] == 5
            assert query("SELECT historical FROM ref_dataset_versions LIMIT 1")[0]["historical"]
            assert {table: snapshot(table) for table in tables} == before
            query("UPDATE ref_dataset_versions SET status='rejected' WHERE id=$1", ids[4])
            query("""ALTER TABLE ref_dataset_versions ADD CONSTRAINT ck_ref_dataset_versions_status
                CHECK (status IN ('active','draft','approved','retired','rejected'))""")
        migrate("head")
        assert {table: snapshot(table) for table in tables} == before
        result = query("SELECT id,status FROM ref_dataset_versions")
        assert {row["id"]: row["status"] for row in result} == dict(
            zip(ids, [True, False, False, False, False], strict=True)
        )
        assert query("SELECT to_regclass('public.ref_dataset_events') AS name")[0]["name"] is None
    finally:
        # 실패해도 뒤 테스트가 이전 스키마를 쓰지 않게 복원한다.
        if query("SELECT version_num FROM alembic_version")[0]["version_num"] == (
            "0020_ingest_provenance"
        ):
            query("UPDATE ref_dataset_versions SET status='rejected' WHERE status='unknown'")
            migrate("head")
