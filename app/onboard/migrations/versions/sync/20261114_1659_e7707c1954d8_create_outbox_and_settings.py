"""create outbox and settings

Owner: Guilherme (branch `sync`). Spec: Outbox to Earth (onboard → Earth sync).

- `outbox`: events waiting to reach Earth. Producers insert them with
  app.sync.events.enqueue_event in the same transaction as the source data;
  the worker sends PENDING rows (lowest priority first) and marks them SYNCED
  only after Earth's ACK.
- `settings`: small key/value store; `earth_link_enabled` is the simulated
  Earth link, kept here so it survives restarts.

Revision ID: e7707c1954d8
Revises: 0fa01e834ce1
Create Date: 2026-11-14 16:59:17.999229

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "e7707c1954d8"
down_revision: str | Sequence[str] | None = "0fa01e834ce1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the outbox and settings tables and turn the Earth link on."""
    op.create_table(
        "outbox",
        sa.Column("event_id", sa.Text(), primary_key=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("priority", sa.SmallInteger(), nullable=False),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("created_at_onboard_ms", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("synced_at_ms", sa.BigInteger(), nullable=True),
        sa.CheckConstraint("status IN ('PENDING', 'SYNCED')", name="ck_outbox_status"),
        sa.CheckConstraint("type IN ('OBSERVATIONS', 'ALERT')", name="ck_outbox_type"),
    )
    # Serves the worker's query: PENDING, due now, lowest priority, oldest first.
    op.create_index(
        "ix_outbox_due",
        "outbox",
        ["status", "priority", "next_attempt_at_ms", "created_at_onboard_ms"],
    )

    op.create_table(
        "settings",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("value", JSONB(), nullable=False),
        sa.Column("updated_at_ms", sa.BigInteger(), nullable=False),
    )
    # Plain SQL instead of bulk_insert: a JSONB literal cannot be rendered in --sql mode.
    op.execute(
        "INSERT INTO settings (key, value, updated_at_ms)"
        " VALUES ('earth_link_enabled', 'true'::jsonb, 0)"
    )


def downgrade() -> None:
    """Drop the outbox and settings tables."""
    op.drop_table("settings")
    op.drop_index("ix_outbox_due", table_name="outbox")
    op.drop_table("outbox")
