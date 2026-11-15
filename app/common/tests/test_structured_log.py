import json
import logging

import pytest
from hub_common.structured_log import configure_service_logging, log_json


def test_log_json_writes_one_json_line(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("probe.json")
    with caplog.at_level(logging.INFO, logger="probe.json"):
        log_json(logger, logging.INFO, "batch_synced", batch_id="b-1", events=3)
    assert json.loads(caplog.records[0].getMessage()) == {
        "batch_id": "b-1",
        "event": "batch_synced",
        "events": 3,
    }


def test_service_logging_enables_info_once() -> None:
    configure_service_logging("probe-service")
    configure_service_logging("probe-service")
    service_logger = logging.getLogger("probe-service")
    assert service_logger.level == logging.INFO
    assert len(service_logger.handlers) == 1
