"""v3 고객-업체 채팅: threads · thread_messages · thread_reads, files.kind 3개 더 (dev-05)

Revision ID: 0028_v3_thread
Revises: 0027_v3_jobs
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0028_v3_thread"
down_revision: str | Sequence[str] | None = "0027_v3_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "kind in ('photo', 'plan', 'license', 'portfolio', 'price_doc', 'quote_doc', 'work_photo')"
)
NEW_KINDS = (
    "kind in ('photo', 'plan', 'license', 'portfolio', 'price_doc', 'quote_doc',"
    " 'work_photo', 'chat_photo', 'review_photo', 'done_photo')"
)
RO_REASONS = "('other_chosen', 'cancelled', 'declined', 'withdrawn', 'blocked', 'admin')"


def upgrade() -> None:
    # ---- files.kind: 채팅 · 리뷰 · 공사 끝 사진 (review_photo가 12자라 칸을 늘린다) ----
    op.drop_constraint(op.f("ck_files_kind"), "files", type_="check")
    op.alter_column(
        "files",
        "kind",
        type_=sa.String(length=12),
        existing_type=sa.String(length=10),
        existing_nullable=False,
    )
    op.create_check_constraint(op.f("ck_files_kind"), "files", NEW_KINDS)

    # ---- threads ----
    op.create_table(
        "threads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("vendor_id", sa.Uuid(), nullable=True),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("visit_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=False),
        sa.Column("ro_reason", sa.String(length=12), nullable=True),
        sa.Column("last_seq", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("customer_label", sa.String(length=40), nullable=False),
        sa.Column("vendor_label", sa.String(length=100), nullable=False),
        sa.Column("area_label", sa.String(length=60), nullable=False),
        sa.Column("vendor_muted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("address_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status in ('open', 'read_only')", name="status"),
        sa.CheckConstraint(f"ro_reason is null or ro_reason in {RO_REASONS}", name="ro_reason"),
        sa.CheckConstraint("(status = 'open') = (ro_reason is null)", name="read_only"),
        sa.CheckConstraint("last_seq >= 0", name="last_seq"),
        # 탈퇴해도 업체 쪽 글은 남긴다 (C53)
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "vendor_id", name="uq_threads_project_vendor"),
    )
    op.create_index("ix_threads_customer_last", "threads", ["customer_id", "last_message_at"])
    op.create_index("ix_threads_vendor_last", "threads", ["vendor_id", "last_message_at"])

    # ---- thread_messages ----
    op.create_table(
        "thread_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("sender_role", sa.String(length=8), nullable=False),
        sa.Column("sender_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=8), nullable=False),
        sa.Column("body", sa.String(length=1000), nullable=True),
        sa.Column("file_id", sa.Uuid(), nullable=True),
        sa.Column("system_code", sa.String(length=30), nullable=True),
        sa.Column("ref_id", sa.Uuid(), nullable=True),
        sa.Column("warn", sa.String(length=8), nullable=True),
        sa.Column("client_key", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("redacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("seq >= 1", name="seq"),
        sa.CheckConstraint("sender_role in ('customer', 'vendor', 'system')", name="sender_role"),
        sa.CheckConstraint("kind in ('text', 'photo', 'system')", name="kind"),
        sa.CheckConstraint("(kind = 'system') = (sender_role = 'system')", name="system_sender"),
        sa.CheckConstraint("kind <> 'system' or system_code is not null", name="system_code"),
        sa.CheckConstraint(
            "kind <> 'text' or body is not null or redacted_at is not null", name="text_body"
        ),
        sa.CheckConstraint("body is null or length(btrim(body)) > 0", name="body"),
        sa.CheckConstraint("warn is null or warn = 'offsite'", name="warn"),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thread_id", "seq", name="uq_thread_messages_seq"),
        sa.UniqueConstraint(
            "thread_id", "sender_id", "client_key", name="uq_thread_messages_client_key"
        ),
    )
    op.create_index("ix_thread_messages_file_id", "thread_messages", ["file_id"])

    # ---- thread_reads ----
    op.create_table(
        "thread_reads",
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("last_read_seq", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint("last_read_seq >= 0", name="last_read_seq"),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("thread_id", "user_id"),
    )


def downgrade() -> None:
    op.drop_table("thread_reads")
    op.drop_index("ix_thread_messages_file_id", table_name="thread_messages")
    op.drop_table("thread_messages")
    op.drop_index("ix_threads_vendor_last", table_name="threads")
    op.drop_index("ix_threads_customer_last", table_name="threads")
    op.drop_table("threads")

    # 새 사진 종류는 가장 가까운 옛 종류로 (고객 사진 · 업체 공사 사진)
    op.drop_constraint(op.f("ck_files_kind"), "files", type_="check")
    op.execute(
        "update files set kind = case kind when 'done_photo' then 'work_photo' else 'photo' end"
        " where kind in ('chat_photo', 'review_photo', 'done_photo')"
    )
    op.alter_column(
        "files",
        "kind",
        type_=sa.String(length=10),
        existing_type=sa.String(length=12),
        existing_nullable=False,
    )
    op.create_check_constraint(op.f("ck_files_kind"), "files", OLD_KINDS)
