"""Station environment reads for the web app (owner: Wallace).

`GET /v1/environment/radiation` serves the ISS DosTel radiation readings the
wearable ingest already stores in each `wearable_samples.payload`. They describe
the station's environment, not a crew member's personal dose.
"""
