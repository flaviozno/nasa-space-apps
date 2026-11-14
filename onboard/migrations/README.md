# Onboard migrations (Alembic)

The onboard PostgreSQL schema is managed only through these migrations. Run commands from the `onboard/` folder.

## One branch per owner

Each owner has an independent Alembic branch in its own folder. Branches don't share a chain, so three people can add migrations at the same time without creating conflicting heads.

| Branch label | Folder | Owner | Tables |
| --- | --- | --- | --- |
| `observations` | `versions/observations/` | Matheus | `observations`, `questionnaire_responses` |
| `ingest` | `versions/ingest/` | Miguel | `simulation_sessions`, `samples`, `alerts` |
| `sync` | `versions/sync/` | Guilherme | `outbox`, `settings` (simulated Earth link) |

Each branch starts with an empty "start … branch" revision. Don't edit or delete it.

## Commands

```bash
# Create a migration on your branch (replace ingest with your label)
uv run alembic revision -m "create samples table" --head=ingest@head

# Apply every branch (Docker runs this on container start)
uv run alembic upgrade heads

# See the current state
uv run alembic heads
uv run alembic history
uv run alembic current

# Print the SQL without a database
uv run alembic upgrade heads --sql
```

Always use `upgrade heads` (plural): `upgrade head` fails because there are three heads.

## Rules

- Write the `upgrade()` and `downgrade()` with `op.create_table`, `op.add_column`, etc. There are no SQLAlchemy models to autogenerate from.
- Once a migration is merged into `main`, don't edit it; add a new one.
- Need a table from another branch (e.g. `alerts` referencing `observations`)? Declare it in your migration so it runs after the other one:

  ```python
  depends_on = "observations@head"  # or the specific revision id
  ```

- Locally, start only the database with `docker compose up -d onboard-db` (published on `localhost:5433`), then run `uv run alembic upgrade heads`.
- To start over: `docker compose down -v` deletes both databases.
