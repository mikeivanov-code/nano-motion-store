import { API_URL } from './config.js';
const dual = new Set(['items_added', 'checkout_started', 'order_created', 'lead_created']);
export const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
export const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
export const consent = () => localStorage.getItem('nm-consent') === 'yes';
const debug = new URLSearchParams(location.search).get('debug') === '1' || sessionStorage.getItem('nm-debug') === '1';
if (new URLSearchParams(location.search).get('debug') === '1') sessionStorage.setItem('nm-debug', '1');
let history = read('nm-history', []).slice(-80);
let queue = read('nm-outbox', []);
let flushing = false;
export function setConsent(allowed) {
  localStorage.setItem('nm-consent', allowed ? 'yes' : 'no');
  window.oaiq('consent', allowed);
  if (!allowed) { queue = []; save('nm-outbox', queue); }
  else flush();
}
export function dataFor(items, catalog) {
  const contents = items.map(i => {
    const p = catalog.find(p => p.sku === i.sku);
    return { id: p.sku, name: p.name, content_type: 'product', quantity: i.quantity, amount: p.price, currency: p.currency };
  });
  return { type: 'contents', amount: contents.reduce((sum, c) => sum + c.amount * c.quantity, 0), currency: 'USD', contents };
}
const cookie = name => {
  const match = document.cookie.split('; ').find(c => c.startsWith(name + '='));
  if (!match) return undefined;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return undefined; }
};
export function envelope(name, items = [], id = crypto.randomUUID()) {
  const event = { event_id: id, name, timestamp_ms: Date.now(), source_url: location.origin + location.pathname, consent: consent(), items };
  if (event.consent) {
    const oppref = cookie('__oppref') || new URLSearchParams(location.search).get('oppref');
    const obref = cookie('__obref');
    if (oppref) event.oppref = oppref;
    if (obref) event.obref = obref;
  }
  return event;
}
function render() {
  if (!debug) return;
  const panel = document.querySelector('#debug');
  if (!panel) return;
  panel.hidden = false;
  panel.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'Measurement lab'; panel.append(heading);
  const note = document.createElement('p'); note.textContent = 'SDK queued ≠ received. Server pending ≠ accepted. Deduplication expected only when both channels send the same ID.'; panel.append(note);
  const clear = document.createElement('button'); clear.textContent = 'Clear debug history'; clear.onclick = () => { history = []; save('nm-history', []); render(); }; panel.append(clear);
  for (const row of history.slice().reverse()) {
    const card = document.createElement('article');
    const text = document.createElement('pre');
    text.textContent = `${row.name}\nID ${row.id}\n${new Date(row.timestamp).toISOString()}\nPixel: ${row.pixel}\nCAPI: ${row.server}\nMode: ${row.mode}\nDeduplication expected: ${row.dedup ? 'yes' : 'no'}\n${JSON.stringify(row.summary)}`;
    card.append(text); panel.append(card);
  }
}
function update(id, patch) { history = history.map(r => r.id === id ? { ...r, ...patch } : r); save('nm-history', history); render(); }
export function measure(event, data, { server = dual.has(event.name), serverStatus = null, mode = 'unknown until API responds' } = {}) {
  const allowed = consent() && event.consent;
  let pixel = allowed ? (window.nanoPixelFailed ? 'SDK load failed' : 'queued to SDK; receipt unverified') : 'blocked by consent';
  if (allowed) window.oaiq('measure', event.name, data, { event_id: event.event_id });
  const dedup = server && allowed && Boolean(API_URL) && !window.nanoPixelFailed && !['demo_not_delivered','blocked_consent','rejected','unavailable; local simulation only'].includes(serverStatus);
  const row = { name: event.name, id: event.event_id, timestamp: event.timestamp_ms, pixel, server: serverStatus || (server ? (allowed ? (API_URL ? 'queued' : 'unavailable: no API configured') : 'blocked by consent') : 'not used'), mode: server ? mode : 'browser only', dedup, summary: { type: data.type, amount: data.amount, currency: data.currency, contents: data.contents?.map(c => ({ id: c.id, quantity: c.quantity })) } };
  if (debug) { history.push(row); history = history.slice(-80); save('nm-history', history); render(); }
  if (server && allowed && !serverStatus && event.name !== 'order_created' && API_URL) {
    queue.push({ event, attempts: 0, next: 0 }); queue = queue.slice(-100); save('nm-outbox', queue); flush();
  }
}
export async function api(path, body) {
  if (!API_URL) throw new Error('API not configured');
  const response = await fetch(API_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error('API request rejected'); error.status = response.status; throw error; }
  return response.json();
}
export async function flush() {
  if (flushing || !API_URL || !consent()) return;
  flushing = true;
  try {
    for (const pending of queue.slice()) {
      if (pending.next > Date.now()) continue;
      if (Date.now() - pending.event.timestamp_ms > 7 * 86400000) { queue = queue.filter(q => q !== pending); update(pending.event.event_id, { server: 'expired; not delivered' }); continue; }
      try {
        const result = await api('/api/events', pending.event);
        queue = queue.filter(q => q !== pending);
        update(pending.event.event_id, { server: result.server_status, mode: result.mode });
      } catch (error) {
        if (error.status && error.status < 500 && error.status !== 429) { queue = queue.filter(q => q !== pending); update(pending.event.event_id, { server: 'rejected' }); }
        else { pending.attempts++; pending.next = Date.now() + Math.min(60000, 1000 * 2 ** pending.attempts); update(pending.event.event_id, { server: 'retry queued; not accepted' }); }
      }
      save('nm-outbox', queue);
    }
  } finally { flushing = false; save('nm-outbox', queue); }
}
export function refreshDebug() { render(); }
setInterval(flush, 15000);
window.addEventListener('online', flush);
async function pollStatuses() {
  if (!debug || !API_URL || !consent()) return;
  for (const row of history.filter(r => r.server === 'pending').slice(-20)) {
    try {
      const response = await fetch(API_URL + '/api/events/' + encodeURIComponent(row.id), {signal:AbortSignal.timeout(5000)});
      if (response.ok) { const result = await response.json(); update(row.id, {server:result.server_status,mode:result.mode}); }
    } catch { /* Shopping never waits for measurement. */ }
  }
}
setInterval(pollStatuses, 5000);
