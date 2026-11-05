"""업체 심사: 보완 요청(needs_info) · 사유 코드 · 보낼 말 · 승인 시각 · 심사 이력

Revision ID: 0009_v2_vendor_review
Revises: 0008_v2_vendor_price
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_v2_vendor_review"
down_revision: str | Sequence[str] | None = "0008_v2_vendor_price"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INFO = "('blurry', 'name_mismatch', 'owner_mismatch', 'other')"
REJECT = "('wrong_business', 'closed', 'other')"
VENDOR_CHECKS = {
    "status": "status in ('pending', 'needs_info', 'approved', 'rejected')",
    "review_code": "(status in ('needs_info', 'rejected')) = (review_code is not null)",
    "review_code_kind": f"review_code is null or (status = 'needs_info' and review_code in {INFO})"
    f" or (status = 'rejected' and review_code in {REJECT})",
    "review_note": "review_note is null"
    " or (review_code is not null and length(btrim(review_note)) > 0)",
    "review_other": "review_code is distinct from 'other' or review_note is not null",
    "approved_at": "(status = 'approved') = (approved_at is not null)",
}
OLD_CHECKS = {
    "status": "status in ('pending', 'approved', 'rejected')",
    "reject_reason": "(status = 'rejected') = (reject_reason is not null)",
    "reject_reason_text": "reject_reason is null or length(btrim(reject_reason)) > 0",
}
# 되돌릴 때 거절 사유 문장이 비어 있으면 코드의 화면 말로 채운다 (예전 표는 사유 문장이 꼭 있어야 한다)
REJECT_LABEL = {
    "wrong_business": "업종이 인테리어 공사와 맞지 않아요",
    "closed": "휴업 · 폐업 상태예요",
}


def upgrade() -> None:
    for name in OLD_CHECKS:
        op.drop_constraint(op.f(f"ck_vendors_{name}"), "vendors", type_="check")
    op.alter_column("vendors", "reject_reason", new_column_name="review_note")
    op.add_column("vendors", sa.Column("review_code", sa.String(length=20), nullable=True))
    op.add_column("vendors", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    # 예전 거절은 사유 문장만 있었다: 직접 쓰기(other)로 둔다
    op.execute("update vendors set review_code = 'other' where status = 'rejected'")
    op.execute(
        "update vendors set approved_at = coalesce(reviewed_at, created_at)"
        " where status = 'approved'"
    )
    for name, cond in VENDOR_CHECKS.items():
        op.create_check_constraint(name, "vendors", cond)

    op.create_table(
        "vendor_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=12), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "action in ('apply', 'approve', 'needs_info', 'reject', 'resubmit', 'reapply')",
            name="action",
        ),
        sa.CheckConstraint(
            "(action in ('needs_info', 'reject')) = (code is not null)", name="code"
        ),
        sa.CheckConstraint(
            f"code is null or (action = 'needs_info' and code in {INFO})"
            f" or (action = 'reject' and code in {REJECT})",
            name="code_kind",
        ),
        sa.CheckConstraint(
            "note is null or (code is not null and length(btrim(note)) > 0)", name="note"
        ),
        sa.CheckConstraint("code is distinct from 'other' or note is not null", name="note_other"),
        sa.CheckConstraint("changes is null or action in ('resubmit', 'reapply')", name="changes"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vendor_reviews_vendor_id", "vendor_reviews", ["vendor_id"])
    # 이미 있는 업체의 이력: 가입 신청(가입한 때), 그리고 이미 정한 결정
    op.execute(
        "insert into vendor_reviews (id, vendor_id, action, by_id, at)"
        " select gen_random_uuid(), user_id, 'apply', user_id, created_at from vendors"
    )
    op.execute(
        "insert into vendor_reviews (id, vendor_id, action, code, note, by_id, at)"
        " select gen_random_uuid(), user_id,"
        " case status when 'approved' then 'approve' else 'reject' end,"
        " review_code, review_note, reviewed_by, coalesce(reviewed_at, created_at)"
        " from vendors where status in ('approved', 'rejected')"
    )


def downgrade() -> None:
    op.drop_index("ix_vendor_reviews_vendor_id", table_name="vendor_reviews")
    op.drop_table("vendor_reviews")
    for name in VENDOR_CHECKS:
        op.drop_constraint(op.f(f"ck_vendors_{name}"), "vendors", type_="check")
    for code, label in REJECT_LABEL.items():
        op.execute(
            sa.text(
                "update vendors set review_note = :label"
                " where status = 'rejected' and review_code = :code and review_note is null"
            ).bindparams(label=label, code=code)
        )
    # 보완 요청은 예전 상태에 없다: 심사 중으로 돌린다
    op.execute(
        "update vendors set status = 'pending', review_note = null where status = 'needs_info'"
    )
    op.drop_column("vendors", "approved_at")
    op.drop_column("vendors", "review_code")
    op.alter_column("vendors", "review_note", new_column_name="reject_reason")
    for name, cond in OLD_CHECKS.items():
        op.create_check_constraint(name, "vendors", cond)
