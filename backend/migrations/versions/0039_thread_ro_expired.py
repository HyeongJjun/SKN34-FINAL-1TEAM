"""채팅 읽기만 까닭에 '기한 지남(expired)' 더하기

Revision ID: 0039_thread_ro_expired
Revises: 0038_vendor_open_days
Create Date: 2026-11-25

- 0038부터 채팅을 실측 요청 때 열어서, 업체 답 기한 · 고르기 기한이 지나 요청이 끝나면 채팅도 읽기만으로 바꿔요
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0039_thread_ro_expired"
down_revision: str | Sequence[str] | None = "0038_vendor_open_days"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = ("other_chosen", "cancelled", "declined", "withdrawn", "blocked", "admin")
NEW = (*OLD, "expired")


def _check(values: tuple[str, ...]) -> str:
    return "ro_reason is null or ro_reason in (" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_threads_ro_reason"), "threads", type_="check")
    op.create_check_constraint("ro_reason", "threads", _check(NEW))


def downgrade() -> None:
    op.execute("update threads set ro_reason = 'cancelled' where ro_reason = 'expired'")
    op.drop_constraint(op.f("ck_threads_ro_reason"), "threads", type_="check")
    op.create_check_constraint("ro_reason", "threads", _check(OLD))
