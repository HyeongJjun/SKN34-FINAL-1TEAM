"""회원 휴대폰 번호

Revision ID: 0002_v2_phone
Revises: 0001
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_v2_phone"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.create_check_constraint("phone", "users", "phone ~ '^01[0-9]{8,9}$'")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_phone"), "users", type_="check")
    op.drop_column("users", "phone")
