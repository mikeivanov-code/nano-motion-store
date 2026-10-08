import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const values = new Map([['nm-consent','yes']]);
const pixels = []; const requests = [];
let fail = false;
const context = vm.createContext({
  console, crypto: webcrypto, URLSearchParams, Date, JSON, Set, Math, encodeURIComponent,
  location:{search:'',origin:'https://example.test',pathname:'/nano-motion-store/products/aero-run-shell/'},
  document:{cookie:'__oppref=UNCHANGED; __obref=BROWSER',querySelector:()=>null},
  window:{oaiq:(...args)=>pixels.push(args),addEventListener:()=>{}},
  localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
  sessionStorage:{getItem:()=>null,setItem:()=>{}},
  setInterval:()=>{}, AbortSignal,
  fetch:async (url, options)=>{requests.push({url,body:JSON.parse(options.body)});if(fail)throw new Error('mock timeout');return {ok:true,json:async()=>({server_status:'validated',mode:'validate_only'})};}
});
const module = new vm.SourceTextModule(await readFile('frontend/measurement.js','utf8'),{context});
const config = new vm.SourceTextModule("export const API_URL='https://mock-api.test';",{context});
await module.link(()=>config); await module.evaluate();
const m=module.namespace;
const items=[{sku:'NM-R01',size:'M',quantity:2}];
const catalog=JSON.parse(await readFile('catalog.json','utf8')).products;
const event=m.envelope('items_added',items); const data=m.dataFor(items,catalog);
assert.equal(data.amount,29600); assert.equal(data.contents[0].quantity,2);
assert.equal(event.oppref,'UNCHANGED'); assert.equal(event.obref,'BROWSER');
m.measure(event,data); await new Promise(r=>setImmediate(r));
assert.equal(pixels[0][3].event_id,event.event_id);
assert.equal(requests[0].body.event_id,event.event_id);
assert.equal(requests[0].body.name,pixels[0][1]);
assert.equal(requests[0].body.timestamp_ms,event.timestamp_ms);
fail=true;const retry=m.envelope('checkout_started',items);m.measure(retry,data);await new Promise(r=>setImmediate(r));
const stored=JSON.parse(values.get('nm-outbox'));
assert.equal(stored[0].event.event_id,retry.event_id);
assert.equal(stored[0].event.timestamp_ms,retry.timestamp_ms);
assert.equal(stored[0].attempts,1);
m.setConsent(false);assert.deepEqual(JSON.parse(values.get('nm-outbox')),[]);
const blocked=m.envelope('lead_created');m.measure(blocked,{type:'customer_action'});
assert.equal(pixels.filter(p=>p[0]==='measure').length,2);
assert.equal(blocked.obref,undefined);
m.setConsent(true);assert.equal(pixels.filter(p=>p[0]==='measure').length,2);
console.log('Measurement checks passed: UUID parity, commerce data, preserved retry envelope, consent revocation, no replay.');
