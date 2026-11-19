"""v3 1단계 칸: 요청 사진 · 고른 벽지 · 사례 면적 기준 · AI 대화의 공사 (화면 묶음 · B5 부탁)

Revision ID: 0034_v3_stage1
Revises: 0033_v3_market_ver
Create Date: 2026-11-19

- visit_photos: 실측 요청에 붙인 공간 사진(업체가 보는 요청서, B3 · B2a). 사진 파일은 files(kind photo)
- shortlists.grade · visits.grade: 담기 · 요청 때 고객이 고른 벽지(합지 economy · 실크 basic, B2a C11)
- vendor_portfolio.area_basis: 사례 면적 기준(공급 · 전용, B2a C47)
- chats.project_id: AI 대화를 공사에 묶음(B5, 공사가 지워지면 대화도)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034_v3_stage1"
down_revision: str | Sequence[str] | None = "0033_v3_market_ver"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GRADE = "grade is null or grade in ('economy', 'basic')"


def upgrade() -> None:
    op.create_table(
        "visit_photos",
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=True),
        sa.CheckConstraint("sort between 0 and 9", name="sort"),
        sa.CheckConstraint("label is null or length(btrim(label)) > 0", name="label"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("visit_id", "file_id"),
        sa.UniqueConstraint("visit_id", "sort", name="uq_visit_photos_sort"),
    )
    op.create_index(op.f("ix_visit_photos_file_id"), "visit_photos", ["file_id"])
    for table in ("shortlists", "visits"):
        op.add_column(table, sa.Column("grade", sa.String(length=10), nullable=True))
        op.create_check_constraint(op.f(f"ck_{table}_grade"), table, GRADE)
    op.add_column("vendor_portfolio", sa.Column("area_basis", sa.String(length=10), nullable=True))
    op.create_check_constraint(
        op.f("ck_vendor_portfolio_area_basis"),
        "vendor_portfolio",
        "area_basis is null or (area_basis in ('supply', 'exclusive') and area_m2 is not null)",
    )
    op.add_column("chats", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_chats_project_id_projects"),
        "chats",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    # 공사별 대화 목록(GET /ai/threads?project_id=): 같은 사람 · 같은 공사를 최근 순으로 거꾸로 읽는다
    op.create_index("ix_chats_user_project", "chats", ["user_id", "project_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_chats_user_project", table_name="chats")
    op.drop_constraint(op.f("fk_chats_project_id_projects"), "chats", type_="foreignkey")
    op.drop_column("chats", "project_id")
    op.drop_constraint(op.f("ck_vendor_portfolio_area_basis"), "vendor_portfolio", type_="check")
    op.drop_column("vendor_portfolio", "area_basis")
    for table in ("visits", "shortlists"):
        op.drop_constraint(op.f(f"ck_{table}_grade"), table, type_="check")
        op.drop_column(table, "grade")
    op.drop_index(op.f("ix_visit_photos_file_id"), table_name="visit_photos")
    op.drop_table("visit_photos")
