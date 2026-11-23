"""공사 진행 기록(사진 · 한 줄) (시연 피드백 2026-11-23)

Revision ID: 0037_deal_progress
Revises: 0036_site_info_prep_checks
Create Date: 2026-11-23

- deal_progress: 업체가 공사하는 동안 올린 날 · 한 줄. 같은 공사에서 client_key는 한 번만.
- deal_progress_files: 기록에 붙인 공사 사진(work_photo). 사진 하나는 한 기록에만, 한 번에 5장까지.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037_deal_progress"
down_revision: str | Sequence[str] | None = "0036_site_info_prep_checks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deal_progress",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=100), nullable=True),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.Column("client_key", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "note is null or length(btrim(note)) > 0", name=op.f("ck_deal_progress_note")
        ),
        sa.ForeignKeyConstraint(
            ["by_id"], ["users.id"], name=op.f("fk_deal_progress_by_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"],
            ["deals.id"],
            name=op.f("fk_deal_progress_deal_id_deals"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deal_progress")),
        sa.UniqueConstraint("deal_id", "client_key", name="uq_deal_progress_client_key"),
    )
    op.create_index(op.f("ix_deal_progress_deal_id"), "deal_progress", ["deal_id"], unique=False)
    op.create_table(
        "deal_progress_files",
        sa.Column("progress_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("sort between 0 and 4", name=op.f("ck_deal_progress_files_sort")),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name=op.f("fk_deal_progress_files_file_id_files"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["progress_id"],
            ["deal_progress.id"],
            name=op.f("fk_deal_progress_files_progress_id_deal_progress"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("progress_id", "file_id", name=op.f("pk_deal_progress_files")),
        sa.UniqueConstraint("file_id", name=op.f("uq_deal_progress_files_file_id")),
    )


def downgrade() -> None:
    op.drop_table("deal_progress_files")
    op.drop_index(op.f("ix_deal_progress_deal_id"), table_name="deal_progress")
    op.drop_table("deal_progress")
