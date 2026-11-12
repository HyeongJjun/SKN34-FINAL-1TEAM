"""대화 저장: 대화방과 주고받은 말

Revision ID: 0022_chat
Revises: 0021_v2_cases
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_chat"
down_revision: str | Sequence[str] | None = "0021_v2_cases"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chats",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("rev", sa.Integer(), server_default="1", nullable=False),
        sa.Column("waiting", sa.String(length=30), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("rev >= 1", name=op.f("ck_chats_rev")),
        sa.CheckConstraint(
            "waiting is null or waiting in ('orchestrator', 'trade', 'quote_explanation', 'schedule')",
            name=op.f("ck_chats_waiting"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_chats_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chats")),
    )
    op.create_index(op.f("ix_chats_user_id"), "chats", ["user_id"])
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chat_id", sa.Uuid(), nullable=False),
        sa.Column("turn", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("intent_label", sa.String(length=30), nullable=True),
        sa.Column("intent_confidence", sa.Float(), nullable=True),
        sa.Column("intent_source", sa.String(length=10), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("turn >= 1", name=op.f("ck_chat_messages_turn")),
        sa.CheckConstraint("role in ('user', 'assistant')", name=op.f("ck_chat_messages_role")),
        sa.CheckConstraint(
            "intent_label is null or intent_label in"
            " ('orchestrator', 'trade', 'quote_explanation', 'schedule', 'out_of_scope')",
            name=op.f("ck_chat_messages_intent_label"),
        ),
        sa.CheckConstraint(
            "intent_confidence is null or intent_confidence between 0 and 1",
            name=op.f("ck_chat_messages_intent_confidence"),
        ),
        sa.CheckConstraint(
            "intent_source is null or intent_source in ('rule', 'model', 'jev', 'button')",
            name=op.f("ck_chat_messages_intent_source"),
        ),
        sa.ForeignKeyConstraint(
            ["chat_id"],
            ["chats.id"],
            name=op.f("fk_chat_messages_chat_id_chats"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_messages")),
        sa.UniqueConstraint("chat_id", "turn", "role", name="uq_chat_messages_chat_turn_role"),
    )


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_index(op.f("ix_chats_user_id"), table_name="chats")
    op.drop_table("chats")
