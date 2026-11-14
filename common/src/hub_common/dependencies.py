"""FastAPI dependencies shared by the services."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Connection


def get_connection(request: Request) -> Iterator[Connection]:
    """One connection and transaction per request: commit on success, rollback on error.

    Uses `app.state.engine`, which each service sets in create_app. Endpoints use it
    through DatabaseConnection.
    """
    with request.app.state.engine.begin() as connection:
        yield connection


DatabaseConnection = Annotated[Connection, Depends(get_connection)]
"""Endpoint parameter type for a per-request transactional connection.

Example:
    @router.get("/x")
    def read_x(connection: DatabaseConnection) -> ...:
        connection.execute(text("SELECT 1"))
"""
