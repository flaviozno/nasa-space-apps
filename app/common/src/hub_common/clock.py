"""Injectable clock, so time-dependent code (retries, ages) is testable."""

import time
from typing import Protocol


class Clock(Protocol):
    def now_ms(self) -> int: ...


class SystemClock:
    """Wall-clock time in epoch milliseconds. Example: `SystemClock().now_ms()`."""

    def now_ms(self) -> int:
        return time.time_ns() // 1_000_000
