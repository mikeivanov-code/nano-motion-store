"""Catalog-authoritative mock orders and a durable, consent-gated CAPI outbox."""

import asyncio
import hashlib
import json
import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator
from starlette.responses import JSONResponse

PIXEL_ID = os.getenv("OPENAI_PIXEL_ID", "F7KSWkG5KCzsqcVr7nHP18")
KEY = os.getenv("OPENAI_CONVERSIONS_API_KEY", "")
VALIDATE_ONLY = os.getenv("OPENAI_CAPI_VALIDATE_ONLY", "true").lower() == "true"
ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",")
ORIGINS = [origin.strip() for origin in ORIGINS if origin.strip()]
DB = os.getenv("DATABASE_PATH", "nano-motion.sqlite")
CATALOG = json.loads((Path(__file__).parents[1] / "catalog.json").read_text())
PRODUCTS = {product["sku"]: product for product in CATALOG["products"]}
ENDPOINT = "https://bzr.openai.com/v1/events"
logger = logging.getLogger("nano_motion")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Item(StrictModel):
    sku: str = Field(max_length=32)
    size: str = Field(max_length=16)
    quantity: StrictInt = Field(ge=1, le=20)


class Event(StrictModel):
    event_id: UUID
    name: Literal["items_added", "checkout_started", "lead_created"]
    timestamp_ms: StrictInt
    source_url: str = Field(max_length=2048)
    consent: Literal[True]
    items: list[Item] = Field(default_factory=list, max_length=40)
    oppref: str | None = Field(default=None, min_length=1, max_length=4096)
    obref: str | None = Field(default=None, min_length=1, max_length=4096)

    @field_validator("timestamp_ms")
    @classmethod
    def recent_timestamp(cls, value):
        now = int(time.time() * 1000)
        if not now - 7 * 86400000 <= value <= now + 600000:
            raise ValueError("Event timestamp outside the permitted window")
        return value

    @field_validator("source_url")
    @classmethod
    def allowed_source(cls, value):
        url = urlsplit(value)
        if (
            url.scheme not in {"http", "https"}
            or f"{url.scheme}://{url.netloc}" not in ORIGINS
            or url.username
            or url.password
            or url.query
            or url.fragment
        ):
            raise ValueError("Source must be an allowed origin with no query or fragment")
        return value

    @field_validator("oppref", "obref")
    @classmethod
    def nonblank(cls, value):
        if value is not None and (not value.strip() or any(ord(c) < 32 for c in value)):
            raise ValueError("Invalid attribution identifier")
        return value  # Preserve opaque identifiers unchanged.


class Checkout(Event):
    name: Literal["order_created"] = "order_created"
    consent: bool = False
    items: list[Item] = Field(min_length=1, max_length=40)


def commerce(items):
    contents = []
    seen = set()
    for item in items:
        product = PRODUCTS.get(item.sku)
        if not product or item.size not in product["sizes"]:
            raise HTTPException(422, "Unknown SKU or unavailable size")
        pair = (item.sku, item.size)
        if pair in seen:
            raise HTTPException(422, "Duplicate cart line")
        seen.add(pair)
        contents.append(
            {
                "id": product["sku"],
                "name": product["name"],
                "content_type": "product",
                "quantity": item.quantity,
                "amount": product["price"],
                "currency": "USD",
            }
        )
    return {
        "type": "contents",
        "amount": sum(c["amount"] * c["quantity"] for c in contents),
        "currency": "USD",
        "contents": contents,
    }


def transform(event):
    if event.name == "lead_created":
        if event.items:
            raise HTTPException(422, "Lead events cannot contain cart items")
        data = {"type": "customer_action"}
    else:
        if not event.items:
            raise HTTPException(422, "Commerce events require items")
        data = commerce(event.items)
    result = {
        "id": str(event.event_id),
        "type": event.name,
        "timestamp_ms": event.timestamp_ms,
        "action_source": "web",
        "source_url": event.source_url,
        "data": data,
    }
    if event.consent:
        if event.oppref:
            result["oppref"] = event.oppref
        if event.obref:
            result["user"] = {"obref": event.obref}
    return result


def connect():
    connection = sqlite3.connect(DB, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute(
            "CREATE TABLE IF NOT EXISTS records "
            "(id TEXT PRIMARY KEY, fingerprint TEXT, result TEXT, payload TEXT, "
            "status TEXT, attempts INTEGER DEFAULT 0, next_attempt REAL DEFAULT 0)"
        )


def record(event, order=False):
    payload = transform(event)
    fingerprint = hashlib.sha256(
        event.model_dump_json(exclude={"consent", "oppref", "obref"}).encode()
    ).hexdigest()
    result = {
        "event_id": str(event.event_id),
        "data": payload["data"],
        "mode": "validate_only" if VALIDATE_ONLY else "live",
    }
    status = "pending" if KEY else "demo_not_delivered"
    if not event.consent:
        status = "blocked_consent"
    if order:
        result["order_id"] = "NM-" + str(event.event_id).replace("-", "")[:12].upper()
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        old = db.execute("SELECT * FROM records WHERE id=?", (str(event.event_id),)).fetchone()
        if old:
            if old["fingerprint"] != fingerprint:
                raise HTTPException(409, "Event ID already used for a different request")
            if not event.consent and old["status"] == "pending":
                db.execute(
                    "UPDATE records SET status='blocked_consent',payload='{}' WHERE id=?",
                    (str(event.event_id),),
                )
                return {**json.loads(old["result"]), "server_status": "blocked_consent"}
            return {**json.loads(old["result"]), "server_status": old["status"]}
        db.execute(
            "INSERT INTO records(id,fingerprint,result,payload,status) VALUES(?,?,?,?,?)",
            (
                str(event.event_id),
                fingerprint,
                json.dumps(result),
                json.dumps(payload) if event.consent else "{}",
                status,
            ),
        )
    logger.info("event=%s status=%s items=%s", event.name, status, len(event.items))
    return {**result, "server_status": status}


async def deliver(event_id, client=None):
    with connect() as db:
        row = db.execute("SELECT * FROM records WHERE id=?", (event_id,)).fetchone()
    if not row or row["status"] != "pending" or not KEY:
        return
    if json.loads(row["payload"])["timestamp_ms"] < int(time.time() * 1000) - 7 * 86400000:
        status = "expired_not_delivered"
    else:
        batch = {
            "validate_only": VALIDATE_ONLY,
            "integration_source": os.getenv("INTEGRATION_SOURCE", "nano_motion_demo"),
            "events": [json.loads(row["payload"])],
        }
        owned = client is None
        client = client or httpx.AsyncClient(timeout=httpx.Timeout(5.0), follow_redirects=False)
        try:
            response = await client.post(
                ENDPOINT,
                params={"pid": PIXEL_ID},
                headers={"Authorization": f"Bearer {KEY}"},
                json=batch,
            )
            if 200 <= response.status_code < 300:
                status = "validated" if VALIDATE_ONLY else "accepted"
            elif response.status_code == 429 or response.status_code >= 500:
                status = "pending"
            else:
                status = "rejected"
        except (httpx.TimeoutException, httpx.NetworkError):
            status = "pending"
        finally:
            if owned:
                await client.aclose()
    with connect() as db:
        db.execute(
            "UPDATE records SET status=?,attempts=attempts+1,next_attempt=? WHERE id=?",
            (status, time.time() + min(3600, 2 ** min(row["attempts"] + 1, 12)), event_id),
        )


async def worker():
    while True:
        with connect() as db:
            rows = db.execute(
                "SELECT id FROM records WHERE status='pending' AND next_attempt<=? LIMIT 20",
                (time.time(),),
            ).fetchall()
        for row in rows:
            await deliver(row["id"])
        await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app):
    init_db()
    task = asyncio.create_task(worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def limits(request: Request, call_next):
    if request.method == "POST":
        origin = request.headers.get("origin")
        if origin and origin not in ORIGINS:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 16384:
                return JSONResponse({"detail": "Request too large"}, status_code=413)
        request._body = bytes(body)
    return await call_next(request)


@app.exception_handler(Exception)
async def unexpected(request, exc):
    logger.error("Request failed: %s", type(exc).__name__)
    return JSONResponse({"detail": "Service temporarily unavailable"}, status_code=503)


@app.exception_handler(422)
async def safe_validation(request, exc):
    return JSONResponse({"detail": "Invalid request"}, status_code=422)


@app.exception_handler(RequestValidationError)
async def safe_schema_validation(request, exc):
    return JSONResponse({"detail": "Invalid request"}, status_code=422)


@app.get("/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {
        "status": "ok",
        "measurement": "configured" if KEY else "demo_not_delivered",
        "mode": "validate_only" if VALIDATE_ONLY else "live",
        "pixel_id": PIXEL_ID,
    }


@app.post("/api/events", status_code=202)
def events(event: Event):
    return record(event)


@app.post("/api/checkout")
def checkout(event: Checkout):
    return record(event, order=True)


@app.get("/api/events/{event_id}")
def event_status(event_id: UUID):
    with connect() as db:
        row = db.execute("SELECT status FROM records WHERE id=?", (str(event_id),)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    return {
        "event_id": str(event_id),
        "server_status": row["status"],
        "mode": "validate_only" if VALIDATE_ONLY else "live",
    }
