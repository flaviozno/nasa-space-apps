from fastapi import FastAPI
from fastapi.testclient import TestClient
from hub_common import build_health_router


def test_health_reports_service_name() -> None:
    app = FastAPI()
    app.include_router(build_health_router("probe"))
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "probe", "status": "ok"}
