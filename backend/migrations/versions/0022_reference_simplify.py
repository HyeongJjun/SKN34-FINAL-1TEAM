"""기준 자료 활성 여부 단순화와 검토·이력 제거.

Revision ID: 0022_reference_simplify
Revises: 0021_v2_cases
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0022_reference_simplify"
down_revision = "0021_v2_cases"
branch_labels = None
depends_on = None

FLAGS = ("historical", "current_rule_usable", "calculation_usable", "reference_usable")


def upgrade() -> None:
    # 검사와 DDL 사이에 상태·이력 변경이 끼어들지 않도록 같은 트랜잭션에서 잠근다.
    op.execute("LOCK TABLE ref_dataset_versions, ref_dataset_events IN ACCESS EXCLUSIVE MODE")
    op.execute("""
        DO $$
        DECLARE event_count bigint;
        BEGIN
            IF EXISTS (
                SELECT 1 FROM ref_dataset_versions
                WHERE status IS NULL OR status NOT IN
                    ('active', 'draft', 'approved', 'retired', 'rejected')
            ) THEN
                RAISE EXCEPTION 'undefined dataset status; migration aborted';
            END IF;
            SELECT count(*) INTO event_count FROM ref_dataset_events;
            RAISE NOTICE 'ref_dataset_events rows to remove: %', event_count;
        END $$
    """)
    op.drop_index("uq_ref_dataset_versions_active", table_name="ref_dataset_versions")
    op.drop_constraint(
        op.f("ck_ref_dataset_versions_status"), "ref_dataset_versions", type_="check"
    )
    op.alter_column("ref_dataset_versions", "status", server_default=None)
    op.alter_column(
        "ref_dataset_versions",
        "status",
        type_=sa.Boolean(),
        existing_type=sa.Text(),
        existing_nullable=False,
        postgresql_using="status = 'active'",
    )
    op.alter_column("ref_dataset_versions", "status", server_default=sa.text("false"))
    op.create_index(
        "uq_ref_dataset_versions_active",
        "ref_dataset_versions",
        ["dataset_key"],
        unique=True,
        postgresql_where=sa.text("status = true"),
    )
    for column in FLAGS:
        op.drop_column("ref_dataset_versions", column)
    op.drop_column("ref_productivity_rows", "semantic_status")
    op.drop_column("rag_chunks", "review_reason")
    # CASCADE를 사용하지 않아 예상하지 못한 외부 의존성이 있으면 전체 롤백한다.
    op.drop_table("ref_dataset_events")


def downgrade() -> None:
    # 제거한 메타데이터·이력은 복원할 수 없다. 비활성 상태는 draft로 되돌린다.
    op.drop_index("uq_ref_dataset_versions_active", table_name="ref_dataset_versions")
    op.alter_column("ref_dataset_versions", "status", server_default=None)
    op.alter_column(
        "ref_dataset_versions",
        "status",
        type_=sa.Text(),
        existing_type=sa.Boolean(),
        existing_nullable=False,
        postgresql_using="CASE WHEN status THEN 'active' ELSE 'draft' END",
    )
    op.alter_column("ref_dataset_versions", "status", server_default="draft")
    op.create_check_constraint(
        op.f("ck_ref_dataset_versions_status"),
        "ref_dataset_versions",
        "status in ('draft', 'approved', 'active', 'retired', 'rejected')",
    )
    op.create_index(
        "uq_ref_dataset_versions_active",
        "ref_dataset_versions",
        ["dataset_key"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    for column in FLAGS:
        op.add_column(
            "ref_dataset_versions",
            sa.Column(column, sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
        op.alter_column("ref_dataset_versions", column, server_default=None)
    op.add_column("ref_productivity_rows", sa.Column("semantic_status", sa.Text(), nullable=True))
    op.add_column("rag_chunks", sa.Column("review_reason", sa.Text(), nullable=True))
    op.create_table(
        "ref_dataset_events",
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("event_no", sa.Integer(), nullable=False),
        sa.Column("from_status", sa.Text(), nullable=True),
        sa.Column("to_status", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint(
            "event_no <> 1 or to_status = 'draft'", name=op.f("ck_ref_dataset_events_initial_to")
        ),
        sa.CheckConstraint(
            "from_status is null or from_status in ('draft', 'approved', 'active', 'retired', 'rejected')",
            name=op.f("ck_ref_dataset_events_from_status"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(details) = 'object'", name=op.f("ck_ref_dataset_events_details")
        ),
        sa.CheckConstraint(
            "to_status in ('draft', 'approved', 'active', 'retired', 'rejected')",
            name=op.f("ck_ref_dataset_events_to_status"),
        ),
        sa.CheckConstraint(
            "(event_no = 1) = (from_status is null)",
            name=op.f("ck_ref_dataset_events_initial_from"),
        ),
        sa.CheckConstraint("event_no > 0", name=op.f("ck_ref_dataset_events_event_no")),
        sa.CheckConstraint(
            "from_status is distinct from to_status",
            name=op.f("ck_ref_dataset_events_status_change"),
        ),
        sa.CheckConstraint("length(btrim(actor)) > 0", name=op.f("ck_ref_dataset_events_actor")),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["ref_dataset_versions.id"],
            name=op.f("fk_ref_dataset_events_dataset_id_ref_dataset_versions"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_id", "event_no", name=op.f("pk_ref_dataset_events")),
    )
