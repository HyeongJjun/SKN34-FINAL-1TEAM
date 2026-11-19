"""v3 공사: 날을 하나씩 고르는 공사 날짜, 공사 끝 글 · 사진, 확정 이력 코드,
추가 금액 답 값(approved · rejected · asked) · 판 · 멱등 키 (D23)

Revision ID: 0030_v3_work
Revises: 0029_v3_review_report
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030_v3_work"
down_revision: str | Sequence[str] | None = "0029_v3_review_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JOB_MAX_DAYS = 120


def upgrade() -> None:
    # ---- date_proposals: 업체가 하나씩 고른 공사 날 (V11) ----
    op.add_column("date_proposals", sa.Column("days", postgresql.ARRAY(sa.Date()), nullable=True))
    op.create_check_constraint(
        op.f("ck_date_proposals_days"),
        "date_proposals",
        f"days is null or cardinality(days) between 1 and {JOB_MAX_DAYS}",
    )

    # ---- deals: 수락한 공사 날 · 공사 끝 글 · 올린 때 ----
    op.add_column("deals", sa.Column("work_days", postgresql.ARRAY(sa.Date()), nullable=True))
    op.add_column("deals", sa.Column("done_note", sa.String(length=300), nullable=True))
    op.add_column("deals", sa.Column("done_posted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        op.f("ck_deals_work_days"),
        "deals",
        f"work_days is null or cardinality(work_days) between 1 and {JOB_MAX_DAYS}",
    )
    op.create_check_constraint(
        op.f("ck_deals_done_note"), "deals", "done_note is null or length(btrim(done_note)) > 0"
    )

    # ---- deal_events: 기록용 코드 ----
    op.add_column("deal_events", sa.Column("code", sa.String(length=20), nullable=True))

    # ---- deal_files: 공사 끝 사진 ----
    op.create_table(
        "deal_files",
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("sort between 0 and 9", name="sort"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("deal_id", "file_id"),
        sa.UniqueConstraint("file_id", name="uq_deal_files_file_id"),
    )

    # ---- extra_charges: 답 값 바꿈(ok → approved, talk → asked) · 판 · 멱등 키 ----
    op.drop_constraint(op.f("ck_extra_charges_ack"), "extra_charges", type_="check")
    op.execute(
        "update extra_charges set ack = case ack when 'ok' then 'approved'"
        " when 'talk' then 'asked' else ack end"
    )
    op.create_check_constraint(
        op.f("ck_extra_charges_ack"),
        "extra_charges",
        "ack in ('pending', 'approved', 'rejected', 'asked')",
    )
    op.add_column("extra_charges", sa.Column("group_id", sa.Uuid(), nullable=True))
    op.execute("update extra_charges set group_id = id")
    op.alter_column("extra_charges", "group_id", existing_type=sa.Uuid(), nullable=False)
    op.add_column(
        "extra_charges",
        sa.Column("version", sa.SmallInteger(), server_default="1", nullable=False),
    )
    op.add_column(
        "extra_charges", sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("extra_charges", sa.Column("client_key", sa.Uuid(), nullable=True))
    op.create_check_constraint(op.f("ck_extra_charges_version"), "extra_charges", "version >= 1")
    op.create_unique_constraint(
        "uq_extra_charges_group_version", "extra_charges", ["group_id", "version"]
    )
    op.create_index(
        "uq_extra_charges_latest",
        "extra_charges",
        ["group_id"],
        unique=True,
        postgresql_where=sa.text("superseded_at is null"),
    )
    op.create_unique_constraint(
        "uq_extra_charges_client_key", "extra_charges", ["deal_id", "client_key"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_extra_charges_client_key", "extra_charges", type_="unique")
    op.drop_index("uq_extra_charges_latest", table_name="extra_charges")
    op.drop_constraint("uq_extra_charges_group_version", "extra_charges", type_="unique")
    op.drop_constraint(op.f("ck_extra_charges_version"), "extra_charges", type_="check")
    for col in ("client_key", "superseded_at", "version", "group_id"):
        op.drop_column("extra_charges", col)
    # 거절(rejected)은 예전 값이 없어서 '이야기하자'로 둔다
    op.drop_constraint(op.f("ck_extra_charges_ack"), "extra_charges", type_="check")
    op.execute(
        "update extra_charges set ack = case ack when 'approved' then 'ok'"
        " when 'asked' then 'talk' when 'rejected' then 'talk' else ack end"
    )
    op.create_check_constraint(
        op.f("ck_extra_charges_ack"), "extra_charges", "ack in ('pending', 'ok', 'talk')"
    )

    op.drop_table("deal_files")
    op.drop_column("deal_events", "code")
    op.drop_constraint(op.f("ck_deals_done_note"), "deals", type_="check")
    op.drop_constraint(op.f("ck_deals_work_days"), "deals", type_="check")
    for col in ("done_posted_at", "done_note", "work_days"):
        op.drop_column("deals", col)
    op.drop_constraint(op.f("ck_date_proposals_days"), "date_proposals", type_="check")
    op.drop_column("date_proposals", "days")
