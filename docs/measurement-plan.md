# Nano Motion measurement plan

## Business objectives

Help a CMO see which advertising interactions lead to product exploration, meaningful cart intent, completed orders, and future membership interest. Help a CTO see trustworthy event boundaries, authoritative commerce values, consent-aware attribution, resilient delivery, and understandable operational statuses. This fictional demo proves integration behavior, not sales performance.

## Event mapping and funnel

- `page_viewed`: important page reach. Browser only. Useful for landing coverage and funnel denominators.
- `contents_viewed`: dedicated product viewed. Browser only. Connects merchandising and product consideration to stable SKUs.
- `items_added`: actual add action after variant selection. Browser and server. Includes only the added quantity and its value, rather than misreporting the entire existing cart.
- `checkout_started`: checkout opened with a nonempty cart. Browser and server. Includes the complete cart value. Revisiting checkout is a new start action; it is not an order.
- `order_created`: catalog-validated mock order committed by the backend. Browser and server share the UUID. This is the primary outcome because it represents the transaction boundary rather than an intermediate click. Local fallback is clearly identified and lacks a server-confirmed order event.
- `lead_created`: genuine submission of a membership-interest choice. Browser and server use `customer_action`. No PII is necessary for the demonstration; no real outreach or CRM lead is created.

The funnel is important page → product → cart addition → checkout start → order. Analyze counts, conversion rates, SKU/value distributions, and channel coverage only once event settings and attribution reporting are configured. Event receipt is not proof of ad attribution. Synthetic order revenue is not business revenue.

## Responsibilities and deduplication

The browser owns consent UI, page/product intent, immediate shopping interactions, UUID generation, and persisted retry envelopes. The server owns supported-event validation, catalog prices and variants, exact integer quantities, mock order creation, transactional idempotency, secret authentication, and durable delivery. Both use Pixel ID `F7KSWkG5KCzsqcVr7nHP18`.

The deduplication key is Pixel ID + event name + event ID. CAPI `id` and Pixel `event_id` are identical. The first accepted copy is used by OpenAI; later duplicates do not create another conversion. Retry timestamps and IDs are preserved. Application checkout idempotency also prevents two orders before platform-level deduplication becomes relevant. Completed browser state is written before the Pixel call and confirmation refresh sends only `page_viewed`.

## Attribution and privacy

After consent, `oppref` is captured unchanged from the official cookie or landing parameter and forwarded at event level. `__obref` is forwarded unchanged as `user.obref`. Neither identifier appears in debug history. The browser's source URL excludes query strings and fragments. No IP or user-agent matching is implemented; no raw names, phones, emails, or addresses are collected. No manual advanced matching is used. Audit account-managed automatic matching before collecting personal information in any future version.

Measurement defaults off. Consent is set before Pixel initialization and stored locally. Blocked actions are not replayed after consent. Revocation removes eligible browser retry entries and prevents further cookie forwarding; events already sent to a server or OpenAI are not retroactively deleted. A production consent-management platform should coordinate granular purposes, regional requirements, withdrawal, retention, and deletion obligations.

## Signal quality and coverage

Distinguish SDK queue, browser receipt, server queue, validation, live acceptance, and attribution. CAPI validate-only validates without saving conversions. Missing credentials are demo mode, never successful delivery. Monitor acceptance rates, rejected payloads, stale events, backoff, queue age, consent rates, price/catalog revision alignment, and discrepancies between validated orders and event counts. Keep raw data out of logs.

Browser coverage can fall due to consent denial, blockers, unloads, or script failures. Server coverage can fall due to unavailable services, missing keys, rejection, or expired timestamps. The debug lab makes these gaps visible without claiming a precise coverage estimate. Buildless client routes work from the Pages repository subpath, preventing lost product journeys from deployment routing mistakes.

## International readiness

Keep SKUs stable across locales. Add explicitly priced currencies to the catalog and validate supported currency choices server-side. Minor units vary by currency; production formatting must use the correct ISO 4217 exponent. Add locale-specific product names without changing SKU identity. Configure market-specific tax/shipping and clarify event-level gross/net value conventions before analyzing multi-market ROAS.

## Membership roadmap

Current interest is `lead_created`. Introduce `subscription_created` only after a genuine paid enrollment and `trial_started` only after a real trial begins. Use `plan_enrollment`, a stable plan ID, documented monetary fields, and a transaction-level shared ID. Subscription billing webhooks should own recurring lifecycle reliability. Do not reinterpret an interest submission as a purchase or trial.

## Production next steps

Replace SQLite with a managed transactional database and leased queue; add authenticated operational access, host-level abuse protection, consent auditing, retention/deletion controls, alerts, a dead-letter review path, dependency pinning and security updates, and real order/fulfillment integration. Keep conversion keys in a secret manager. Register `order_created` as the primary conversion setting in the ad account and attach it to campaigns. Verify acceptance and deduplicated behavior before enabling live mode. Establish actual measurement KPIs and perform end-to-end privacy and accessibility review.

Official references: [Pixel](https://developers.openai.com/ads/measurement-pixel), [CAPI](https://developers.openai.com/ads/conversions-api), [supported events](https://developers.openai.com/ads/supported-events).
