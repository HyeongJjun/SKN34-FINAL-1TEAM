"""업체 정보: 연락 방식 · 통화 시간 · 실측 비용 · 자주 묻는 5가지 · 링크 · 사진 칸 · 새 파일 종류

Revision ID: 0007_v2_vendor_profile
Revises: 0006_v2_plan
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_v2_vendor_profile"
down_revision: str | Sequence[str] | None = "0006_v2_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = "kind in ('photo', 'plan', 'license', 'portfolio')"
NEW_KINDS = (
    "kind in ('photo', 'plan', 'license', 'portfolio', 'price_doc', 'quote_doc', 'work_photo')"
)
VENDOR_CHECKS = {
    "phone": "phone ~ '^01[0-9]{8,9}$'",
    "contact_method": "contact_method in ('phone', 'sms', 'kakao', 'web')",
    "contact_url": "contact_method not in ('kakao', 'web') or contact_url is not null",
    "call_time": "(call_start is null) = (call_end is null)"
    " and (call_start is null or call_start < call_end)",
    "visit_fee": "visit_fee >= 0",
    "visit_fee_refund": "not visit_fee_refund or visit_fee > 0",
    "tax_kind": "tax_kind in ('general', 'exempt')",
}
VENDOR_COLUMNS = (
    "contact_method",
    "contact_url",
    "call_start",
    "call_end",
    "visit_fee",
    "visit_fee_refund",
    "tax_kind",
    "interior_license",
    "insurance",
    "opened_on",
    "updated_at",
)


def upgrade() -> None:
    op.add_column("vendors", sa.Column("contact_method", sa.String(length=5), nullable=True))
    op.add_column("vendors", sa.Column("contact_url", sa.String(length=300), nullable=True))
    op.add_column("vendors", sa.Column("call_start", sa.Time(), nullable=True))
    op.add_column("vendors", sa.Column("call_end", sa.Time(), nullable=True))
    op.add_column("vendors", sa.Column("visit_fee", sa.BigInteger(), nullable=True))
    op.add_column(
        "vendors",
        sa.Column("visit_fee_refund", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "vendors",
        sa.Column("tax_kind", sa.String(length=10), server_default="general", nullable=False),
    )
    op.add_column("vendors", sa.Column("interior_license", sa.String(length=100), nullable=True))
    op.add_column("vendors", sa.Column("insurance", sa.String(length=100), nullable=True))
    op.add_column("vendors", sa.Column("opened_on", sa.Date(), nullable=True))
    op.add_column("vendors", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    for name, cond in VENDOR_CHECKS.items():
        op.create_check_constraint(name, "vendors", cond)

    op.add_column("vendor_portfolio", sa.Column("space", sa.String(length=20), nullable=True))
    op.add_column("vendor_portfolio", sa.Column("pyeong", sa.SmallInteger(), nullable=True))
    op.add_column("vendor_portfolio", sa.Column("taken_on", sa.Date(), nullable=True))
    op.create_check_constraint("pyeong", "vendor_portfolio", "pyeong between 1 and 200")

    op.drop_constraint(op.f("ck_files_kind"), "files", type_="check")
    op.create_check_constraint("kind", "files", NEW_KINDS)
    op.alter_column(
        "files",
        "content_type",
        existing_type=sa.String(length=50),
        type_=sa.String(length=100),
        existing_nullable=False,
    )

    op.create_table(
        "vendor_faqs",
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=12), nullable=False),
        sa.Column("answer", sa.String(length=200), nullable=False),
        sa.CheckConstraint(
            "key in ('process', 'pricing', 'extra_cost', 'duration', 'as_refund')", name="key"
        ),
        sa.CheckConstraint("length(btrim(answer)) > 0", name="answer"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("vendor_id", "key"),
    )
    op.create_table(
        "vendor_links",
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=True),
        sa.Column("url", sa.String(length=300), nullable=False),
        sa.CheckConstraint("sort between 0 and 4", name="sort"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("vendor_id", "sort"),
    )


def downgrade() -> None:
    op.drop_table("vendor_links")
    op.drop_table("vendor_faqs")

    # 새 종류 파일은 예전 표에 들어가지 않는다 (저장소의 내용은 정리 작업이 지운다)
    op.execute("delete from files where kind in ('price_doc', 'quote_doc', 'work_photo')")
    op.alter_column(
        "files",
        "content_type",
        existing_type=sa.String(length=100),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
    op.drop_constraint(op.f("ck_files_kind"), "files", type_="check")
    op.create_check_constraint("kind", "files", OLD_KINDS)

    op.drop_constraint(op.f("ck_vendor_portfolio_pyeong"), "vendor_portfolio", type_="check")
    for col in ("taken_on", "pyeong", "space"):
        op.drop_column("vendor_portfolio", col)

    for name in VENDOR_CHECKS:
        op.drop_constraint(op.f(f"ck_vendors_{name}"), "vendors", type_="check")
    for col in reversed(VENDOR_COLUMNS):
        op.drop_column("vendors", col)
