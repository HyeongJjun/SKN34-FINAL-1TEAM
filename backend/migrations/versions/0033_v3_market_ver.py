"""v3 벽지 시장가 판 고정: standard_quotes.market_ver, 표준견적서 줄 근거에 market (리드 결정 2026-11-19)

Revision ID: 0033_v3_market_ver
Revises: 0032_v3_file_views
Create Date: 2026-11-19

price_ver(공공 단가 판, 20자)는 그대로 두고 벽지 시장 평균 가격 판(paper-market-2026.11)을 따로 고정한다.
줄 근거(basis)에 market(시장 데이터 기준)을 더한다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033_v3_market_ver"
down_revision: str | Sequence[str] | None = "0032_v3_file_views"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BASIS_NEW = "basis in ('public', 'market', 'assumed', 'none')"
BASIS_OLD = "basis in ('public', 'assumed', 'none')"


def upgrade() -> None:
    op.add_column("standard_quotes", sa.Column("market_ver", sa.String(length=40), nullable=True))
    op.create_check_constraint(
        op.f("ck_standard_quotes_market_ver"),
        "standard_quotes",
        "market_ver is null or length(btrim(market_ver)) > 0",
    )
    op.drop_constraint(op.f("ck_standard_quote_lines_basis"), "standard_quote_lines", type_="check")
    op.create_check_constraint(
        op.f("ck_standard_quote_lines_basis"), "standard_quote_lines", BASIS_NEW
    )


def downgrade() -> None:
    # 시장 데이터 줄은 예전 값 목록에서 가정값(assumed)이었다
    op.execute("update standard_quote_lines set basis = 'assumed' where basis = 'market'")
    op.drop_constraint(op.f("ck_standard_quote_lines_basis"), "standard_quote_lines", type_="check")
    op.create_check_constraint(
        op.f("ck_standard_quote_lines_basis"), "standard_quote_lines", BASIS_OLD
    )
    op.drop_constraint(op.f("ck_standard_quotes_market_ver"), "standard_quotes", type_="check")
    op.drop_column("standard_quotes", "market_ver")
