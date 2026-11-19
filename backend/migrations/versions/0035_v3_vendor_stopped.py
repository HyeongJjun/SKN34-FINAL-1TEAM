"""v3 업체 멈춤으로 닫은 실측 요청: visits.close_reason에 vendor_stopped (리드 지시 2026-11-19)

Revision ID: 0035_v3_vendor_stopped
Revises: 0034_v3_stage1
Create Date: 2026-11-19

관리자가 업체를 멈추면(scope all) 진행 중 요청을 닫는다. 지금까지는 다시 고르기(reselected) 값을
빌려 썼는데, 고객 상태판에서 다시 고르기로 닫힌 요청은 숨겨져서 까닭이 안 보였다. 칸을 16자로 넓힌다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035_v3_vendor_stopped"
down_revision: str | Sequence[str] | None = "0034_v3_stage1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CK = (
    "(status = 'closed') = (close_reason is not null)"
    " and (close_reason is null or close_reason in {reasons})"
)


def upgrade() -> None:
    op.drop_constraint(op.f("ck_visits_close_reason"), "visits", type_="check")
    op.alter_column(
        "visits",
        "close_reason",
        existing_type=sa.String(length=12),
        type_=sa.String(length=16),
        existing_nullable=True,
    )
    op.create_check_constraint(
        op.f("ck_visits_close_reason"),
        "visits",
        CK.format(reasons="('other_chosen', 'reselected', 'vendor_stopped')"),
    )


def downgrade() -> None:
    # 예전 값 목록에서는 다시 고르기(reselected)로 닫았다
    op.execute(
        "update visits set close_reason = 'reselected' where close_reason = 'vendor_stopped'"
    )
    op.drop_constraint(op.f("ck_visits_close_reason"), "visits", type_="check")
    op.alter_column(
        "visits",
        "close_reason",
        existing_type=sa.String(length=16),
        type_=sa.String(length=12),
        existing_nullable=True,
    )
    op.create_check_constraint(
        op.f("ck_visits_close_reason"),
        "visits",
        CK.format(reasons="('other_chosen', 'reselected')"),
    )
