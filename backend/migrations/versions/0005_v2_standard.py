"""표준견적서 버전 · 줄

Revision ID: 0005_v2_standard
Revises: 0004_v2_project
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_v2_standard"
down_revision: str | Sequence[str] | None = "0004_v2_project"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "standard_quotes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False),
        sa.Column("project_rev", sa.SmallInteger(), nullable=False),
        sa.Column("formula_ver", sa.String(length=20), nullable=False),
        sa.Column("price_ver", sa.String(length=20), nullable=False),
        sa.Column("grade", sa.String(length=10), nullable=True),
        sa.Column("area_m2", sa.Numeric(7, 1), nullable=False),
        sa.Column("area_basis", sa.String(length=10), nullable=False),
        sa.Column("pyeong", sa.Numeric(5, 1), nullable=False),
        sa.Column("supply", sa.BigInteger(), nullable=False),
        sa.Column("vat", sa.BigInteger(), nullable=False),
        sa.Column("total", sa.BigInteger(), nullable=False),
        sa.Column("man_day", sa.Numeric(4, 1), nullable=False),
        sa.Column("crew", sa.SmallInteger(), nullable=False),
        sa.Column(
            "notes", postgresql.ARRAY(sa.String(length=200)), server_default="{}", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        sa.CheckConstraint("version >= 1", name="version"),
        sa.CheckConstraint("supply >= 0 and vat >= 0 and total = supply + vat", name="money"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "trade", "version", name="uq_standard_quotes_version"),
    )
    op.create_index("ix_standard_quotes_project_id", "standard_quotes", ["project_id"])
    op.create_table(
        "standard_quote_lines",
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("qty", sa.Numeric(9, 1), nullable=True),
        sa.Column("unit", sa.String(length=10), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=True),
        sa.Column("amount", sa.BigInteger(), nullable=True),
        sa.Column("state", sa.String(length=12), nullable=False),
        sa.Column("basis", sa.String(length=10), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "state in ('included', 'bundled', 'separate', 'optional', 'after_visit', 'excluded')",
            name="state",
        ),
        sa.CheckConstraint("basis in ('public', 'assumed', 'none')", name="basis"),
        sa.ForeignKeyConstraint(["quote_id"], ["standard_quotes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("quote_id", "key"),
    )


def downgrade() -> None:
    op.drop_table("standard_quote_lines")
    op.drop_index("ix_standard_quotes_project_id", table_name="standard_quotes")
    op.drop_table("standard_quotes")
