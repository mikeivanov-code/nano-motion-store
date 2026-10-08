# Nine-minute Nano Motion demonstration

Prepare the Pages URL with `?debug=1`. Use a test browser, an API in validate-only mode, and the actual account's authorized test procedure. Browser events can still be recorded; Pixel has no CAPI validate-only switch. If the API is absent, explicitly present the local simulation and pending deployment boundary.

**0:00–1:00 — Brand and objective.** Show the homepage. “Nano Motion is fictional premium activewear. We’re demonstrating how shopping intent becomes a reliable measurement signal. No payments or personal checkout details are collected.” Show the original identity and catalog.

**1:00–2:00 — Consent, discovery, and product.** Allow optional measurement for future actions; explain earlier blocked actions are not replayed. Filter Running or search for Aero. Open the dedicated product page. Point out the stable SKU, responsive layout, size selection, `page_viewed`, and `contents_viewed`.

**2:00–3:00 — Add to bag.** Select M and add the shell. It responds immediately; measurement does not delay the cart. Explain `items_added`, quantity 1, amount 14800 minor units, currency USD, and documented product contents. The shared ID is created once.

**3:00–4:00 — Bag and checkout.** Open the bag, change quantity to 2, and show persistence through refresh. Begin mock checkout. `checkout_started` represents the full $296 cart. Explain that cart edits do not automatically create extra add-to-cart events.

**4:00–5:00 — Complete order.** Acknowledge the simulation and submit once. Show progress and “Order complete.” The backend validates SKU, variant, quantity, and catalog price. Refresh confirmation: the order ID stays the same and no new order event occurs. If the API is down, demonstrate retry or the explicitly labeled local simulation, with server delivery unavailable.

**5:00–6:30 — Measurement lab.** Inspect the debug panel. Read event name, UUID, time, sanitized item summary, channel statuses, and mode. “SDK queued is not receipt. Pending is not accepted. Validated means the API accepted validation without saving conversions.” Explain how the identical UUID appears in Pixel `event_id` and CAPI `id` and how Pixel ID + name + ID prevents double counting. Retries keep that UUID.

**6:30–7:30 — Value for the CMO.** “Product views explain consideration; cart and checkout reveal intent; order completion is the primary outcome. Stable products and validated order values improve signal quality. We can connect campaign reporting to outcomes once account settings and attribution are verified. These mock orders are synthetic, not a performance claim.” Submit membership interest and explain `lead_created`.

**7:30–8:30 — Value for the CTO.** Explain the GitHub Pages frontend/Python backend boundary, environment secrets, Pydantic allowlists, strict monetary integers, request limits, CORS, timeouts, transactional order storage, durable outbox, retry backoff, and consent-gated attribution. Future scale uses a managed database and queue. No API key reaches the browser.

**8:30–9:00 — Roadmap and close.** Show that locale/currency metadata is ready for extension, with only USD currently implemented. Genuine paid membership would add `subscription_created`; a genuine trial would use `trial_started`. End on the core principle: an explicit customer action, a trustworthy value, a shared identity, and an honest delivery status.
