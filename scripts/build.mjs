import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await readFile('catalog.json', 'utf8'));
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('frontend', 'dist/assets', { recursive: true });
await cp('catalog.json', 'dist/catalog.json');
await writeFile('dist/.nojekyll', '');
const api = process.env.API_URL || '';
if (api && !/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(api) && !/^http:\/\/localhost:\d+$/.test(api)) throw new Error('API_URL must be an HTTPS origin (localhost HTTP is allowed for development)');
await writeFile('dist/assets/config.js', `export const API_URL = ${JSON.stringify(api)};\n`);
const routes = ['', 'catalog', 'cart', 'checkout', 'confirmation', ...catalog.products.map(p => 'products/' + p.slug)];
for (const route of routes) {
  const depth = route ? route.split('/').length : 0;
  const root = depth ? '../'.repeat(depth) : './';
  const title = catalog.products.find(p => route === 'products/' + p.slug)?.name || 'Made for the moving world';
  const csp = `default-src 'self'; script-src 'self' https://bzrcdn.openai.com; style-src 'self'; img-src 'self' data: https://bzr.openai.com; connect-src 'self' https://bzr.openai.com https://bzrcdn.openai.com${api ? ' ' + api : ''}; object-src 'none'; base-uri 'self'; form-action 'self'`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><script src="${root}assets/pixel.js"></script><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Nano Motion. Premium performance essentials. A fictional ecommerce and measurement demo."><meta name="theme-color" content="#e8ff63"><title>${title} — Nano Motion</title><link rel="icon" href="${root}assets/mark.svg"><link rel="stylesheet" href="${root}assets/style.css"><script type="module" src="${root}assets/app.js"></script></head><body data-root="${root}" data-route="${route}"><a class="skip" href="#main">Skip to content</a><div class="announcement">ENGINEERED FOR EVERYDAY MOMENTUM <span>FICTIONAL STORE · MOCK ORDERS ONLY</span></div><header><a class="wordmark" href="${root}">NANO<span>↗</span><br>MOTION</a><nav aria-label="Main"><a href="${root}catalog/">Shop all</a><a href="${root}catalog/?category=Running">Running</a><a href="${root}#membership">The movement</a></nav><a class="bag" href="${root}cart/">Bag <span id="bag-count">0</span></a></header><main id="main" tabindex="-1"></main><footer><div class="wordmark">NANO↗<br>MOTION</div><p>Less friction. More motion.<br>Fictional activewear. Real measurement thinking.</p><button id="privacy" class="text-button">Measurement preferences</button><small>© 2026 Nano Motion demo. No payments. No shipping.</small></footer><div id="toast" role="status" aria-live="polite"></div><aside id="consent" aria-label="Measurement consent" hidden><p><strong>Your motion. Your choice.</strong><br>Allow optional OpenAI Ads measurement? Events blocked before consent are not replayed.</p><button id="accept">Allow measurement</button><button id="decline" class="secondary">Decline</button></aside><aside id="debug" hidden></aside></body></html>`;
  await mkdir('dist/' + route, { recursive: true });
  await writeFile('dist/' + (route ? route + '/' : '') + 'index.html', html);
}
await writeFile('dist/build.json', JSON.stringify({ products: catalog.products.length, pages: routes.length, catalogHash: createHash('sha256').update(JSON.stringify(catalog)).digest('hex') }));
console.log(`Built ${routes.length} subpath-safe pages and ${catalog.products.length} products.`);
