# Verification record — October 7, 2026

## Public deployment

- Repository: https://github.com/mikeivanov-code/nano-motion-store
- Storefront: https://mikeivanov-code.github.io/nano-motion-store/
- Initial successful workflow: https://github.com/mikeivanov-code/nano-motion-store/actions/runs/37720315130
- Remote configured as `git@github.com:mikeivanov-code/nano-motion-store.git`; project pushed through SSH using a repository-scoped deploy key. GitHub's official Ed25519 host key was pinned and its fingerprint verified.
- All 17 public HTML pages returned HTTP 200, including all 12 dedicated product URLs, catalog, cart, checkout, and confirmation. The deployed bootstrap contains exactly `F7KSWkG5KCzsqcVr7nHP18`.

## Automated verification

33 pytest cases passed locally. Coverage includes strict integer quantities, minor-unit amounts, catalog totals, supported event allowlisting, extra-field rejection, invalid URLs/timestamps/UUIDs, payload schemas, opaque attribution placement, idempotent checkout, conflicting retries, missing-key demo mode, consent withdrawal, request-size limits, CORS, redacted validation responses, mocked accepted/validated/rejected responses, retryable statuses, timeouts, preserved IDs, and stale-event expiry.

Python formatting and lint checks passed. Frontend syntax checks passed. Node measurement checks verify shared Pixel/CAPI IDs, name and timestamp parity, persisted retry envelopes, consent revocation, no blocked-event replay, official queue behavior, consent before initialization, and exact Pixel ID. All generated page assets, SKU/slug uniqueness, product images, and catalog minor-unit values passed build verification.

Local tests ran on Python 3.14.2; the successful GitHub Actions run verifies the backend checks on Python 3.12 and frontend checks on Node 22. Ordinary automated tests mock network delivery and never submit OpenAI events.

## Manual shopping review

Verified category filtering, product search, dedicated product navigation, keyboard selection of size M, keyboard add-to-bag, quantity editing, cart persistence after refresh, and cart clearing after completed checkout.

Local API-connected checkout validated two Aero Run Shells as $296 (29600 USD minor units), returned a stable `NM-` order ID, and reported `blocked_consent` with measurement declined. Refreshing confirmation did not add another order event.

Verified the public GitHub Pages journey from catalog to product, size selection, cart, checkout acknowledgment, and explicit local fallback. Confirmation showed `LOCAL-` order ID, no payment, no shipping, no server validation, and no CAPI delivery. Confirmation refresh retained one order-event entry. Public membership-interest submission displayed its acknowledgment. Debug history and consent behavior were reviewed.

Reviewed the original desktop homepage visually and the mobile homepage inside a fixed 390 × 844 frame. Responsive CSS uses a single-column product/checkout layout and a two-column mobile product grid. The connected browser's iframe interactions were unavailable, so a full physical-device mobile journey remains a recommended follow-up; desktop keyboard and public shopping behavior were exercised directly.

## Remaining verification and deployment boundary

The user selected GitHub Pages hosting. No external Python service was provisioned, so there is no public backend URL or public `/health` endpoint. The Python API ran locally and its health endpoint was tested. The production `API_URL` remains empty intentionally; public checkout is a labeled local simulation.

No CAPI key was provided. Real OpenAI validation acceptance, live server delivery, and cross-channel deduplication receipt therefore remain unverified. Tests verify payload generation and identical IDs using mocked transport. Browser Pixel receipt was not established through account event-testing tools; the implementation and deployed exact-ID bootstrap were verified. Use the separate manual validation procedure in README with the account's authorized Ads API testing tools or DevTools Network inspection.

Completing server measurement requires a Python host, its account/billing authorization, a server-side CAPI key, exact allowed Pages origin, and a Pages rebuild with the backend HTTPS origin. GitHub Pages cannot provide Python execution. Account enablement or an Ads API key may also be necessary for the recent-event stream. No claim of successful live CAPI delivery is made.
