"""가견적 단가: 근거 파일 · 단가 묶음(draft · confirmed · retired) · 표준 행 단가

Revision ID: 0008_v2_vendor_price
Revises: 0007_v2_vendor_profile
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_v2_vendor_price"
down_revision: str | Sequence[str] | None = "0007_v2_vendor_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRADE = "trade in ('dobae', 'mokgong')"


def upgrade() -> None:
    op.create_table(
        "vendor_price_files",
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(TRADE, name="trade"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("file_id"),
    )
    op.create_index("ix_vendor_price_files_vendor_id", "vendor_price_files", ["vendor_id"])

    op.create_table(
        "vendor_price_sets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="draft", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(TRADE, name="trade"),
        sa.CheckConstraint("version >= 1", name="version"),
        sa.CheckConstraint("status in ('draft', 'confirmed', 'retired')", name="status"),
        sa.CheckConstraint("(status = 'draft') = (confirmed_at is null)", name="confirmed_at"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vendor_id", "trade", "version", name="uq_vendor_price_sets_version"),
    )
    op.create_index("ix_vendor_price_sets_vendor_id", "vendor_price_sets", ["vendor_id"])
    # (업체, 공정)마다 고치는 중인 묶음 하나, 고객에게 쓰는 묶음 하나
    for status in ("draft", "confirmed"):
        op.create_index(
            f"uq_vendor_price_sets_{status}",
            "vendor_price_sets",
            ["vendor_id", "trade"],
            unique=True,
            postgresql_where=sa.text(f"status = '{status}'"),
        )

    op.create_table(
        "vendor_price_lines",
        sa.Column("set_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=20), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=True),
        sa.Column("included_in", sa.String(length=20), nullable=True),
        sa.Column("source_file_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "(unit_price is null) <> (included_in is null)", name="price_or_included"
        ),
        sa.CheckConstraint("unit_price >= 0", name="unit_price"),
        sa.CheckConstraint("included_in <> key", name="included_in"),
        sa.ForeignKeyConstraint(["set_id"], ["vendor_price_sets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_file_id"], ["files.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("set_id", "key"),
    )
    op.create_index(
        "ix_vendor_price_lines_source_file_id", "vendor_price_lines", ["source_file_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_vendor_price_lines_source_file_id", table_name="vendor_price_lines")
    op.drop_table("vendor_price_lines")
    for status in ("confirmed", "draft"):
        op.drop_index(f"uq_vendor_price_sets_{status}", table_name="vendor_price_sets")
    op.drop_index("ix_vendor_price_sets_vendor_id", table_name="vendor_price_sets")
    op.drop_table("vendor_price_sets")
    op.drop_index("ix_vendor_price_files_vendor_id", table_name="vendor_price_files")
    op.drop_table("vendor_price_files")
