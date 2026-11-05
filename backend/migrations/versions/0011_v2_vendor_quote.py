"""업체 실측 견적서 버전 · 파일 (임시 저장 · 보내기)

Revision ID: 0011_v2_vendor_quote
Revises: 0010_v2_visit
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_v2_vendor_quote"
down_revision: str | Sequence[str] | None = "0010_v2_visit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SENT_FIELDS = " and ".join(f"{c} is not null" for c in ("entered_amount", "vat_mode", "total"))


def upgrade() -> None:
    op.execute("create sequence vendor_quote_code_seq")
    op.create_table(
        "vendor_quotes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("measured_on", sa.Date(), nullable=True),
        sa.Column("entered_amount", sa.BigInteger(), nullable=True),
        sa.Column("vat_mode", sa.String(length=10), nullable=True),
        sa.Column("supply", sa.BigInteger(), nullable=True),
        sa.Column("vat", sa.BigInteger(), nullable=True),
        sa.Column("total", sa.BigInteger(), nullable=True),
        sa.Column("days", sa.SmallInteger(), nullable=True),
        sa.Column("valid_until", sa.Date(), nullable=True),
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
        sa.CheckConstraint("version >= 1", name="version"),
        sa.CheckConstraint("code ~ '^Q-[0-9]{4}-[0-9]{4,}$'", name="code"),
        sa.CheckConstraint("vat_mode in ('included', 'excluded', 'exempt')", name="vat_mode"),
        sa.CheckConstraint("entered_amount >= 0", name="entered_amount"),
        sa.CheckConstraint(
            "(supply is null) = (total is null) and (vat is null) = (total is null)"
            " and (total is null or (supply >= 0 and vat >= 0 and total = supply + vat))",
            name="money",
        ),
        sa.CheckConstraint(
            "total is null or (entered_amount is not null and vat_mode is not null)",
            name="money_from",
        ),
        sa.CheckConstraint(
            "vat_mode is distinct from 'exempt' or vat is null or vat = 0", name="exempt"
        ),
        sa.CheckConstraint("days between 1 and 120", name="days"),
        sa.CheckConstraint("valid_until >= measured_on", name="valid_until"),
        sa.CheckConstraint(f"sent_at is null or ({SENT_FIELDS})", name="sent_fields"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_vendor_quotes_code"),
        sa.UniqueConstraint("visit_id", "version", name="uq_vendor_quotes_version"),
    )
    op.create_index("ix_vendor_quotes_visit_id", "vendor_quotes", ["visit_id"])
    # 임시 저장본은 요청마다 하나
    op.create_index(
        "uq_vendor_quotes_draft",
        "vendor_quotes",
        ["visit_id"],
        unique=True,
        postgresql_where=sa.text("sent_at is null"),
    )
    op.create_table(
        "vendor_quote_files",
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("sort between 0 and 9", name="sort"),
        sa.ForeignKeyConstraint(["quote_id"], ["vendor_quotes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("quote_id", "file_id"),
        sa.UniqueConstraint("file_id", name="uq_vendor_quote_files_file_id"),
    )


def downgrade() -> None:
    op.drop_table("vendor_quote_files")
    op.drop_index("uq_vendor_quotes_draft", table_name="vendor_quotes")
    op.drop_index("ix_vendor_quotes_visit_id", table_name="vendor_quotes")
    op.drop_table("vendor_quotes")
    op.execute("drop sequence vendor_quote_code_seq")
