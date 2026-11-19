"""v3 기본 정보: 동 · 예산(원) · 만든 길 · 멱등 키, 공사 범위 · 면, 공간 종류, 표준견적서 범위 사본

Revision ID: 0024_v3_project
Revises: 0023_reference_simplify
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024_v3_project"
down_revision: str | Sequence[str] | None = "0023_reference_simplify"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FACES = "array['wall', 'ceiling']::varchar[]"
SPACE_KINDS = "('living', 'kitchen', 'master', 'room1', 'room2', 'hall', 'entry', 'dress')"


def upgrade() -> None:
    # ---- projects ----
    op.add_column("projects", sa.Column("emd", sa.String(length=20), nullable=True))
    op.add_column("projects", sa.Column("budget_won", sa.BigInteger(), nullable=True))
    op.add_column(
        "projects",
        sa.Column("source", sa.String(length=8), server_default="v2", nullable=False),
    )
    op.add_column("projects", sa.Column("client_key", sa.Uuid(), nullable=True))
    op.create_check_constraint(
        op.f("ck_projects_budget_won"),
        "projects",
        "budget_won is null or (budget_won between 100000 and 10000000000"
        " and budget_won % 10000 = 0)",
    )
    op.create_check_constraint(
        op.f("ck_projects_source"), "projects", "source in ('v2', 'guest', 'member')"
    )
    op.create_unique_constraint("uq_projects_client_key", "projects", ["owner_id", "client_key"])

    # ---- project_trades ----
    op.add_column(
        "project_trades",
        sa.Column("scope", sa.String(length=8), server_default="full", nullable=False),
    )
    op.add_column(
        "project_trades",
        sa.Column(
            "faces",
            postgresql.ARRAY(sa.String(length=8)),
            server_default=sa.text("'{wall,ceiling}'"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_project_trades_scope"), "project_trades", "scope in ('full', 'partial')"
    )
    op.create_check_constraint(
        op.f("ck_project_trades_faces"),
        "project_trades",
        f"faces <@ {FACES} and cardinality(faces) between 1 and 2",
    )
    op.create_check_constraint(
        op.f("ck_project_trades_full_faces"),
        "project_trades",
        f"scope <> 'full' or faces @> {FACES}",
    )

    # ---- project_spaces ----
    op.add_column("project_spaces", sa.Column("kind", sa.String(length=12), nullable=True))
    op.create_check_constraint(
        op.f("ck_project_spaces_kind"), "project_spaces", f"kind is null or kind in {SPACE_KINDS}"
    )
    op.create_index(
        "uq_project_spaces_kind",
        "project_spaces",
        ["project_id", "kind"],
        unique=True,
        postgresql_where=sa.text("kind is not null"),
    )

    # ---- standard_quotes ----
    op.add_column(
        "standard_quotes",
        sa.Column("scope", sa.String(length=8), server_default="full", nullable=False),
    )
    op.add_column(
        "standard_quotes",
        sa.Column(
            "faces",
            postgresql.ARRAY(sa.String(length=8)),
            server_default=sa.text("'{wall,ceiling}'"),
            nullable=False,
        ),
    )
    op.add_column(
        "standard_quotes",
        sa.Column(
            "space_keys",
            postgresql.ARRAY(sa.String(length=12)),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column("standard_quotes", sa.Column("share_ver", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        op.f("ck_standard_quotes_scope"), "standard_quotes", "scope in ('full', 'partial')"
    )
    op.create_check_constraint(
        op.f("ck_standard_quotes_faces"),
        "standard_quotes",
        f"faces <@ {FACES} and cardinality(faces) between 1 and 2",
    )
    op.create_check_constraint(
        op.f("ck_standard_quotes_share_ver"),
        "standard_quotes",
        "(scope = 'partial') = (share_ver is not null)",
    )


def downgrade() -> None:
    for name in ("share_ver", "faces", "scope"):
        op.drop_constraint(op.f(f"ck_standard_quotes_{name}"), "standard_quotes", type_="check")
    for col in ("share_ver", "space_keys", "faces", "scope"):
        op.drop_column("standard_quotes", col)

    op.drop_index("uq_project_spaces_kind", table_name="project_spaces")
    op.drop_constraint(op.f("ck_project_spaces_kind"), "project_spaces", type_="check")
    op.drop_column("project_spaces", "kind")

    for name in ("full_faces", "faces", "scope"):
        op.drop_constraint(op.f(f"ck_project_trades_{name}"), "project_trades", type_="check")
    op.drop_column("project_trades", "faces")
    op.drop_column("project_trades", "scope")

    op.drop_constraint("uq_projects_client_key", "projects", type_="unique")
    op.drop_constraint(op.f("ck_projects_source"), "projects", type_="check")
    op.drop_constraint(op.f("ck_projects_budget_won"), "projects", type_="check")
    for col in ("client_key", "source", "budget_won", "emd"):
        op.drop_column("projects", col)
