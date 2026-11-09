"""행별 원본 기록과 임베딩 차원 검증.

Revision ID: 0020_ingest_provenance
Revises: 0019_reference_data
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0020_ingest_provenance"
down_revision = "0019_reference_data"
branch_labels = None
depends_on = None

TABLES = (
    "ref_floorplan_rows",
    "ref_unit_price_rows",
    "ref_productivity_rows",
    "ref_wage_rows",
    "rag_chunks",
)


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("provenance", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        )
    # 차원 미고정 vector를 유지하면서 부모 버전의 차원과 일치하도록 강제한다.
    op.execute("""
        CREATE FUNCTION check_rag_embedding_profile() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE dims integer;
        BEGIN
            IF NEW.embedding IS NOT NULL THEN
                SELECT embedding_dimensions INTO dims FROM ref_dataset_versions
                WHERE id = NEW.dataset_id FOR SHARE;
                IF vector_dims(NEW.embedding) IS DISTINCT FROM dims THEN
                    RAISE EXCEPTION 'embedding dimension mismatch' USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END $$
    """)
    op.execute("""
        CREATE TRIGGER rag_embedding_profile BEFORE INSERT OR UPDATE ON rag_chunks
        FOR EACH ROW EXECUTE FUNCTION check_rag_embedding_profile()
    """)
    op.execute("""
        CREATE FUNCTION protect_rag_embedding_profile() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF (NEW.embedding_model, NEW.embedding_dimensions) IS DISTINCT FROM
               (OLD.embedding_model, OLD.embedding_dimensions) AND EXISTS
               (SELECT 1 FROM rag_chunks WHERE dataset_id = OLD.id AND embedding IS NOT NULL) THEN
                RAISE EXCEPTION 'embedding profile is immutable' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END $$
    """)
    op.execute("""
        CREATE TRIGGER dataset_embedding_profile BEFORE UPDATE ON ref_dataset_versions
        FOR EACH ROW EXECUTE FUNCTION protect_rag_embedding_profile()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER dataset_embedding_profile ON ref_dataset_versions")
    op.execute("DROP FUNCTION protect_rag_embedding_profile()")
    op.execute("DROP TRIGGER rag_embedding_profile ON rag_chunks")
    op.execute("DROP FUNCTION check_rag_embedding_profile()")
    for table in reversed(TABLES):
        op.drop_column(table, "provenance")
