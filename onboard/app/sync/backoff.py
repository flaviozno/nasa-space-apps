"""Retry delay after a failed delivery to Earth."""

import random

BASE_DELAY_MS = 5_000
MAX_DELAY_MS = 300_000
MAX_JITTER = 0.2


def retry_delay_ms(attempts: int, rng: random.Random) -> int:
    """Exponential backoff with jitter: min(5 s × 2^attempts, 300 s) × (1 + U[0, 0.2]).

    Jitter keeps retries from hitting Earth all at once after an outage.

    Example: `retry_delay_ms(1, random.Random(0))` → between 10_000 and 12_000.
    """
    if attempts < 0:
        raise ValueError(f"attempts={attempts} must be >= 0")
    base = min(BASE_DELAY_MS * 2 ** min(attempts, 16), MAX_DELAY_MS)
    return int(base * (1 + rng.uniform(0, MAX_JITTER)))
