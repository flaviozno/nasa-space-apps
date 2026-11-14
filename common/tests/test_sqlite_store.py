from pathlib import Path

import pytest
from hub_common import apply_schema, open_database, prepare_database


def write_schema(schema_dir: Path, files: dict[str, str]) -> None:
    schema_dir.mkdir()
    for name, sql in files.items():
        (schema_dir / name).write_text(sql, encoding="utf-8")


def test_open_database_enables_wal_and_full_sync(tmp_path: Path) -> None:
    connection = open_database(tmp_path / "nested" / "test.db")
    assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert connection.execute("PRAGMA synchronous").fetchone()[0] == 2  # 2 = FULL


def test_apply_schema_runs_files_in_name_order(tmp_path: Path) -> None:
    write_schema(
        tmp_path / "schema",
        {
            "002_child.sql": "CREATE TABLE IF NOT EXISTS child (parent_id REFERENCES parent(id));",
            "001_parent.sql": "CREATE TABLE IF NOT EXISTS parent (id INTEGER PRIMARY KEY);",
        },
    )
    connection = open_database(tmp_path / "test.db")
    assert apply_schema(connection, tmp_path / "schema") == ["001_parent.sql", "002_child.sql"]


def test_apply_schema_is_idempotent(tmp_path: Path) -> None:
    write_schema(tmp_path / "schema", {"001_t.sql": "CREATE TABLE IF NOT EXISTS t (id INTEGER);"})
    connection = open_database(tmp_path / "test.db")
    apply_schema(connection, tmp_path / "schema")
    apply_schema(connection, tmp_path / "schema")
    tables = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    assert [row["name"] for row in tables] == ["t"]


def test_prepare_database_creates_file_and_tables(tmp_path: Path) -> None:
    write_schema(tmp_path / "schema", {"001_t.sql": "CREATE TABLE IF NOT EXISTS t (id INTEGER);"})
    database_path = tmp_path / "data" / "service.db"
    assert prepare_database(database_path, tmp_path / "schema") == ["001_t.sql"]
    connection = open_database(database_path)
    assert connection.execute("SELECT count(*) FROM t").fetchone()[0] == 0


def test_apply_schema_rejects_missing_directory(tmp_path: Path) -> None:
    connection = open_database(tmp_path / "test.db")
    with pytest.raises(FileNotFoundError, match="missing"):
        apply_schema(connection, tmp_path / "missing")
