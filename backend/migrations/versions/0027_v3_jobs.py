"""v3 기한 일(jobs): 상태를 바꾸는 service가 같은 트랜잭션에 넣고 worker가 1분마다 거둔다 (D14 A)

Revision ID: 0027_v3_jobs
Revises: 0026_v3_visit
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027_v3_jobs"
down_revision: str | Sequence[str] | None = "0026_v3_visit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KINDS = (
    "('visit_reply_due', 'visit_pick_due', 'visit_accept_due', 'visit_proposal_due',"
    " 'visit_change_due', 'visit_reminder', 'visit_quote_due', 'quote_valid_soon',"
    " 'deal_dates_due', 'deal_request_due', 'deal_done_remind', 'deal_auto_done',"
    " 'thread_redact')"
)
STATUSES = "('pending', 'running', 'done', 'skipped', 'failed', 'cancelled')"
FINISHED = "('done', 'skipped', 'failed', 'cancelled')"


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("ref_id", sa.Uuid(), nullable=True),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="pending", nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=60), nullable=True),
        sa.Column("dedup_key", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(f"kind in {KINDS}", name="kind"),
        sa.CheckConstraint(f"status in {STATUSES}", name="status"),
        sa.CheckConstraint("attempts between 0 and 10", name="attempts"),
        sa.CheckConstraint("(status = 'running') = (locked_until is not null)", name="locked"),
        sa.CheckConstraint(f"(status in {FINISHED}) = (done_at is not null)", name="done_at"),
        sa.CheckConstraint(
            "last_error is null or length(btrim(last_error)) > 0", name="last_error"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedup_key", name="uq_jobs_dedup_key"),
    )
    # 수거: pending이고 run_at이 지난 것 · 멈춘 running(locked_until 지남)
    op.create_index(
        "ix_jobs_due", "jobs", ["run_at"], postgresql_where=sa.text("status = 'pending'")
    )
    op.create_index(
        "ix_jobs_stuck", "jobs", ["locked_until"], postgresql_where=sa.text("status = 'running'")
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_stuck", table_name="jobs")
    op.drop_index("ix_jobs_due", table_name="jobs")
    op.drop_table("jobs")
