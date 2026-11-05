"""프로젝트 요청 번호 · 고친 횟수 · 잠금 · 동호수

Revision ID: 0004_v2_project
Revises: 0003_v2_notify
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_v2_project"
down_revision: str | Sequence[str] | None = "0003_v2_notify"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("create sequence project_code_seq")
    op.add_column("projects", sa.Column("code", sa.String(length=16), nullable=True))
    op.add_column(
        "projects", sa.Column("rev", sa.SmallInteger(), server_default="1", nullable=False)
    )
    op.add_column("projects", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("projects", sa.Column("apt_name", sa.String(length=40), nullable=True))
    op.add_column("projects", sa.Column("dong", sa.String(length=10), nullable=True))
    op.add_column("projects", sa.Column("ho", sa.String(length=10), nullable=True))
    # 이미 있는 프로젝트에도 번호를 붙인다 (만든 순서대로)
    op.execute(
        """
        update projects p set code = 'MJ-' || to_char(p.created_at at time zone 'Asia/Seoul', 'YYMM')
          || '-' || lpad(n.no::text, 4, '0')
        from (select id, nextval('project_code_seq') as no from
              (select id from projects order by created_at) o) n
        where p.id = n.id
        """
    )
    op.alter_column("projects", "code", nullable=False)
    op.create_unique_constraint("uq_projects_code", "projects", ["code"])
    op.create_check_constraint("rev", "projects", "rev >= 1")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_projects_rev"), "projects", type_="check")
    op.drop_constraint("uq_projects_code", "projects", type_="unique")
    for col in ("ho", "dong", "apt_name", "locked_at", "rev", "code"):
        op.drop_column("projects", col)
    op.execute("drop sequence project_code_seq")
