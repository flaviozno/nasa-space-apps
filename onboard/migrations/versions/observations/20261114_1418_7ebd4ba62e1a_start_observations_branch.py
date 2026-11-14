"""start observations branch

Revision ID: 7ebd4ba62e1a
Revises:
Create Date: 2026-11-14 14:18:59.771138

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "7ebd4ba62e1a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = ("observations",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
