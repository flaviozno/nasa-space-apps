"""create durable wearable ingestion tables

Revision ID: 8ac931df1542
Revises: 529c6b2aa3e2
Create Date: 2026-11-14 20:25:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "8ac931df1542"
down_revision: str | Sequence[str] | None = "529c6b2aa3e2"
branch_labels: str | Sequence[str] | None = None
# Alembic resolves dependencies by revision ID.  ``branch@head`` is valid on
# CLI targets, but not in a migration module's ``depends_on`` metadata.
depends_on: str | Sequence[str] | None = ("089bc82e7798", "e7707c1954d8")


def upgrade() -> None:
    op.create_table(
        "ingest_sessions",
        sa.Column("session_id", sa.Text(), primary_key=True),
        sa.Column("scenario", sa.Text(), nullable=False),
        sa.Column("next_until_acquired_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("last_success_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("updated_at_ms", sa.BigInteger(), nullable=False),
    )
    op.create_table(
        "ingest_cursors",
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("device_id", sa.Text(), nullable=False),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("boot_id", sa.Text(), nullable=False),
        sa.Column("next_sequence", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("session_id", "device_id", name="pk_ingest_cursors"),
        sa.ForeignKeyConstraint(["session_id"], ["ingest_sessions.session_id"]),
    )
    op.create_table(
        "ingest_receipts",
        sa.Column("transfer_id", sa.Text(), primary_key=True),
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("accepted_sample_ids", JSONB(), nullable=False),
        sa.Column("created_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("acknowledged_at_ms", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["ingest_sessions.session_id"]),
    )
    op.create_table(
        "wearable_samples",
        sa.Column("sample_id", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("device_id", sa.Text(), nullable=False),
        sa.Column("boot_id", sa.Text(), nullable=False),
        sa.Column("sequence_number", sa.BigInteger(), nullable=False),
        sa.Column("acquired_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("received_at_onboard_ms", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("sample_id", name="pk_wearable_samples"),
        sa.UniqueConstraint(
            "device_id", "boot_id", "sequence_number", name="uq_wearable_samples_sequence"
        ),
        sa.ForeignKeyConstraint(["session_id"], ["ingest_sessions.session_id"]),
    )
    op.create_index(
        "ix_wearable_samples_crew_acquired",
        "wearable_samples",
        ["crew_id", "acquired_at_ms"],
    )
    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.Text(), primary_key=True),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("sample_id", sa.Text(), nullable=False),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(), nullable=False),
        sa.Column("z_score", sa.Double(), nullable=False),
        sa.Column("created_at_ms", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["sample_id"], ["wearable_samples.sample_id"]),
        sa.UniqueConstraint("sample_id", "metric", name="uq_alerts_sample_metric"),
    )
    op.create_index("ix_alerts_crew_created", "alerts", ["crew_id", "created_at_ms"])


def downgrade() -> None:
    op.drop_index("ix_alerts_crew_created", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_wearable_samples_crew_acquired", table_name="wearable_samples")
    op.drop_table("wearable_samples")
    op.drop_table("ingest_receipts")
    op.drop_table("ingest_cursors")
    op.drop_table("ingest_sessions")
