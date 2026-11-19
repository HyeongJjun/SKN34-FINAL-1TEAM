"""v3 파일 열람 기록(file_views): 사업자등록증을 볼 때마다 한 줄, 1년 이상 남긴다 (B7 부탁, LG-02)

Revision ID: 0032_v3_file_views
Revises: 0030_v3_work
Create Date: 2026-11-18

0032는 data-model.md 1장의 다른 묶음 예약 번호(0032~0035)다. 0031(v3에서 안 쓰는 칸 지우기)은
나중에 만들 때 그때의 head 다음에 둔다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032_v3_file_views"
down_revision: str | Sequence[str] | None = "0030_v3_work"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 파일 · 탈퇴 뒤에도 기록은 남겨야 해서 FK를 두지 않는다
    op.create_table(
        "file_views",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("viewer_id", sa.Uuid(), nullable=False),
        sa.Column("viewer_role", sa.String(length=10), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column(
            "at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("viewer_role in ('customer', 'vendor', 'admin')", name="viewer_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_file_views_owner_at", "file_views", ["owner_id", "at"])


def downgrade() -> None:
    op.drop_index("ix_file_views_owner_at", table_name="file_views")
    op.drop_table("file_views")
