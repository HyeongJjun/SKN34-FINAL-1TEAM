"""v3 실측 일정: 담기(shortlists), visits 상태 · 칸 늘림, visit_events 칸 늘림,
업체 기간 · 반나절 잡기(칸 번호, L03) · 바꾸기 요청 · 다른 날 제안

Revision ID: 0026_v3_visit
Revises: 0025_v3_vendor
Create Date: 2026-11-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_v3_visit"
down_revision: str | Sequence[str] | None = "0025_v3_vendor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_STATUS = "('requested', 'quoted', 'cancelled', 'declined', 'closed', 'chosen')"
OLD_LIVE = "status in ('requested', 'quoted', 'chosen')"
STATUS = (
    "('requested', 'offered', 'picked', 'proposed', 'booked', 'visited', 'quoted', 'chosen',"
    " 'declined', 'expired', 'cancelled', 'no_show', 'closed')"
)
LIVE = (
    "status in ('requested', 'offered', 'picked', 'proposed', 'booked', 'visited', 'quoted',"
    " 'chosen')"
)
HALF = "('am', 'pm')"
# 되돌릴 때: 실측 일정 중간 상태는 '요청함'으로, 기한 지남 · 업체가 안 옴은 '취소'로
DOWN_MAP = (
    "case when {c} in ('offered', 'picked', 'proposed', 'booked', 'visited') then 'requested'"
    " when {c} in ('expired', 'no_show') then 'cancelled' else {c} end"
)
VISIT_CHECKS = {
    "attempt": "attempt >= 1",
    "wish": "(wish_start is null and wish_end is null)"
    " or (wish_start is not null and wish_end is not null"
    " and wish_end >= wish_start and wish_end - wish_start <= 62)",
    "booked": "(booked_day is null) = (booked_half is null)"
    f" and (booked_half is null or booked_half in {HALF})",
    "expired_reason": "(status = 'expired') = (expired_reason is not null)"
    " and (expired_reason is null or expired_reason in ('reply', 'pick'))",
    "cancel_code": "cancel_code is null or (status = 'cancelled'"
    " and cancel_code in ('changed', 'other_vendor', 'late_quote', 'other'))",
    "cancel_note": "cancel_note is null"
    " or (cancel_code is not null and length(btrim(cancel_note)) > 0)",
    "decline_note": "decline_note is null"
    " or (decline_code is not null and length(btrim(decline_note)) > 0)",
}
VISIT_COLUMNS = (
    ("attempt", sa.SmallInteger(), "1"),
    ("wish_start", sa.Date(), None),
    ("wish_end", sa.Date(), None),
    ("work_wish_on", sa.Date(), None),
    ("reply_due_at", sa.DateTime(timezone=True), None),
    ("booked_day", sa.Date(), None),
    ("booked_half", sa.String(length=2), None),
    ("quote_due_at", sa.DateTime(timezone=True), None),
    ("expired_reason", sa.String(length=8), None),
    ("cancel_code", sa.String(length=12), None),
    ("cancel_note", sa.String(length=100), None),
    ("decline_note", sa.String(length=100), None),
    ("visited_at", sa.DateTime(timezone=True), None),
    ("requote_at", sa.DateTime(timezone=True), None),
)


def _now() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def _live_indexes(where: str) -> None:
    op.create_index(
        "uq_visits_slot",
        "visits",
        ["project_id", "trade", "slot"],
        unique=True,
        postgresql_where=sa.text(where),
    )
    op.create_index(
        "uq_visits_vendor",
        "visits",
        ["project_id", "trade", "vendor_id"],
        unique=True,
        postgresql_where=sa.text(where),
    )


def upgrade() -> None:
    # ---- shortlists: 담기 3칸 ----
    op.create_table(
        "shortlists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("trade", sa.String(length=10), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.String(length=8), server_default="active", nullable=False),
        sa.Column("removed_code", sa.String(length=12), nullable=True),
        _now(),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("trade in ('dobae', 'mokgong')", name="trade"),
        sa.CheckConstraint("slot between 1 and 3", name="slot"),
        sa.CheckConstraint("status in ('active', 'removed')", name="status"),
        sa.CheckConstraint(
            "removed_code is null or removed_code in"
            " ('customer', 'expired', 'declined', 'cancelled', 'no_show', 'closed')",
            name="removed_code",
        ),
        sa.CheckConstraint("(status = 'active') = (removed_code is null)", name="removed"),
        sa.CheckConstraint("(status = 'removed') = (removed_at is not null)", name="removed_at"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shortlists_project_id", "shortlists", ["project_id"])
    op.create_index("ix_shortlists_vendor_id", "shortlists", ["vendor_id"])
    for name, col in (("vendor", "vendor_id"), ("slot", "slot")):
        op.create_index(
            f"uq_shortlists_{name}",
            "shortlists",
            ["project_id", "trade", col],
            unique=True,
            postgresql_where=sa.text("status = 'active'"),
        )

    # ---- visits ----
    op.drop_index("uq_visits_slot", table_name="visits")
    op.drop_index("uq_visits_vendor", table_name="visits")
    op.drop_constraint(op.f("ck_visits_status"), "visits", type_="check")
    op.create_check_constraint(op.f("ck_visits_status"), "visits", f"status in {STATUS}")
    _live_indexes(LIVE)
    op.add_column("visits", sa.Column("shortlist_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_visits_shortlist_id_shortlists",
        "visits",
        "shortlists",
        ["shortlist_id"],
        ["id"],
        ondelete="SET NULL",
    )
    for name, type_, default in VISIT_COLUMNS:
        op.add_column(
            "visits",
            sa.Column(name, type_, server_default=default, nullable=default is None),
        )
    for name, cond in VISIT_CHECKS.items():
        op.create_check_constraint(op.f(f"ck_visits_{name}"), "visits", cond)
    # 옛 요청은 (공사, 공종, 업체)마다 만든 순서로 시도 번호를 채운다
    op.execute(
        """
        update visits v set attempt = r.n
        from (
            select id, row_number() over (
                partition by project_id, trade, vendor_id order by created_at, id
            ) as n
            from visits
        ) r
        where r.id = v.id
        """
    )
    op.create_unique_constraint(
        "uq_visits_attempt", "visits", ["project_id", "trade", "vendor_id", "attempt"]
    )
    # 지금 살아 있는 요청마다 담기 한 칸 (slot = 요청 slot)
    op.execute(
        f"""
        insert into shortlists (id, project_id, trade, vendor_id, slot, status, created_at)
        select gen_random_uuid(), project_id, trade, vendor_id, slot, 'active', created_at
        from visits where {OLD_LIVE} and vendor_id is not null
        """
    )
    op.execute(
        f"""
        update visits v set shortlist_id = s.id
        from shortlists s
        where s.project_id = v.project_id and s.trade = v.trade and s.vendor_id = v.vendor_id
          and s.status = 'active' and v.{OLD_LIVE}
        """
    )

    # ---- visit_events ----
    for col in ("from_status", "to_status"):
        op.drop_constraint(op.f(f"ck_visit_events_{col}"), "visit_events", type_="check")
    op.create_check_constraint(
        op.f("ck_visit_events_from_status"),
        "visit_events",
        f"from_status is null or from_status in {STATUS}",
    )
    op.create_check_constraint(
        op.f("ck_visit_events_to_status"), "visit_events", f"to_status in {STATUS}"
    )
    op.add_column("visit_events", sa.Column("day", sa.Date(), nullable=True))
    op.add_column("visit_events", sa.Column("half", sa.String(length=2), nullable=True))
    op.add_column("visit_events", sa.Column("day_to", sa.Date(), nullable=True))
    op.create_check_constraint(
        op.f("ck_visit_events_half"), "visit_events", f"half is null or half in {HALF}"
    )
    op.create_check_constraint(
        op.f("ck_visit_events_day_to"),
        "visit_events",
        "day_to is null or (day is not null and day_to >= day)",
    )

    # ---- visit_windows: 업체가 되는 기간 ----
    op.create_table(
        "visit_windows",
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("excluded", postgresql.ARRAY(sa.Date()), server_default="{}", nullable=False),
        sa.Column("instant", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "answered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("pick_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("end_date >= start_date and end_date - start_date <= 62", name="dates"),
        sa.CheckConstraint("cardinality(excluded) <= 31", name="excluded"),
        sa.CheckConstraint("pick_due_at > answered_at", name="pick_due"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("visit_id"),
    )

    # ---- visit_holds: 반나절 잡기 · 확정 (같은 업체 · 날 · 반나절 · 칸 번호에 살아 있는 것 하나) ----
    op.create_table(
        "visit_holds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("half", sa.String(length=2), nullable=False),
        sa.Column("seat", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column("kind", sa.String(length=6), nullable=False),
        sa.Column("status", sa.String(length=8), server_default="active", nullable=False),
        sa.Column("until", sa.DateTime(timezone=True), nullable=True),
        _now(),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(f"half in {HALF}", name="half"),
        sa.CheckConstraint("seat between 1 and 3", name="seat"),
        sa.CheckConstraint("kind in ('hold', 'booked')", name="kind"),
        sa.CheckConstraint("status in ('active', 'released')", name="status"),
        sa.CheckConstraint("(kind = 'hold') = (until is not null)", name="until"),
        sa.CheckConstraint("(status = 'released') = (released_at is not null)", name="released_at"),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visit_holds_visit_id", "visit_holds", ["visit_id"])
    op.create_index(
        "uq_visit_holds_seat",
        "visit_holds",
        ["vendor_id", "day", "half", "seat"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "uq_visit_holds_visit",
        "visit_holds",
        ["visit_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    # ---- visit_changes: 확정 뒤 일정 바꾸기 요청 ----
    op.create_table(
        "visit_changes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("from_day", sa.Date(), nullable=False),
        sa.Column("from_half", sa.String(length=2), nullable=False),
        sa.Column("to_day", sa.Date(), nullable=False),
        sa.Column("to_half", sa.String(length=2), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("by_id", sa.Uuid(), nullable=True),
        _now(),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(f"from_half in {HALF} and to_half in {HALF}", name="halves"),
        sa.CheckConstraint("(from_day, from_half) <> (to_day, to_half)", name="moved"),
        sa.CheckConstraint(
            "status in ('open', 'accepted', 'countered', 'withdrawn', 'expired')", name="status"
        ),
        sa.CheckConstraint(
            "(status in ('open', 'countered')) = (closed_at is null)", name="closed"
        ),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visit_changes_visit_id", "visit_changes", ["visit_id"])
    op.create_index(
        "uq_visit_changes_open",
        "visit_changes",
        ["visit_id"],
        unique=True,
        postgresql_where=sa.text("status in ('open', 'countered')"),
    )

    # ---- visit_proposals · visit_proposal_slots: 다른 날 제안 ----
    op.create_table(
        "visit_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("change_id", sa.Uuid(), nullable=True),
        sa.Column("reason_code", sa.String(length=12), nullable=True),
        sa.Column("note", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        _now(),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "reason_code is null or reason_code in ('other_site', 'no_crew', 'other')",
            name="reason_code",
        ),
        sa.CheckConstraint("change_id is not null or reason_code is not null", name="reason"),
        sa.CheckConstraint("note is null or length(btrim(note)) > 0", name="note"),
        sa.CheckConstraint("status in ('open', 'picked', 'repicked', 'expired')", name="status"),
        sa.CheckConstraint("(status = 'open') = (closed_at is null)", name="closed"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["change_id"], ["visit_changes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visit_proposals_visit_id", "visit_proposals", ["visit_id"])
    op.create_index(
        "uq_visit_proposals_open",
        "visit_proposals",
        ["visit_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
    )
    op.create_table(
        "visit_proposal_slots",
        sa.Column("proposal_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("half", sa.String(length=2), nullable=False),
        sa.CheckConstraint(f"half in {HALF}", name="half"),
        sa.ForeignKeyConstraint(["proposal_id"], ["visit_proposals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("proposal_id", "day", "half"),
    )


def downgrade() -> None:
    op.drop_table("visit_proposal_slots")
    op.drop_index("uq_visit_proposals_open", table_name="visit_proposals")
    op.drop_index("ix_visit_proposals_visit_id", table_name="visit_proposals")
    op.drop_table("visit_proposals")
    op.drop_index("uq_visit_changes_open", table_name="visit_changes")
    op.drop_index("ix_visit_changes_visit_id", table_name="visit_changes")
    op.drop_table("visit_changes")
    for name in ("uq_visit_holds_visit", "uq_visit_holds_seat", "ix_visit_holds_visit_id"):
        op.drop_index(name, table_name="visit_holds")
    op.drop_table("visit_holds")
    op.drop_table("visit_windows")

    # visit_events: 새 칸을 지우고 상태를 옛 목록으로
    for name in ("day_to", "half", "from_status", "to_status"):
        op.drop_constraint(op.f(f"ck_visit_events_{name}"), "visit_events", type_="check")
    for col in ("day_to", "half", "day"):
        op.drop_column("visit_events", col)
    op.execute(
        "update visit_events set from_status = "
        + DOWN_MAP.format(c="from_status")
        + ", to_status = "
        + DOWN_MAP.format(c="to_status")
    )
    op.create_check_constraint(
        op.f("ck_visit_events_from_status"),
        "visit_events",
        f"from_status is null or from_status in {OLD_STATUS}",
    )
    op.create_check_constraint(
        op.f("ck_visit_events_to_status"), "visit_events", f"to_status in {OLD_STATUS}"
    )

    # visits: 새 칸 · 제약을 지우고 상태를 옛 목록으로
    op.drop_constraint("uq_visits_attempt", "visits", type_="unique")
    for name in VISIT_CHECKS:
        op.drop_constraint(op.f(f"ck_visits_{name}"), "visits", type_="check")
    op.drop_index("uq_visits_slot", table_name="visits")
    op.drop_index("uq_visits_vendor", table_name="visits")
    op.drop_constraint(op.f("ck_visits_status"), "visits", type_="check")
    op.execute("update visits set status = " + DOWN_MAP.format(c="status"))
    op.create_check_constraint(op.f("ck_visits_status"), "visits", f"status in {OLD_STATUS}")
    _live_indexes(OLD_LIVE)
    for name, _type, _default in reversed(VISIT_COLUMNS):
        op.drop_column("visits", name)
    op.drop_constraint("fk_visits_shortlist_id_shortlists", "visits", type_="foreignkey")
    op.drop_column("visits", "shortlist_id")

    for name in (
        "uq_shortlists_slot",
        "uq_shortlists_vendor",
        "ix_shortlists_vendor_id",
        "ix_shortlists_project_id",
    ):
        op.drop_index(name, table_name="shortlists")
    op.drop_table("shortlists")
