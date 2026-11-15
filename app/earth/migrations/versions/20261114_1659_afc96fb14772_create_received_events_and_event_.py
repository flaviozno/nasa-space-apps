"""create received_events and event_conflicts

Owner: Guilherme. Spec: Outbox to Earth (onboard → Earth sync).

- `received_events`: every event Earth accepted, once. `event_id` is the
  deduplication key; `content_sha256` detects the same ID arriving with
  different content.
- `event_conflicts`: same ID, different content. Recorded, never overwritten.

Revision ID: afc96fb14772
Revises:
Create Date: 2026-11-14 16:59:23.084215

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "afc96fb14772"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the Earth ingest tables."""
    op.create_table(
        "received_events",
        sa.Column("event_id", sa.Text(), primary_key=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("priority", sa.SmallInteger(), nullable=False),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("content_sha256", sa.Text(), nullable=False),
        sa.Column("created_at_onboard_ms", sa.BigInteger(), nullable=False),
        sa.Column("received_at_earth_ms", sa.BigInteger(), nullable=False),
        sa.Column("batch_id", sa.Text(), nullable=False),
    )
    # Earth views order by onboard time, never by arrival order.
    op.create_index(
        "ix_received_events_crew_created",
        "received_events",
        ["crew_id", "created_at_onboard_ms"],
    )

    op.create_table(
        "event_conflicts",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("batch_id", sa.Text(), nullable=False),
        sa.Column("content_sha256", sa.Text(), nullable=False),
        sa.Column("detected_at_ms", sa.BigInteger(), nullable=False),
    )


def downgrade() -> None:
    """Drop the Earth ingest tables."""
    op.drop_table("event_conflicts")
    op.drop_index("ix_received_events_crew_created", table_name="received_events")
    op.drop_table("received_events")
