"""SQLite connection and schema setup shared by the onboard and Earth services."""

import sqlite3
from pathlib import Path


def open_database(database_path: Path) -> sqlite3.Connection:
    """Open a SQLite connection with the durability settings the MVP requires.

    WAL + synchronous=FULL come from readme.md section 7 (durable commit before ACK).

    Example:
        connection = open_database(Path("/data/onboard.db"))
    """
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=FULL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def apply_schema(connection: sqlite3.Connection, schema_dir: Path) -> list[str]:
    """Run every `*.sql` file in `schema_dir`, in name order, and return the file names.

    Files must be idempotent (`CREATE TABLE IF NOT EXISTS ...`): they run on every
    startup, so a teammate can add tables without resetting the database. Changing an
    existing column still needs a reset (`docker compose down -v`).

    Example:
        apply_schema(connection, Path("schema"))  # ["001_observations.sql", ...]
    """
    if not schema_dir.is_dir():
        raise FileNotFoundError(f"schema_dir={schema_dir!s} is not a directory of *.sql files")
    schema_files = sorted(schema_dir.glob("*.sql"))
    for schema_file in schema_files:
        connection.executescript(schema_file.read_text(encoding="utf-8"))
    return [schema_file.name for schema_file in schema_files]


def prepare_database(database_path: Path, schema_dir: Path) -> list[str]:
    """Create the database if needed and apply its schema; used at service startup.

    Example:
        prepare_database(settings.database_path, settings.schema_dir)
    """
    connection = open_database(database_path)
    try:
        return apply_schema(connection, schema_dir)
    finally:
        connection.close()
