"""업체 확정 · 상태 이력

Revision ID: 0013_v2_deal
Revises: 0012_v2_quote_code
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_v2_deal"
down_revision: str | Sequence[str] | None = "0012_v2_quote_code"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUS = "('confirmed', 'scheduled', 'checking', 'fixing', 'done', 'reselected')"


def upgrade() -> None:
    op.create_table(
        "deals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=True),
        sa.Column("vendor_name", sa.String(length=100), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="confirmed", nullable=False),
        sa.Column("dates_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("work_done_on", sa.Date(), nullable=True),
        sa.Column("date_request_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        sa.CheckConstraint(f"status in {STATUS}", name="status"),
        sa.CheckConstraint("date_request_count between 0 and 2", name="date_request_count"),
        sa.CheckConstraint(
            "(start_date is null) = (end_date is null)"
            " and (start_date is null or end_date >= start_date)",
            name="dates",
        ),
        sa.CheckConstraint(
            "status in ('confirmed', 'reselected') or start_date is not null", name="scheduled"
        ),
        sa.CheckConstraint(
            "(status in ('checking', 'fixing', 'done')) = (work_done_on is not null)",
            name="work_done_on",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        # 확정한 견적서 버전은 지우지 못하게 (ON DELETE 없음)
        sa.ForeignKeyConstraint(["quote_id"], ["vendor_quotes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("visit_id", name="uq_deals_visit_id"),
    )
    op.create_index("ix_deals_project_id", "deals", ["project_id"])
    op.create_index("ix_deals_vendor_id", "deals", ["vendor_id"])
    # 공정마다 살아 있는 확정은 하나 (다시 고르기 한 것은 빼고)
    op.create_index(
        "uq_deals_trade",
        "deals",
        ["project_id", "trade"],
        unique=True,
        postgresql_where=sa.text("status <> 'reselected'"),
    )
    op.create_table(
        "deal_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.String(length=10), nullable=True),
        sa.Column("to_status", sa.String(length=10), nullable=False),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(f"from_status is null or from_status in {STATUS}", name="from_status"),
        sa.CheckConstraint(f"to_status in {STATUS}", name="to_status"),
        sa.CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deal_events_deal_id", "deal_events", ["deal_id"])
    op.add_column("plan_steps", sa.Column("deal_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_plan_steps_deal_id_deals",
        "plan_steps",
        "deals",
        ["deal_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_plan_steps_deal_id_deals", "plan_steps", type_="foreignkey")
    op.drop_column("plan_steps", "deal_id")
    op.drop_index("ix_deal_events_deal_id", table_name="deal_events")
    op.drop_table("deal_events")
    for name in ("uq_deals_trade", "ix_deals_vendor_id", "ix_deals_project_id"):
        op.drop_index(name, table_name="deals")
    op.drop_table("deals")
