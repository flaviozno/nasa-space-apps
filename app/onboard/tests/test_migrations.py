"""Structure checks for the onboard Alembic migrations (no database needed)."""

import io
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
OWNER_BRANCHES = {"observations", "ingest", "sync"}


def load_scripts() -> ScriptDirectory:
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI)))


def branch_label_of(scripts: ScriptDirectory, revision_id: str) -> set[str]:
    """Labels of the branch a revision belongs to (inherited from its branch root)."""
    return set(scripts.get_revision(revision_id).branch_labels)


def test_each_owner_branch_has_exactly_one_head() -> None:
    scripts = load_scripts()
    head_labels = [branch_label_of(scripts, head) for head in scripts.get_heads()]
    assert sorted(label for labels in head_labels for label in labels) == sorted(OWNER_BRANCHES)


def test_each_owner_branch_starts_from_base() -> None:
    scripts = load_scripts()
    base_labels = [branch_label_of(scripts, base) for base in scripts.get_bases()]
    assert sorted(label for labels in base_labels for label in labels) == sorted(OWNER_BRANCHES)


def test_upgrade_heads_renders_sql_offline() -> None:
    output = io.StringIO()
    config = Config(str(ALEMBIC_INI), output_buffer=output)
    command.upgrade(config, "heads", sql=True)
    assert "CREATE TABLE alembic_version" in output.getvalue()
    assert output.getvalue().strip().endswith("COMMIT;")
