"""v2 인테리어 한 건(고른 값 · 견적서 · 공정표)

Revision ID: 0021_v2_cases
Revises: 0020_ingest_provenance
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_v2_cases"
down_revision: str | Sequence[str] | None = "0020_ingest_provenance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "v2_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=40), nullable=False),
        sa.Column("state", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("quote", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("plan", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("quote_total", sa.BigInteger(), nullable=True),
        sa.Column("quote_code", sa.String(length=40), nullable=True),
        sa.Column("plan_start", sa.Date(), nullable=True),
        sa.Column("plan_end", sa.Date(), nullable=True),
        sa.Column("work_days", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("char_length(title) between 1 and 40", name="title"),
        sa.CheckConstraint("quote_total is null or quote_total >= 0", name="quote_total"),
        sa.CheckConstraint("plan_end is null or plan_end >= plan_start", name="plan_dates"),
        sa.CheckConstraint("work_days is null or work_days >= 0", name="work_days"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_v2_cases_owner_updated", "v2_cases", ["owner_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_v2_cases_owner_updated", table_name="v2_cases")
    op.drop_table("v2_cases")
