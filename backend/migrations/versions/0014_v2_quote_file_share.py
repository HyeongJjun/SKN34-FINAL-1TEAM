"""실측 견적서 파일: 같은 요청의 버전끼리 같은 파일 다시 붙이기

Revision ID: 0014_v2_quote_file_share
Revises: 0013_v2_deal
Create Date: 2026-11-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014_v2_quote_file_share"
down_revision: str | Sequence[str] | None = "0013_v2_deal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_vendor_quote_files_file_id", "vendor_quote_files", type_="unique")
    op.create_index(
        op.f("ix_vendor_quote_files_file_id"), "vendor_quote_files", ["file_id"], unique=False
    )


def downgrade() -> None:
    # 같이 쓰는 파일은 가장 처음 버전에만 남기고 뒤 버전의 연결을 지운다
    op.execute(
        """
        delete from vendor_quote_files f
        using vendor_quotes q
        where q.id = f.quote_id
          and exists (
            select 1
            from vendor_quote_files f2
            join vendor_quotes q2 on q2.id = f2.quote_id
            where f2.file_id = f.file_id
              and (q2.version, q2.created_at, q2.id) < (q.version, q.created_at, q.id)
          )
        """
    )
    op.drop_index(op.f("ix_vendor_quote_files_file_id"), table_name="vendor_quote_files")
    op.create_unique_constraint("uq_vendor_quote_files_file_id", "vendor_quote_files", ["file_id"])
