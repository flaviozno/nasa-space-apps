from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from hub_common import require_bearer_token


def build_app(secret: str) -> TestClient:
    app = FastAPI()
    app.state.settings = SimpleNamespace(admin_token=secret)

    @app.post("/guarded", dependencies=[require_bearer_token("admin_token")])
    def guarded() -> str:
        return "in"

    return TestClient(app)


def test_correct_token_passes() -> None:
    response = build_app("s3cret").post("/guarded", headers={"Authorization": "Bearer s3cret"})
    assert response.json() == "in"


def test_wrong_or_missing_token_is_401() -> None:
    client = build_app("s3cret")
    assert client.post("/guarded", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.post("/guarded").status_code == 401
    assert client.post("/guarded", headers={"Authorization": "Basic s3cret"}).status_code == 401


def test_unconfigured_secret_refuses_everyone() -> None:
    response = build_app("").post("/guarded", headers={"Authorization": "Bearer "})
    assert response.status_code == 503
    assert "admin_token" in response.json()["detail"]
