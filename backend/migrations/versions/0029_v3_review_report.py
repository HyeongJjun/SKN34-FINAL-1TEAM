"""v3 리뷰 · 답글 · 사진, 신고 · 관리자 처리 기록 (dev-07)

Revision ID: 0029_v3_review_report
Revises: 0028_v3_thread
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029_v3_review_report"
down_revision: str | Sequence[str] | None = "0028_v3_thread"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ADMIN_ACTIONS = (
    "('suspend_user', 'unsuspend_user', 'warn_vendor', 'mute_vendor', 'unmute_vendor',"
    " 'suspend_vendor', 'unsuspend_vendor', 'hide_review', 'show_review', 'link_shown',"
    " 'link_hidden', 'dismiss_report')"
)


def _now(name: str = "created_at") -> sa.Column:
    return sa.Column(
        name, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    # ---- reviews: 공사 확정 한 건에 하나 (탈퇴해도 글은 남긴다, L08) ----
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=True),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column(
            "tags", postgresql.ARRAY(sa.String(length=12)), server_default="{}", nullable=False
        ),
        sa.Column("body", sa.String(length=1000), nullable=True),
        sa.Column("context_label", sa.String(length=60), nullable=False),
        sa.Column("status", sa.String(length=8), server_default="shown", nullable=False),
        sa.Column("hidden_code", sa.String(length=12), nullable=True),
        _now(),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("rating between 1 and 5", name="rating"),
        sa.CheckConstraint(
            "tags <@ array['seam', 'on_time', 'kind', 'tidy']::varchar[]", name="tags"
        ),
        sa.CheckConstraint("body is null or length(btrim(body)) > 0", name="body"),
        sa.CheckConstraint("status in ('shown', 'hidden')", name="status"),
        sa.CheckConstraint(
            "hidden_code is null or hidden_code in ('abuse', 'privacy', 'unrelated', 'paid')",
            name="hidden_code",
        ),
        sa.CheckConstraint("(status = 'hidden') = (hidden_code is not null)", name="hidden"),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deal_id", name="uq_reviews_deal_id"),
    )
    op.create_index("ix_reviews_author_id", "reviews", ["author_id"])
    op.create_index("ix_reviews_vendor_created", "reviews", ["vendor_id", "created_at"])

    op.create_table(
        "review_photos",
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("sort", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("sort between 0 and 4", name="sort"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("review_id", "file_id"),
        sa.UniqueConstraint("file_id", name="uq_review_photos_file_id"),
    )

    op.create_table(
        "review_replies",
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.String(length=1000), nullable=False),
        _now(),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(btrim(body)) > 0", name="body"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("review_id"),
    )
    op.create_index("ix_review_replies_vendor_id", "review_replies", ["vendor_id"])

    # ---- reports: 채팅 · 업체 · 링크 신고 한 표 ----
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=8), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=True),
        sa.Column("vendor_id", sa.Uuid(), nullable=True),
        sa.Column("thread_id", sa.Uuid(), nullable=True),
        sa.Column("message_id", sa.Uuid(), nullable=True),
        sa.Column("link_sort", sa.SmallInteger(), nullable=True),
        sa.Column("reason_code", sa.String(length=12), nullable=False),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column("evidence", sa.String(length=1000), nullable=True),
        sa.Column("block", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=False),
        sa.Column("action", sa.String(length=12), nullable=True),
        sa.Column("admin_note", sa.String(length=300), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        _now(),
        sa.CheckConstraint("kind in ('chat', 'vendor', 'link')", name="kind"),
        sa.CheckConstraint(
            "(kind in ('chat', 'vendor') and reason_code in ('offsite', 'abuse', 'promise', 'other'))"
            " or (kind = 'link' and reason_code in ('wrong_place', 'not_vendor', 'other'))",
            name="reason_code",
        ),
        sa.CheckConstraint("link_sort between 0 and 2", name="link_sort"),
        sa.CheckConstraint("(kind = 'link') = (link_sort is not null)", name="link"),
        sa.CheckConstraint("status in ('open', 'resolved', 'dismissed')", name="status"),
        sa.CheckConstraint(
            "action is null or action in"
            " ('warn', 'mute_chat', 'suspend_new', 'suspend_all', 'hide_link', 'none')",
            name="action",
        ),
        sa.CheckConstraint("(status = 'open') = (action is null)", name="open_action"),
        sa.CheckConstraint("(status = 'open') = (resolved_at is null)", name="resolved"),
        sa.CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["message_id"], ["thread_messages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_vendor_id", "reports", ["vendor_id"])
    op.create_index("ix_reports_status_created", "reports", ["status", "created_at"])
    # 같은 글 두 번 신고 막기 (처리 기다리는 동안)
    op.create_index(
        "uq_reports_message_open",
        "reports",
        ["reporter_id", "message_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open' and message_id is not null"),
    )

    # ---- admin_actions: 관리자 처리 기록 ----
    op.create_table(
        "admin_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("admin_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=True),
        sa.Column("report_id", sa.Uuid(), nullable=True),
        sa.Column("review_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.String(length=300), nullable=True),
        _now("at"),
        sa.CheckConstraint(f"action in {ADMIN_ACTIONS}", name="action"),
        sa.CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_actions_target_user_id", "admin_actions", ["target_user_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_actions_target_user_id", table_name="admin_actions")
    op.drop_table("admin_actions")
    for name in ("uq_reports_message_open", "ix_reports_status_created", "ix_reports_vendor_id"):
        op.drop_index(name, table_name="reports")
    op.drop_table("reports")
    op.drop_index("ix_review_replies_vendor_id", table_name="review_replies")
    op.drop_table("review_replies")
    op.drop_table("review_photos")
    op.drop_index("ix_reviews_vendor_created", table_name="reviews")
    op.drop_index("ix_reviews_author_id", table_name="reviews")
    op.drop_table("reviews")
