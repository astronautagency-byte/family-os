import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ALL_MARKETING_PAGES} from '../src/data/marketingPages.js';
const sitemap=await readFile('dist/sitemap.xml','utf8');
for(const p of ALL_MARKETING_PAGES){
 const html=await readFile(`dist/__public${p.path}.html`,'utf8');
 assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,p.path);
 assert.ok(html.includes(p.title.replaceAll('&','&amp;')),`${p.path}: missing initial HTML title`);
 assert.ok(html.includes(`href="https://fam-os.app${p.path}"`),`${p.path}: canonical`);
 assert.ok(html.includes('id="main-content"'),`${p.path}: empty app shell`);
 assert.ok(sitemap.includes(`https://fam-os.app${p.path}</loc>`));
 assert.ok(!html.includes('noindex'),`${p.path}: unexpected noindex`);
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
 assert.equal(schemas.length,1,`${p.path}: schema collision`);
 assert.ok(JSON.parse(schemas[0][1])['@graph'].some(x=>x['@type']==='BreadcrumbList'));
}
console.log(`Verified ${ALL_MARKETING_PAGES.length} static topic pages: H1, content, canonical, sitemap and structured data.`);
