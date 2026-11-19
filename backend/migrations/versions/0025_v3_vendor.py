"""v3 업체: 바로 확정 기본값 · 멈춤 · 반나절 받는 수(L03) · 간이과세(L02) · 거절 사유 하나 더,
단가 묶음 줄 판 · 줄 받는 법(mode), 시공 사진 ㎡ · 벽지, 외부 리뷰 링크, 실측 견적서 '포함됐나요?' 칩

Revision ID: 0025_v3_vendor
Revises: 0024_v3_project
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_v3_vendor"
down_revision: str | Sequence[str] | None = "0024_v3_project"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CODE_KIND = (
    "{code} is null"
    " or ({status} = '{info}' and {code} in ('blurry', 'name_mismatch', 'owner_mismatch', 'other'))"
    " or ({status} = '{rej}' and {code} in ({rej_codes}))"
)
OLD_REJ = "'wrong_business', 'closed', 'other'"
NEW_REJ = "'wrong_business', 'closed', 'info_mismatch', 'other'"
MISMATCH_NOTE = "사업자등록증과 신청 정보가 달라요."


def _code_kinds(rej_codes: str) -> None:
    op.drop_constraint(op.f("ck_vendors_review_code_kind"), "vendors", type_="check")
    op.create_check_constraint(
        op.f("ck_vendors_review_code_kind"),
        "vendors",
        CODE_KIND.format(
            code="review_code", status="status", info="needs_info", rej="rejected",
            rej_codes=rej_codes,
        ),
    )  # fmt: skip
    op.drop_constraint(op.f("ck_vendor_reviews_code_kind"), "vendor_reviews", type_="check")
    op.create_check_constraint(
        op.f("ck_vendor_reviews_code_kind"),
        "vendor_reviews",
        CODE_KIND.format(
            code="code", status="action", info="needs_info", rej="reject", rej_codes=rej_codes
        ),
    )


def upgrade() -> None:
    # ---- vendors ----
    op.add_column(
        "vendors",
        sa.Column("instant_default", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("vendors", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("vendors", sa.Column("suspend_scope", sa.String(length=4), nullable=True))
    op.add_column(
        "vendors",
        sa.Column("visit_capacity", sa.SmallInteger(), server_default="2", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_vendors_suspend_scope"),
        "vendors",
        "suspend_scope is null or suspend_scope in ('new', 'all')",
    )
    op.create_check_constraint(
        op.f("ck_vendors_suspended"), "vendors", "(suspended_at is null) = (suspend_scope is null)"
    )
    op.create_check_constraint(
        op.f("ck_vendors_visit_capacity"), "vendors", "visit_capacity between 1 and 3"
    )
    op.drop_constraint(op.f("ck_vendors_tax_kind"), "vendors", type_="check")
    op.create_check_constraint(
        op.f("ck_vendors_tax_kind"), "vendors", "tax_kind in ('general', 'simplified', 'exempt')"
    )
    _code_kinds(NEW_REJ)

    # ---- vendor_price_sets: 줄 판 ----
    op.add_column(
        "vendor_price_sets",
        sa.Column("rows_ver", sa.String(length=12), server_default="dobae_v2", nullable=False),
    )
    op.execute("update vendor_price_sets set rows_ver = 'mokgong_v1' where trade = 'mokgong'")
    op.create_check_constraint(
        op.f("ck_vendor_price_sets_rows_ver"),
        "vendor_price_sets",
        "rows_ver in ('dobae_v2', 'dobae_v3', 'mokgong_v1')",
    )
    op.create_check_constraint(
        op.f("ck_vendor_price_sets_rows_ver_trade"),
        "vendor_price_sets",
        "(trade = 'mokgong') = (rows_ver = 'mokgong_v1')",
    )

    # ---- vendor_price_lines: 받는 법 ----
    op.add_column(
        "vendor_price_lines",
        sa.Column("mode", sa.String(length=10), server_default="price", nullable=False),
    )
    op.execute("update vendor_price_lines set mode = 'included' where included_in is not null")
    op.drop_constraint(
        op.f("ck_vendor_price_lines_price_or_included"), "vendor_price_lines", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_vendor_price_lines_mode"),
        "vendor_price_lines",
        "mode in ('price', 'included', 'excluded')",
    )
    op.create_check_constraint(
        op.f("ck_vendor_price_lines_mode_price"),
        "vendor_price_lines",
        "(mode = 'price') = (unit_price is not null)",
    )
    op.create_check_constraint(
        op.f("ck_vendor_price_lines_mode_included"),
        "vendor_price_lines",
        "(mode = 'included') = (included_in is not null)",
    )

    # ---- vendor_portfolio ----
    op.add_column("vendor_portfolio", sa.Column("area_m2", sa.Numeric(7, 1), nullable=True))
    op.add_column("vendor_portfolio", sa.Column("paper", sa.String(length=10), nullable=True))
    op.create_check_constraint(
        op.f("ck_vendor_portfolio_area_m2"), "vendor_portfolio", "area_m2 > 0"
    )
    op.create_check_constraint(
        op.f("ck_vendor_portfolio_paper"),
        "vendor_portfolio",
        "paper is null or paper in ('economy', 'basic')",
    )

    # ---- vendor_quotes: '포함됐나요?' 칩 4칸 (D21) ----
    op.add_column("vendor_quotes", sa.Column("incl_removal", sa.Boolean(), nullable=True))
    op.add_column("vendor_quotes", sa.Column("incl_waste", sa.Boolean(), nullable=True))
    op.add_column("vendor_quotes", sa.Column("paper_spec", sa.String(length=60), nullable=True))
    op.add_column("vendor_quotes", sa.Column("warranty_months", sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        op.f("ck_vendor_quotes_paper_spec"),
        "vendor_quotes",
        "paper_spec is null or length(btrim(paper_spec)) > 0",
    )
    op.create_check_constraint(
        op.f("ck_vendor_quotes_warranty_months"),
        "vendor_quotes",
        "warranty_months between 0 and 120",
    )

    # ---- vendor_review_links: 외부 리뷰 링크 (V18) ----
    op.create_table(
        "vendor_review_links",
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=True),
        sa.Column("url", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="checking", nullable=False),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column("checked_by", sa.Uuid(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sort between 0 and 2", name="sort"),
        sa.CheckConstraint("url ~ '^https://'", name="url"),
        sa.CheckConstraint("status in ('checking', 'shown', 'hidden')", name="status"),
        sa.CheckConstraint("(status = 'checking') = (checked_at is null)", name="checked"),
        sa.CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["checked_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("vendor_id", "sort"),
    )


def downgrade() -> None:
    op.drop_table("vendor_review_links")

    op.drop_constraint(op.f("ck_vendor_quotes_warranty_months"), "vendor_quotes", type_="check")
    op.drop_constraint(op.f("ck_vendor_quotes_paper_spec"), "vendor_quotes", type_="check")
    for col in ("warranty_months", "paper_spec", "incl_waste", "incl_removal"):
        op.drop_column("vendor_quotes", col)

    op.drop_constraint(op.f("ck_vendor_portfolio_paper"), "vendor_portfolio", type_="check")
    op.drop_constraint(op.f("ck_vendor_portfolio_area_m2"), "vendor_portfolio", type_="check")
    op.drop_column("vendor_portfolio", "paper")
    op.drop_column("vendor_portfolio", "area_m2")

    # 예전 규칙(단가 또는 포함 하나)으로: '빼기' 줄은 예전에 없던 것이라 지운다
    for name in ("mode_included", "mode_price", "mode"):
        op.drop_constraint(
            op.f(f"ck_vendor_price_lines_{name}"), "vendor_price_lines", type_="check"
        )
    op.execute("delete from vendor_price_lines where mode = 'excluded'")
    op.create_check_constraint(
        op.f("ck_vendor_price_lines_price_or_included"),
        "vendor_price_lines",
        "(unit_price is null) <> (included_in is null)",
    )
    op.drop_column("vendor_price_lines", "mode")

    op.drop_constraint(
        op.f("ck_vendor_price_sets_rows_ver_trade"), "vendor_price_sets", type_="check"
    )
    op.drop_constraint(op.f("ck_vendor_price_sets_rows_ver"), "vendor_price_sets", type_="check")
    op.drop_column("vendor_price_sets", "rows_ver")

    # 간이과세 → 일반과세, info_mismatch → other(보낼 말이 없으면 채운다)
    op.execute("update vendors set tax_kind = 'general' where tax_kind = 'simplified'")
    op.execute(
        f"update vendors set review_code = 'other', review_note = coalesce(review_note,"
        f" '{MISMATCH_NOTE}') where review_code = 'info_mismatch'"
    )
    op.execute(
        f"update vendor_reviews set code = 'other', note = coalesce(note, '{MISMATCH_NOTE}')"
        " where code = 'info_mismatch'"
    )
    _code_kinds(OLD_REJ)
    op.drop_constraint(op.f("ck_vendors_tax_kind"), "vendors", type_="check")
    op.create_check_constraint(
        op.f("ck_vendors_tax_kind"), "vendors", "tax_kind in ('general', 'exempt')"
    )
    for name in ("visit_capacity", "suspended", "suspend_scope"):
        op.drop_constraint(op.f(f"ck_vendors_{name}"), "vendors", type_="check")
    for col in ("visit_capacity", "suspend_scope", "suspended_at", "instant_default"):
        op.drop_column("vendors", col)
