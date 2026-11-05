"""확정한 공사 날짜 바꾸기: 고객 요청에 답한 새 날짜는 업체 이유 없이

Revision ID: 0016_v2_date_change
Revises: 0015_v2_dates
Create Date: 2026-11-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016_v2_date_change"
down_revision: str | Sequence[str] | None = "0015_v2_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAME = "ck_date_proposals_change_reason"


def upgrade() -> None:
    op.drop_constraint(op.f(NAME), "date_proposals", type_="check")
    op.create_check_constraint(
        op.f(NAME),
        "date_proposals",
        "kind = 'initial' or reason is not null or request_id is not null",
    )


def downgrade() -> None:
    # 예전 규칙(바꿀 때는 업체 이유 필수)으로: 요청에 답한 새 날짜에는 요청의 이유를 옮겨 적는다
    op.execute(
        """
        update date_proposals p
        set reason = coalesce(r.reason, '고객 요청에 답한 날짜')
        from date_requests r
        where r.id = p.request_id and p.kind = 'change' and p.reason is null
        """
    )
    op.drop_constraint(op.f(NAME), "date_proposals", type_="check")
    op.create_check_constraint(
        op.f(NAME), "date_proposals", "kind = 'initial' or reason is not null"
    )
