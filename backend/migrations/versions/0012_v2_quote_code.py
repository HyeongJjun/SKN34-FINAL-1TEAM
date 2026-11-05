"""실측 견적서 번호를 요청마다 하나로: 다시 올려도 같은 번호에 버전만 올린다

Revision ID: 0012_v2_quote_code
Revises: 0011_v2_vendor_quote
Create Date: 2026-11-03
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012_v2_quote_code"
down_revision: str | Sequence[str] | None = "0011_v2_vendor_quote"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_vendor_quotes_code", "vendor_quotes", type_="unique")
    op.create_unique_constraint(
        "uq_vendor_quotes_code_version", "vendor_quotes", ["code", "version"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_vendor_quotes_code_version", "vendor_quotes", type_="unique")
    # 예전에는 버전마다 번호가 달랐다: 2번째 버전부터 새 번호를 매긴다
    op.execute(
        "update vendor_quotes set code = 'Q-'"
        " || to_char(created_at at time zone 'Asia/Seoul', 'YYMM')"
        " || '-' || lpad(nextval('vendor_quote_code_seq')::text, 4, '0')"
        " where version > 1"
    )
    op.create_unique_constraint("uq_vendor_quotes_code", "vendor_quotes", ["code"])
