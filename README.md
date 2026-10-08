# Nano Motion

An original premium activewear demo: twelve fictional products, original SVG illustrations, searchable catalog, dedicated product URLs, persistent cart, simulated checkout, membership interest, and a consent-controlled OpenAI Ads measurement lab.

**This storefront never accepts payments or requests card numbers, addresses, names, or email addresses.** Mock orders do not ship. USD prices and all transmitted monetary amounts are integer ISO 4217 minor units.

## Architecture and hosting boundary

GitHub Pages serves the static output of `npm run build`. It cannot execute Python. FastAPI must run on a separate Python-capable service for catalog-authoritative order validation and Conversions API delivery. `render.yaml` prepares a Render deployment with a persistent disk. The frontend remains usable without that service and offers an explicitly labeled local checkout simulation. Local simulations have `LOCAL-` order IDs and do not create CAPI order events. They must not be counted as server-confirmed orders.

The user requested GitHub Pages hosting. The static deployment supports that preference; the Python hosting step remains separate. Neither the frontend nor debug panel contains a CAPI key.

```
Browser → GitHub Pages (HTML/CSS/JS, catalog, original illustrations)
        → OpenAI Measurement Pixel (only after consent)
        → Python FastAPI → SQLite order/outbox → OpenAI Conversions API
```

`catalog.json` is the single version-controlled product catalog. The browser loads it; Python reads the same file from its checkout. Deploy frontend and backend from the same Git revision when prices change. `scripts/catalog.mjs` is an artwork/catalog authoring helper; normal builds never regenerate prices or SKUs.

## Local setup

Use Node 22+ and Python 3.12. Local checks may use a newer Python; CI verifies Python 3.12. No npm dependencies or frontend framework are required.

```powershell
python -m venv .venv
./.venv/Scripts/python -m pip install -r backend/requirements-dev.txt
npm run check
$env:API_URL = 'http://localhost:8001'
npm run build
./.venv/Scripts/python -m uvicorn backend.app:app --port 8001 --no-access-log
```

In another terminal, run `python -m http.server 8000 --directory dist`, then open `http://localhost:8000/?debug=1`. For a realistic Pages subpath check, serve the parent directory and visit `/nano-motion-store/dist/`. `localhost` is the allowlisted development origin; avoid mixing it with `127.0.0.1`.

Linux/macOS equivalents use `.venv/bin/python`. Load your local `.env` using uvicorn's `--env-file backend/.env`; copy `backend/.env.example` first. The file is ignored by Git. Never paste a key into client code, GitHub repository variables, screenshots, or chat.

## Environment

- `OPENAI_PIXEL_ID=F7KSWkG5KCzsqcVr7nHP18`: same ID as the browser.
- `OPENAI_CONVERSIONS_API_KEY`: server secret; leave empty for local demo mode.
- `OPENAI_CAPI_VALIDATE_ONLY=true`: accepted requests validate without saving conversions. Only `validated` is reported; it is not live delivery.
- `ALLOWED_ORIGINS`: exact comma-separated frontend origins, e.g. `https://mikeivanov-code.github.io,http://localhost:8000`. CORS origins have no path, even when Pages uses a repository subpath.
- `INTEGRATION_SOURCE=nano_motion_demo`: stable integration identifier.
- `DATABASE_PATH`: writable SQLite file, on persistent storage in deployment.
- Build-time `API_URL`: public HTTPS API origin only. This value is safe to expose. Empty means local simulation only. HTTP is allowed exclusively for `localhost` development.

## GitHub Pages deployment

Create a separate public `nano-motion-store` repository in the authenticated GitHub account. Initialize `main`, configure `git@github.com:OWNER/nano-motion-store.git`, and push. The checked-in workflow tests the Python integration, builds 17 static pages, uploads the Pages artifact, and deploys it using GitHub's supported Actions deployment.

```sh
gh repo create nano-motion-store --public --source . --remote origin
git remote set-url origin git@github.com:OWNER/nano-motion-store.git
git push -u origin main
gh api --method POST repos/OWNER/nano-motion-store/pages -f build_type=workflow
# When an external API is deployed:
gh variable set API_URL --body https://YOUR-API-HOST
gh workflow run pages.yml
```

Configure Pages → Source → GitHub Actions if doing this through the UI. Ensure SSH is already authorized and verify GitHub's published host fingerprint before trusting a new host key. The `API_URL` repository variable is optional. All product and checkout pages use relative assets and directory `index.html` files; no SPA rewrite or domain-root assumption is required.

## Python deployment

Deploy this repository using the Render Blueprint (`render.yaml`) or equivalent service. The prepared blueprint uses a paid persistent-disk plan: review its current price before provisioning. A single worker and persistent SQLite disk preserve orders and outbox entries across restarts. An ephemeral free instance cannot provide that durability. No paid service is provisioned without account/billing authorization.

Build: `pip install -r backend/requirements.txt`. Start: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log`. Set secrets in the host's secret manager, not Git. Confirm `/health`, set `ALLOWED_ORIGINS` to the Pages origin, and rebuild Pages with `API_URL` set to the backend origin. The CSP is generated with that exact API origin and the official Pixel domains. No `unsafe-inline` is required.

Do not use multiple workers or replicas with this simple SQLite outbox. For production scale, replace it with a transactional database and queue, use leases for dispatch, configure abuse limits, and add operational monitoring. CORS is not authentication. Endpoints are intentionally public demo endpoints; deploy behind a host-level rate limiter/WAF before promoting externally.

## Measurement and consent

The official bootstrap runs near the top of the head on every page, from a same-origin script. It establishes the `oaiq` queue, sets consent before `init`, and uses Pixel ID `F7KSWkG5KCzsqcVr7nHP18`. Optional measurement defaults to denied and persists in localStorage. Changing preferences affects future events. Blocked events are never replayed. Revocation drops browser retry entries and prevents new attribution-cookie forwarding.

The app sends no raw personal information or manual advanced-matching data. No contact fields are present for the Pixel to inspect. Confirm automatic advanced-matching settings for this Pixel in your account before production use; the official SDK may apply account-managed behavior. Consent requirements and wording need review for your actual audience and jurisdiction.

`__oppref` is forwarded unchanged as event-level `oppref`; `__obref` is forwarded unchanged as `user.obref`. These identifiers are read only after consent and never displayed in the debug panel. The landing URL's `oppref` can be used before the Pixel has written its cookie. API `source_url` excludes query strings and fragments to avoid leaking arbitrary URL data.

Important pages use `page_viewed`; product details additionally use `contents_viewed`. Cart addition, checkout start, order completion, and membership interest use `items_added`, `checkout_started`, `order_created`, and `lead_created`. Membership is a no-contact interest survey, not a paid subscription.

## Shared IDs and checkout idempotency

1. The browser creates one UUID for each action. It passes the UUID to `oaiq('measure', name, data, {event_id})` and sends the same value to FastAPI.
2. FastAPI sets CAPI `events[].id` to that UUID. Pixel ID and event name also match. This is the documented deduplication key.
3. Browser retries retain the complete original envelope, including timestamp and ID. Server retries retain the stored payload. Nothing generates a new ID for a retry.
4. Checkout persists its envelope before sending. The API computes the total using SKUs, sizes, integer quantities, and server catalog prices; browser totals and arbitrary payload fields are rejected.
5. SQLite atomically stores an order and outbox entry under the event ID. Reusing the ID with a different cart returns 409. Exact retries return the existing order. Consent may be revoked without changing the identity of the order.
6. After confirmation, the browser persists completed state **before** emitting the Pixel order event, clears the cart, and navigates. Refreshing confirmation never emits another order event. This favors avoiding duplicate browser events if a tab crashes between persistence and the Pixel call; the durable server copy covers that case when configured.

The local fallback completes only after the user chooses it. If the API accepted an order before a timeout, fallback can leave a server order plus a local confirmation, using the same underlying event ID. It does not create a second server order. Offline fallback orders are never retroactively submitted to CAPI. Persistence assumes localStorage is enabled and retained; clearing browser data resets the demo state.

## Delivery and debug panel

Open `?debug=1`; the lab remains enabled for that browser tab as you navigate. It displays event name, UUID, timestamp, sanitized SKU/quantity/amount summary, channel statuses, mode, and expected deduplication. It never renders authorization headers, attribution cookies, credentials, or raw personal data. Clear debug history affects history only, not delivery queues.

`queued to SDK; receipt unverified` is deliberately distinct from browser receipt. `pending` means the API stored an event but has not received a successful OpenAI response. The panel polls pending server statuses. `validated` means OpenAI accepted a validation-only request; `accepted` means a live-mode HTTP success. `demo_not_delivered` means no key was configured. `rejected`, `blocked_consent`, and `expired_not_delivered` are explicit terminal outcomes.

Shopping does not wait for add-to-cart measurement. Browser retry storage is capped at 100 entries, drops events older than seven days, and backs off up to one minute. The server outbox uses backoff up to one hour, expires events outside the documented timestamp window, and retries network errors, 429, and 5xx. Permanent 4xx are reported as rejected. API request bodies are limited to 16 KiB, sources are origin-allowlisted, Pydantic forbids extras, requests have a five-second timeout, redirects are disabled, and logs omit request payloads and credentials.

## Automated checks

```sh
python -m ruff check backend
python -m ruff format --check backend
python -m pytest -q
npm run check
npm run build
```

Tests mock the OpenAI HTTP endpoint: no ordinary test submits an event to OpenAI. They cover schemas, quantity typing, minor units, payload transformation, attribution placement, shared IDs, conflict rejection, retry/timeout handling, CORS, request-size limits, consent, and checkout idempotency. CI runs these checks on Python 3.12.

Manual visual QA should include 390px and desktop widths, search and categories, every product URL, keyboard size selection and focus, cart quantity/removal and persistence, API checkout, outage fallback, confirmation refresh, and preference changes. See `docs/verification.md` for actual results and remaining checks.

## Separate manual OpenAI validation

Keep `OPENAI_CAPI_VALIDATE_ONLY=true`; configure the key only on the Python host. Restart, confirm `/health` reports configured/validate_only, allow measurement, then add a product, begin checkout, complete a mock order, and submit membership interest. Verify server statuses become `validated`. A queued/pending response alone is not proof of acceptance.

For Pixel testing, allow measurement before navigating to a fresh measured page, use `?debug=1`, and inspect browser DevTools Network requests to `bzrcdn.openai.com` and `bzr.openai.com`. Check standard event names and identical browser/server UUIDs. The official `GET https://api.ads.openai.com/v1/conversions/events?pid=F7KSWkG5KCzsqcVr7nHP18` event stream can confirm recent Pixel receipt for enabled accounts using an **Ads API key**, which is different from the CAPI key. It returns recent events, not an attribution report. A 404 can mean account enablement is required. Use Ads Manager to verify conversion event settings and reporting. Browser Pixel events do not inherit CAPI's validation-only mode; deliberate manual Pixel testing can record browser events.

Do not change `OPENAI_CAPI_VALIDATE_ONLY` to false until the account owner approves live submissions and verifies event configuration. Mock orders are synthetic and must not be used to assess real advertising performance.

## Internationalization and limitations

The catalog has locale metadata, per-currency price maps, and minor-unit precision metadata. Only USD/en-US is implemented. Adding JPY or another currency requires catalog prices, currency-specific formatting, server validation, and tests; do not simply relabel USD amounts. There is no inventory service, payment, tax calculation, shipping, customer database, login, real lead collection, or email delivery. Original illustrations depict fictional garments, not commercial photography.

Future genuine paid memberships can use `subscription_created` and genuine trial starts can use `trial_started`, with the documented `plan_enrollment` shape and shared IDs at the transaction boundary. Interest remains `lead_created` until then.

## Official sources reviewed

- [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel)
- [Conversions API](https://developers.openai.com/ads/conversions-api)
- [Supported events](https://developers.openai.com/ads/supported-events)
- [Conversion setup and recent Pixel events](https://developers.openai.com/ads/api-reference/conversion-setup)

Implementation follows these sources as retrieved October 7, 2026. See `docs/measurement-plan.md` and `docs/demo-script.md` for the business design and presentation.
