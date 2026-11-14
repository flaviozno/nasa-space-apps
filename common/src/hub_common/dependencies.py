"""FastAPI dependencies shared by the services."""

import sqlite3
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request

from hub_common.sqlite_store import open_database


def get_connection(request: Request) -> Iterator[sqlite3.Connection]:
    """One SQLite connection per request, closed afterwards.

    Reads `app.state.settings.database_path`, which each service sets in create_app.
    A connection per request avoids sharing one SQLite connection across the
    threadpool that runs sync endpoints. Endpoints use it through DatabaseConnection.
    """
    connection = open_database(request.app.state.settings.database_path)
    try:
        yield connection
    finally:
        connection.close()


DatabaseConnection = Annotated[sqlite3.Connection, Depends(get_connection)]
"""Endpoint parameter type for a per-request connection.

Example:
    @router.get("/x")
    def read_x(connection: DatabaseConnection) -> ...
"""
