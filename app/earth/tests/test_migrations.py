"""Structure checks for the Earth Alembic migrations (no database needed)."""

import io
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_migrations_form_a_single_linear_branch() -> None:
    scripts = ScriptDirectory.from_config(Config(str(ALEMBIC_INI)))
    assert len(scripts.get_heads()) <= 1


def test_upgrade_heads_renders_sql_offline() -> None:
    output = io.StringIO()
    command.upgrade(Config(str(ALEMBIC_INI), output_buffer=output), "heads", sql=True)
    assert output.getvalue().strip().endswith("COMMIT;")
