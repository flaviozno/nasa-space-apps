"""start ingest branch

Revision ID: 529c6b2aa3e2
Revises:
Create Date: 2026-11-14 14:19:00.228071

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "529c6b2aa3e2"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = ("ingest",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
