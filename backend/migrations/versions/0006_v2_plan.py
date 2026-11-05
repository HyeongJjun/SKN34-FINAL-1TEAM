"""공정표 버전 · 칸 · 날짜별 할 일

Revision ID: 0006_v2_plan
Revises: 0005_v2_standard
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_v2_plan"
down_revision: str | Sequence[str] | None = "0005_v2_standard"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False),
        sa.Column("project_rev", sa.SmallInteger(), nullable=False),
        sa.Column("formula_ver", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("work_days", sa.SmallInteger(), nullable=False),
        sa.Column("weekend_work", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("kind in ('expected', 'final')", name="kind"),
        sa.CheckConstraint("version >= 1", name="version"),
        sa.CheckConstraint("end_date >= start_date", name="dates"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "kind", "version", name="uq_plans_version"),
    )
    op.create_index("ix_plans_project_id", "plans", ["project_id"])
    op.create_table(
        "plan_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days", sa.SmallInteger(), nullable=False),
        sa.Column("crew", sa.SmallInteger(), nullable=True),
        sa.Column("man_day", sa.Numeric(4, 1), nullable=True),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("kind in ('work', 'dry', 'clean')", name="kind"),
        sa.CheckConstraint("trade is null or trade in ('dobae', 'mokgong')", name="trade"),
        sa.CheckConstraint("(kind = 'work') = (trade is not null)", name="trade_kind"),
        sa.CheckConstraint("end_date >= start_date and days >= 1", name="dates"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plan_steps_plan_id", "plan_steps", ["plan_id"])
    op.create_table(
        "plan_days",
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column(
            "names", postgresql.ARRAY(sa.String(length=60)), server_default="{}", nullable=False
        ),
        sa.CheckConstraint("kind in ('work', 'dry', 'clean', 'off')", name="kind"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("plan_id", "day"),
    )


def downgrade() -> None:
    op.drop_table("plan_days")
    op.drop_index("ix_plan_steps_plan_id", table_name="plan_steps")
    op.drop_table("plan_steps")
    op.drop_index("ix_plans_project_id", table_name="plans")
    op.drop_table("plans")
