"""create observations and questionnaire_responses

Owner: Matheus (branch `observations`). See onboard/migrations/README.md.

- `observations`: every normalized reading (wearable, manual, questionnaire,
  or a future source). Idempotent by (source, source_ref, metric): repeating
  the same identity must not create a second row. `value` is nullable because
  an invalid reading is stored as NULL, never as 0 (readme.md, section 7).
- `questionnaire_responses`: the envelope of one submitted form. The answers
  themselves become observations with source_ref = the response id, so this
  table only keeps who answered what, when, plus the raw payload for audit.

Revision ID: 089bc82e7798
Revises: 7ebd4ba62e1a
Create Date: 2026-11-14 15:01:52.210890

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "089bc82e7798"
down_revision: str | Sequence[str] | None = "7ebd4ba62e1a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the observations module tables."""
    op.create_table(
        "observations",
        sa.Column("id", sa.Text(), nullable=False, primary_key=True),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=True),
        sa.Column("taken_at", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_observations"),
        sa.UniqueConstraint("source", "source_ref", "metric", name="uq_observations_source_ref_metric"),
    )
    op.create_index(
        "ix_observations_crew_metric_taken",
        "observations",
        ["crew_id", "metric", "taken_at"],
    )

    op.create_table(
        "questionnaire_responses",
        sa.Column("id", sa.Text(), nullable=False, primary_key=True),
        sa.Column("crew_id", sa.Text(), nullable=False),
        sa.Column("questionnaire", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.BigInteger(), nullable=False),
        sa.Column("answers_json", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_questionnaire_responses"),
        sa.CheckConstraint(
            "questionnaire IN ('daily_checkin', 'phq4', 'team_climate')",
            name="ck_questionnaire_responses_type",
        ),
    )
    op.create_index(
        "ix_questionnaire_responses_crew_submitted",
        "questionnaire_responses",
        ["crew_id", "submitted_at"],
    )


def downgrade() -> None:
    """Drop the observations module tables."""
    op.drop_index("ix_questionnaire_responses_crew_submitted", table_name="questionnaire_responses")
    op.drop_table("questionnaire_responses")
    op.drop_index("ix_observations_crew_metric_taken", table_name="observations")
    op.drop_table("observations")
