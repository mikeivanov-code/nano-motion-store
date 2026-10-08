import asyncio
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend import app as module


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "DB", str(tmp_path / "test.sqlite"))
    monkeypatch.setattr(module, "KEY", "")
    with TestClient(module.app) as client:
        yield client


def body(name="items_added"):
    return {
        "event_id": str(uuid4()),
        "name": name,
        "timestamp_ms": int(time.time() * 1000),
        "source_url": "http://localhost:8000/checkout/",
        "consent": True,
        "items": [{"sku": "NM-R01", "size": "M", "quantity": 2}],
    }


def test_minor_units_and_payload():
    raw = body()
    raw["oppref"] = "opaque-UNCHANGED"
    raw["obref"] = "browser-UNCHANGED"
    event = module.Event(**raw)
    result = module.transform(event)
    assert result["id"] == raw["event_id"]
    assert result["data"]["amount"] == 29600
    assert result["data"]["contents"][0]["amount"] == 14800
    assert result["data"]["contents"][0]["quantity"] == 2
    assert result["data"]["currency"] == "USD"
    assert result["oppref"] == "opaque-UNCHANGED"
    assert result["user"] == {"obref": "browser-UNCHANGED"}
    assert result["action_source"] == "web"
    assert result["timestamp_ms"] == raw["timestamp_ms"]


@pytest.mark.parametrize(
    "patch",
    [
        {"name": "custom"},
        {"name": "order_created"},
        {"event_id": "bad"},
        {"consent": False},
        {"timestamp_ms": 1},
        {"source_url": "https://evil.test/a"},
        {"source_url": "http://localhost:8000/?email=private"},
        {"amount": 1},
        {"outbound_url": "https://evil.test"},
        {"obref": " "},
    ],
)
def test_schema_rejection(client, patch):
    assert client.post("/api/events", json=body() | patch).status_code == 422


@pytest.mark.parametrize("quantity", [0, -1, 21, 1.5, "2", True])
def test_quantity_strict_integer(quantity):
    raw = body()
    raw["items"][0]["quantity"] = quantity
    with pytest.raises(ValidationError):
        module.Event(**raw)


def test_unknown_sku_size_and_duplicate_line(client):
    for item in [
        {"sku": "unknown", "size": "M", "quantity": 1},
        {"sku": "NM-R01", "size": "XXL", "quantity": 1},
    ]:
        assert client.post("/api/events", json=body() | {"items": [item]}).status_code == 422
    raw = body()
    raw["items"] *= 2
    assert client.post("/api/events", json=raw).status_code == 422


def test_idempotent_checkout_and_conflict(client):
    raw = body("order_created")
    first = client.post("/api/checkout", json=raw)
    second = client.post("/api/checkout", json=raw)
    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["event_id"] == raw["event_id"]
    assert first.json()["server_status"] == "demo_not_delivered"
    raw["items"][0]["quantity"] = 3
    assert client.post("/api/checkout", json=raw).status_code == 409
    with module.connect() as db:
        assert db.execute("SELECT count(*) FROM records").fetchone()[0] == 1


def test_consent_blocked_order(client):
    raw = body("order_created") | {"consent": False, "obref": "not-forwarded"}
    result = client.post("/api/checkout", json=raw).json()
    assert result["server_status"] == "blocked_consent"
    with module.connect() as db:
        assert db.execute("SELECT payload FROM records").fetchone()[0] == "{}"


def test_lead_shape(client):
    raw = body("lead_created") | {"items": []}
    assert client.post("/api/events", json=raw).json()["data"] == {"type": "customer_action"}
    assert client.post("/api/events", json=body("lead_created")).status_code == 422


def test_cors_and_size_limit(client):
    response = client.options(
        "/api/events",
        headers={"Origin": "http://localhost:8000", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:8000"
    response = client.options(
        "/api/events",
        headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers
    assert (
        client.post("/api/events", json=body(), headers={"Origin": "https://evil.test"}).status_code
        == 403
    )
    assert client.post("/api/events", content="x" * 17000).status_code == 413
    assert client.get("/health").json()["status"] == "ok"


@pytest.mark.parametrize(
    "code,status",
    [
        (200, "validated"),
        (202, "validated"),
        (400, "rejected"),
        (401, "rejected"),
        (429, "pending"),
        (500, "pending"),
    ],
)
def test_delivery_status(client, monkeypatch, code, status):
    monkeypatch.setattr(module, "KEY", "test-key-only")
    raw = body()
    module.record(module.Event(**raw))
    requests = []

    def mock(request):
        requests.append(request)
        return httpx.Response(code)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(mock)) as mocked:
            await module.deliver(raw["event_id"], mocked)

    asyncio.run(run())
    with module.connect() as db:
        assert db.execute("SELECT status FROM records").fetchone()[0] == status
    sent = json.loads(requests[0].content)
    assert sent["validate_only"] is True
    assert sent["events"][0]["id"] == raw["event_id"]
    assert requests[0].url.host == "bzr.openai.com"


def test_timeout_retry_preserves_id(client, monkeypatch):
    monkeypatch.setattr(module, "KEY", "test-key-only")
    raw = body()
    module.record(module.Event(**raw))
    ids = []

    def mock(request):
        ids.append(json.loads(request.content)["events"][0]["id"])
        if len(ids) == 1:
            raise httpx.ReadTimeout("mock timeout")
        return httpx.Response(200)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(mock)) as mocked:
            await module.deliver(raw["event_id"], mocked)
            with module.connect() as db:
                assert db.execute("SELECT status FROM records").fetchone()[0] == "pending"
            await module.deliver(raw["event_id"], mocked)

    asyncio.run(run())
    assert ids == [raw["event_id"], raw["event_id"]]


def test_live_status_and_expiry(client, monkeypatch):
    monkeypatch.setattr(module, "KEY", "test-key-only")
    monkeypatch.setattr(module, "VALIDATE_ONLY", False)
    raw = body()
    module.record(module.Event(**raw))

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200))
        ) as mocked:
            await module.deliver(raw["event_id"], mocked)

    asyncio.run(run())
    with module.connect() as db:
        assert db.execute("SELECT status FROM records").fetchone()[0] == "accepted"


def test_revocation_pending_checkout(client, monkeypatch):
    monkeypatch.setattr(module, "KEY", "test-key-only")
    raw = body("order_created")
    assert client.post("/api/checkout", json=raw).json()["server_status"] == "pending"
    raw["consent"] = False
    response = client.post("/api/checkout", json=raw)
    assert response.json()["server_status"] == "blocked_consent"
    assert client.get("/api/events/" + raw["event_id"]).json()["server_status"] == "blocked_consent"
    with module.connect() as db:
        assert db.execute("SELECT payload FROM records").fetchone()[0] == "{}"


def test_validation_error_redaction(client):
    response = client.post("/api/events", json=body() | {"private_input": "do-not-reflect"})
    assert response.status_code == 422
    assert "do-not-reflect" not in response.text


def test_expired_outbox_never_sent(client, monkeypatch):
    monkeypatch.setattr(module, "KEY", "test-key-only")
    raw = body()
    module.record(module.Event(**raw))
    with module.connect() as db:
        payload = json.loads(db.execute("SELECT payload FROM records").fetchone()[0])
        payload["timestamp_ms"] = 1
        db.execute("UPDATE records SET payload=?", (json.dumps(payload),))

    def mock(request):
        pytest.fail("Expired event must never reach the transport")

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(mock)) as mocked:
            await module.deliver(raw["event_id"], mocked)

    asyncio.run(run())
    with module.connect() as db:
        assert db.execute("SELECT status FROM records").fetchone()[0] == "expired_not_delivered"
