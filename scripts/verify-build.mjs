import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const catalog=JSON.parse(await readFile('catalog.json','utf8'));
assert.equal(new Set(catalog.products.map(p=>p.sku)).size,catalog.products.length);
assert.equal(new Set(catalog.products.map(p=>p.slug)).size,catalog.products.length);
for(const p of catalog.products){assert(Number.isInteger(p.price)&&p.price>0);assert(p.sizes.length);assert.equal(p.prices.USD,p.price);}
const routes=['','catalog','cart','checkout','confirmation',...catalog.products.map(p=>'products/'+p.slug)];
for(const route of routes){
  const file=path.join('dist',route,'index.html');const html=await readFile(file,'utf8');
  assert(html.includes('assets/pixel.js'));assert(html.includes('id="main"'));
  assert(html.indexOf('assets/pixel.js')<html.indexOf('name="viewport"'));
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const target=match[1];if(target.startsWith('#')||/^https?:/.test(target))continue;
    const resolved=path.resolve(path.dirname(file),target.split(/[?#]/)[0]);
    assert(resolved.startsWith(path.resolve('dist')));
    await access(resolved);
  }
}
for(const p of catalog.products)await access(path.join('dist',p.image));
console.log(`Verified ${routes.length} real pages, all relative assets, ${catalog.products.length} product images, unique SKUs/slugs, and minor-unit prices.`);
