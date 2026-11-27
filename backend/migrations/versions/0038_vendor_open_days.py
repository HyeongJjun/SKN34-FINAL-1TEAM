"""실측 영업일: 업체가 미리 등록한 영업 요일 · 쉬는 날 (2026-11-25 회의)

Revision ID: 0038_vendor_open_days
Revises: 0037_deal_progress
Create Date: 2026-11-25

- vendors.open_weekdays: 실측 받는 요일(월 0 ~ 일 6), 기본 월~토
- vendors.off_days: 쉬는 날(120개까지)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0038_vendor_open_days"
down_revision: str | Sequence[str] | None = "0037_deal_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "vendors",
        sa.Column(
            "open_weekdays",
            postgresql.ARRAY(sa.SmallInteger()),
            server_default="{0,1,2,3,4,5}",
            nullable=False,
        ),
    )
    op.add_column(
        "vendors",
        sa.Column("off_days", postgresql.ARRAY(sa.Date()), server_default="{}", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_vendors_open_weekdays"),
        "vendors",
        "open_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(open_weekdays) >= 1",
    )
    op.create_check_constraint(
        op.f("ck_vendors_off_days"), "vendors", "cardinality(off_days) <= 120"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_vendors_off_days"), "vendors", type_="check")
    op.drop_constraint(op.f("ck_vendors_open_weekdays"), "vendors", type_="check")
    op.drop_column("vendors", "off_days")
    op.drop_column("vendors", "open_weekdays")
