"""공사 전에 할 일 체크

Revision ID: 0018_v2_checks
Revises: 0017_v2_extra
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_v2_checks"
down_revision: str | Sequence[str] | None = "0017_v2_extra"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_checks",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=30), nullable=False),
        sa.Column(
            "done_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("key in ('office_report')", name="key"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("project_id", "key"),
    )


def downgrade() -> None:
    op.drop_table("project_checks")
