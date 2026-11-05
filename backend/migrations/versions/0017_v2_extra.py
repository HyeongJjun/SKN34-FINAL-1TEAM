"""공사 중 추가 금액 · 사진

Revision ID: 0017_v2_extra
Revises: 0016_v2_date_change
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_v2_extra"
down_revision: str | Sequence[str] | None = "0016_v2_date_change"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AMOUNT_MAX = 1_000_000_000  # schedule.models.EXTRA_AMOUNT_MAX


def upgrade() -> None:
    op.create_table(
        "extra_charges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=40), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=False),
        sa.Column("vat_mode", sa.String(length=10), nullable=False),
        sa.Column("entered_amount", sa.BigInteger(), nullable=False),
        sa.Column("supply", sa.BigInteger(), nullable=False),
        sa.Column("vat", sa.BigInteger(), nullable=False),
        sa.Column("total", sa.BigInteger(), nullable=False),
        sa.Column("ack", sa.String(length=10), server_default="pending", nullable=False),
        sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("length(btrim(title)) > 0", name="title"),
        sa.CheckConstraint("length(btrim(reason)) > 0", name="reason"),
        sa.CheckConstraint("vat_mode in ('included', 'excluded', 'exempt')", name="vat_mode"),
        sa.CheckConstraint(f"entered_amount between 0 and {AMOUNT_MAX}", name="entered_amount"),
        # 합계 = 공급가 + 부가세, 면세면 부가세 0, 적은 금액은 부가세 빼고면 공급가 · 아니면 합계
        sa.CheckConstraint(
            "supply >= 0 and vat >= 0 and total = supply + vat"
            " and (vat_mode <> 'exempt' or vat = 0)"
            " and (case when vat_mode = 'excluded' then supply else total end) = entered_amount",
            name="amounts",
        ),
        sa.CheckConstraint("ack in ('pending', 'ok', 'talk')", name="ack"),
        sa.CheckConstraint("(ack = 'pending') = (acked_at is null)", name="acked"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extra_charges_deal_id", "extra_charges", ["deal_id"])
    op.create_table(
        "extra_charge_files",
        sa.Column("extra_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("sort between 0 and 4", name="sort"),
        sa.ForeignKeyConstraint(["extra_id"], ["extra_charges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("extra_id", "file_id"),
        sa.UniqueConstraint("file_id", name="uq_extra_charge_files_file_id"),
    )


def downgrade() -> None:
    op.drop_table("extra_charge_files")
    op.drop_table("extra_charges")
