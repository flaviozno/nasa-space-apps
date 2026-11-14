"""Wearable ingest — owner: Miguel.

Scheduler that sends SyncRequest to the emulator every minute, stores the
TelemetryBatch with a durable cursor, converts samples to observations, runs the
alert rules, writes Outbox events, and answers with ReceiptAck.
"""
