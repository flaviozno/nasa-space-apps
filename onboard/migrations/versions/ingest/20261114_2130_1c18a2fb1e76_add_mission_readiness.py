"""add mission context snapshots and operational recommendations

Revision ID: 1c18a2fb1e76
Revises: 8ac931df1542
Create Date: 2026-11-14 21:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "1c18a2fb1e76"
down_revision: str | Sequence[str] | None = "8ac931df1542"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mission_context_snapshots",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("observed_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("provenance_url", sa.Text(), nullable=False),
        sa.Column("is_historical", sa.Boolean(), nullable=False),
        sa.Column("quality", sa.Text(), nullable=False),
        sa.UniqueConstraint("source", "source_ref", name="uq_mission_context_source_ref"),
    )
    op.create_index("ix_mission_context_kind_observed", "mission_context_snapshots", ["kind", "observed_at_ms"])
    op.create_table(
        "operational_recommendations",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("rule_id", sa.Text(), nullable=False),
        sa.Column("rule_version", sa.Text(), nullable=False),
        sa.Column("fatigue_observation_id", sa.Text(), nullable=False),
        sa.Column("evidence", JSONB(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("disclaimer", sa.Text(), nullable=False),
        sa.Column("created_at_ms", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["fatigue_observation_id"], ["observations.id"]),
        sa.UniqueConstraint(
            "crew_id", "rule_id", "rule_version", "fatigue_observation_id",
            name="uq_operational_recommendation_evidence",
        ),
    )
    op.create_index("ix_operational_recommendations_crew_created", "operational_recommendations", ["crew_id", "created_at_ms"])


def downgrade() -> None:
    op.drop_index("ix_operational_recommendations_crew_created", table_name="operational_recommendations")
    op.drop_table("operational_recommendations")
    op.drop_index("ix_mission_context_kind_observed", table_name="mission_context_snapshots")
    op.drop_table("mission_context_snapshots")
