"""현장 정보(주차 · 엘리베이터 · 출입 방법)와 공사 전 준비 체크 항목 3개 (시연 피드백 2026-11-23)

Revision ID: 0036_site_info_prep_checks
Revises: 0035_v3_vendor_stopped
Create Date: 2026-11-23

- projects.parking · elevator · entry_note: 업체가 방문을 준비할 때 보는 칸. 주소가 아니다.
- project_checks.key: 관리사무소 신고 하나에서 가구 옮기기 · 깨지기 쉬운 물건 · 이웃 알림을 더한다(업체도 본다).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036_site_info_prep_checks"
down_revision: str | Sequence[str] | None = "0035_v3_vendor_stopped"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KEYS_NEW = "('office_report', 'furniture_moved', 'fragile_away', 'neighbors_told')"


def upgrade() -> None:
    op.add_column("projects", sa.Column("parking", sa.String(length=3), nullable=True))
    op.add_column("projects", sa.Column("elevator", sa.String(length=3), nullable=True))
    op.add_column("projects", sa.Column("entry_note", sa.String(length=100), nullable=True))
    op.create_check_constraint(
        op.f("ck_projects_parking"), "projects", "parking is null or parking in ('yes', 'no')"
    )
    op.create_check_constraint(
        op.f("ck_projects_elevator"), "projects", "elevator is null or elevator in ('yes', 'no')"
    )
    op.create_check_constraint(
        op.f("ck_projects_entry_note"),
        "projects",
        "entry_note is null or length(btrim(entry_note)) > 0",
    )
    op.drop_constraint(op.f("ck_project_checks_key"), "project_checks", type_="check")
    op.create_check_constraint(
        op.f("ck_project_checks_key"), "project_checks", f"key in {KEYS_NEW}"
    )


def downgrade() -> None:
    # 새 항목으로 켠 체크는 옛 제약에 맞지 않아 지운다
    op.execute("delete from project_checks where key <> 'office_report'")
    op.drop_constraint(op.f("ck_project_checks_key"), "project_checks", type_="check")
    op.create_check_constraint(
        op.f("ck_project_checks_key"), "project_checks", "key in ('office_report')"
    )
    op.drop_constraint(op.f("ck_projects_entry_note"), "projects", type_="check")
    op.drop_constraint(op.f("ck_projects_elevator"), "projects", type_="check")
    op.drop_constraint(op.f("ck_projects_parking"), "projects", type_="check")
    op.drop_column("projects", "entry_note")
    op.drop_column("projects", "elevator")
    op.drop_column("projects", "parking")
