import { mkdir, writeFile } from 'node:fs/promises';
const items = [
['NM-R01','aero-run-shell','Aero Run Shell','Running',14800,'#b5c3b4','shell','New'],
['NM-R02','pace-five-short','Pace Five Short','Running',6800,'#343d37','short','Best Seller'],
['NM-R03','stride-mesh-tee','Stride Mesh Tee','Running',5800,'#e8ff63','tee',''],
['NM-T01','form-training-tank','Form Training Tank','Training',4800,'#bca68b','tank',''],
['NM-T02','interval-track-pant','Interval Track Pant','Training',9800,'#454e48','pant',''],
['NM-O01','zero-gravity-jacket','Zero Gravity Jacket','Outerwear',19800,'#d7d3c6','shell','New'],
['NM-O02','recovery-fleece','Recovery Fleece','Outerwear',12800,'#866b58','tee',''],
['NM-A01','motion-cap','Motion Cap','Accessories',3800,'#465746','cap',''],
['NM-A02','everyday-tote','Everyday Tote','Accessories',5800,'#c3c1ac','bag',''],
['NM-Y01','flow-high-rise-legging','Flow High Rise Legging','Yoga',8800,'#6b747d','pant','Best Seller'],
['NM-Y02','align-studio-bra','Align Studio Bra','Yoga',5800,'#c89e8e','tank',''],
['NM-Y03','stillness-long-sleeve','Stillness Long Sleeve','Yoga',7800,'#e5dfcd','tee','']];
await mkdir('frontend/images',{recursive:true});
const shapes = {
shell:'M190 130L248 96Q280 118 312 96L370 130 421 302 366 322 339 230 345 449 215 449 221 230 194 322 139 302Z',
tee:'M188 143L244 114Q280 139 316 114L372 143 423 231 369 263 342 216 346 443 214 443 218 216 191 263 137 231Z',
tank:'M235 122L257 118Q280 162 303 118L325 122 340 441 220 441Z',
short:'M214 175H346L365 367 294 376 280 273 266 376 195 367Z',
pant:'M217 112H343L332 458 288 458 280 252 272 458 228 458Z',
cap:'M194 268Q190 157 280 157Q370 157 366 268L413 302Q291 328 184 291Z',
bag:'M212 201H348L368 430H192ZM243 202V158Q280 113 317 158V202H304V161Q280 133 256 161V202Z'};
for(const [sku,slug,name,category,price,color,shape,label] of items){
await writeFile(`frontend/images/${slug}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#eeeee7"/><stop offset="1" stop-color="#d7d9cf"/></linearGradient><linearGradient id="cloth" x2="1" y2=".2"><stop stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".8"/></linearGradient><filter id="shadow"><feDropShadow dx="8" dy="14" stdDeviation="12" flood-opacity=".16"/></filter></defs><rect width="560" height="600" fill="url(#bg)"/><ellipse cx="280" cy="504" rx="145" ry="15" fill="#17201b" opacity=".07"/><path d="${shapes[shape]}" fill="url(#cloth)" stroke="#17201b" stroke-opacity=".18" stroke-width="2" fill-rule="evenodd" filter="url(#shadow)"/><path d="M280 170V420" stroke="#fff" stroke-opacity=".18"/><path d="M303 190h16l-6-6m6 6-6 6" fill="none" stroke="#17201b" stroke-width="3" opacity=".6"/><text x="30" y="555" font-family="monospace" font-size="12" fill="#596259">NANO MOTION / ${sku}</text></svg>`);
}
await writeFile('catalog.json',JSON.stringify({version:1,defaultLocale:'en-US',defaultCurrency:'USD',locales:['en-US'],currencies:{USD:{minorUnitDigits:2}},products:items.map(([sku,slug,name,category,price,color,shape,label])=>({sku,slug,name,category,price,currency:'USD',prices:{USD:price},description:`Built for the rhythm between effort and ease. The ${name} pairs a considered silhouette with lightweight performance construction. Move freely, from the first mile to the last stretch.`,image:`assets/images/${slug}.svg`,sizes:category==='Accessories'?['One size']:['XS','S','M','L','XL'],label,color,material:'Technical recycled-fiber blend',features:['Unrestricted movement','Lightweight feel','Considered details']}))},null,2));
console.log('Created original SVG artwork and catalog for 12 products.');
