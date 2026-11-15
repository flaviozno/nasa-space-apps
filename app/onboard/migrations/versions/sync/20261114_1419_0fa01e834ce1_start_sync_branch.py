"""start sync branch

Revision ID: 0fa01e834ce1
Revises:
Create Date: 2026-11-14 14:19:00.674770

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0fa01e834ce1"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = ("sync",)
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
