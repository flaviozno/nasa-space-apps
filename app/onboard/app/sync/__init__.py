"""Earth synchronization — owner: Guilherme.

- events.py: `build_event` / `enqueue_event`, the only way producers add events to the Outbox
- worker.py: sends PENDING events to Earth when the simulated link is up
- store.py: Outbox and link state in PostgreSQL
- earth_client.py: HTTP delivery to Earth
- router.py: `GET /v1/sync/status`, `PUT /v1/sync/link`

See readme.md, sections 5 and 6.
"""
