# Build context is the app/ folder (see docker-compose.yml): the service needs the uv
# workspace and the shared `common` package.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/venv PATH=/venv/bin:$PATH

WORKDIR /workspace
COPY pyproject.toml uv.lock .python-version ./
COPY common/ common/
COPY onboard/pyproject.toml onboard/pyproject.toml
COPY earth/ earth/
RUN uv sync --frozen --no-dev --package earth

WORKDIR /workspace/earth
EXPOSE 8000
# Apply every migration branch, then serve. Re-running is safe: Alembic skips applied revisions.
CMD ["sh", "-c", "alembic upgrade heads && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
