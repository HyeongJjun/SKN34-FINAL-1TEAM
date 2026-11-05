"""공사 날짜: 업체가 낸 날짜 · 고객의 다른 날짜 요청

Revision ID: 0015_v2_dates
Revises: 0014_v2_quote_file_share
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_v2_dates"
down_revision: str | Sequence[str] | None = "0014_v2_quote_file_share"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JOB_MAX_DAYS = 120  # calc.schedule.JOB_MAX_DAYS
CREW_MAX = 20


def _now(name: str) -> sa.Column:
    return sa.Column(
        name, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "date_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=True),
        sa.Column("wish_dates", sa.ARRAY(sa.Date()), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=False),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        _now("created_at"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status in ('open', 'answered', 'withdrawn')", name="status"),
        sa.CheckConstraint("cardinality(wish_dates) between 1 and 3", name="wish_dates"),
        sa.CheckConstraint("reason is null or length(btrim(reason)) > 0", name="reason"),
        sa.CheckConstraint("(status = 'open') = (closed_at is null)", name="closed"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_date_requests_deal_id", "date_requests", ["deal_id"])
    # 공사마다 열린 요청은 하나
    op.create_index(
        "uq_date_requests_open",
        "date_requests",
        ["deal_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
    )
    op.create_table(
        "date_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("crew", sa.SmallInteger(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("call_on", sa.Date(), nullable=True),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=10), server_default="initial", nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=True),
        sa.Column("plan_version", sa.SmallInteger(), nullable=True),
        sa.Column("status", sa.String(length=12), server_default="pending", nullable=False),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        _now("created_at"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status in ('pending', 'accepted', 'superseded', 'withdrawn')", name="status"
        ),
        sa.CheckConstraint("method in ('app', 'call')", name="method"),
        sa.CheckConstraint("kind in ('initial', 'change')", name="kind"),
        sa.CheckConstraint(
            f"end_date >= start_date and end_date - start_date <= {JOB_MAX_DAYS}", name="dates"
        ),
        sa.CheckConstraint(f"crew between 1 and {CREW_MAX}", name="crew"),
        sa.CheckConstraint("(method = 'call') = (call_on is not null)", name="call_on"),
        sa.CheckConstraint("reason is null or length(btrim(reason)) > 0", name="reason"),
        sa.CheckConstraint("kind = 'initial' or reason is not null", name="change_reason"),
        sa.CheckConstraint("plan_version is null or plan_version >= 1", name="plan_version"),
        sa.CheckConstraint("(status = 'pending') = (decided_at is null)", name="decided"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["request_id"], ["date_requests.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_date_proposals_deal_id", "date_proposals", ["deal_id"])
    # 공사마다 수락 기다리는 날짜는 하나
    op.create_index(
        "uq_date_proposals_pending",
        "date_proposals",
        ["deal_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_table("date_proposals")
    op.drop_table("date_requests")
