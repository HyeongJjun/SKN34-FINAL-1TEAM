"""실측 요청 · 상태 이력

Revision ID: 0010_v2_visit
Revises: 0009_v2_vendor_review
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_v2_visit"
down_revision: str | Sequence[str] | None = "0009_v2_vendor_review"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUS = "('requested', 'quoted', 'cancelled', 'declined', 'closed', 'chosen')"
LIVE = "status in ('requested', 'quoted', 'chosen')"


def upgrade() -> None:
    op.create_table(
        "visits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=True),
        sa.Column("vendor_name", sa.String(length=100), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="requested", nullable=False),
        sa.Column("share_contact", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("consent_ver", sa.String(length=20), nullable=True),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.String(length=300), nullable=True),
        sa.Column("estimate_set_id", sa.Uuid(), nullable=True),
        sa.Column("estimate_total", sa.BigInteger(), nullable=True),
        sa.Column("decline_code", sa.String(length=12), nullable=True),
        sa.Column("close_reason", sa.String(length=12), nullable=True),
        sa.Column("quote_ver", sa.SmallInteger(), nullable=True),
        sa.Column("contact_until", sa.Date(), nullable=True),
        sa.Column("vendor_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        sa.CheckConstraint("slot between 1 and 3", name="slot"),
        sa.CheckConstraint(f"status in {STATUS}", name="status"),
        sa.CheckConstraint("share_contact = (consent_at is not null)", name="share_contact"),
        sa.CheckConstraint("(consent_ver is null) = (consent_at is null)", name="consent"),
        sa.CheckConstraint("message is null or length(btrim(message)) > 0", name="message"),
        sa.CheckConstraint("estimate_total >= 0", name="estimate_total"),
        sa.CheckConstraint(
            "estimate_set_id is null or estimate_total is not null", name="estimate_set"
        ),
        sa.CheckConstraint(
            "(status = 'declined') = (decline_code is not null)"
            " and (decline_code is null or decline_code in ('full', 'out_of_area', 'other'))",
            name="decline_code",
        ),
        sa.CheckConstraint(
            "(status = 'closed') = (close_reason is not null)"
            " and (close_reason is null or close_reason in ('other_chosen', 'reselected'))",
            name="close_reason",
        ),
        sa.CheckConstraint("quote_ver >= 1", name="quote_ver"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["estimate_set_id"], ["vendor_price_sets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visits_project_id", "visits", ["project_id"])
    op.create_index("ix_visits_vendor_id", "visits", ["vendor_id"])
    # 살아 있는 요청(요청함 · 견적서 옴 · 확정)만: 공정마다 칸 3개, 같은 업체 한 번
    op.create_index(
        "uq_visits_slot",
        "visits",
        ["project_id", "trade", "slot"],
        unique=True,
        postgresql_where=sa.text(LIVE),
    )
    op.create_index(
        "uq_visits_vendor",
        "visits",
        ["project_id", "trade", "vendor_id"],
        unique=True,
        postgresql_where=sa.text(LIVE),
    )
    op.create_table(
        "visit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.String(length=10), nullable=True),
        sa.Column("to_status", sa.String(length=10), nullable=False),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(f"from_status is null or from_status in {STATUS}", name="from_status"),
        sa.CheckConstraint(f"to_status in {STATUS}", name="to_status"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visit_events_visit_id", "visit_events", ["visit_id"])


def downgrade() -> None:
    op.drop_index("ix_visit_events_visit_id", table_name="visit_events")
    op.drop_table("visit_events")
    for name in (
        "uq_visits_vendor",
        "uq_visits_slot",
        "ix_visits_vendor_id",
        "ix_visits_project_id",
    ):
        op.drop_index(name, table_name="visits")
    op.drop_table("visits")
