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
// Every indexable public route must serve page-specific metadata without JavaScript.
const {publicPaths,publicMeta}=await import('../src/data/publicMeta.js');
const seenTitles=new Set(),seenDescriptions=new Set(),seenImages=new Set();
for(const path of publicPaths){
 const meta=publicMeta(path),file=['/privacy','/terms'].includes(path)?`dist${path}/index.html`:`dist/__public${path==='/'?'/home':path}.html`,html=await readFile(file,'utf8');
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 assert.ok(html.includes(`<title>${esc(meta.title)}</title>`),`${path}: title`);
 for(const [key,value,attr] of [['description',meta.description,'name'],['og:title',meta.title,'property'],['og:description',meta.description,'property'],['og:url',meta.canonical,'property'],['og:image',meta.image,'property'],['og:image:secure_url',meta.image,'property'],['og:image:alt',meta.imageAlt,'property'],['twitter:title',meta.title,'name'],['twitter:description',meta.description,'name'],['twitter:image',meta.image,'name'],['twitter:image:alt',meta.imageAlt,'name']]) assert.ok(html.includes(`<meta ${attr}="${key}" content="${esc(value)}"`),`${path}: ${key}`);
 assert.ok(html.includes(`<link rel="canonical" href="${meta.canonical}"`),`${path}: canonical`);
 assert.ok(sitemap.includes(`${meta.canonical}</loc>`),`${path}: sitemap`);
 assert.ok(!seenTitles.has(meta.title) && !seenDescriptions.has(meta.description) && !seenImages.has(meta.image),`${path}: duplicate metadata`);seenTitles.add(meta.title);seenDescriptions.add(meta.description);seenImages.add(meta.image);
 const image=await readFile(`dist${new URL(meta.image).pathname}`);const sharp=(await import('sharp')).default;const info=await sharp(image).metadata();assert.equal(info.width,1200);assert.equal(info.height,630);
 for(const img of html.match(/<img\b[^>]*>/g)||[])assert.match(img,/\balt="[^"]*"/,`${path}: image missing alt attribute`);
}
console.log(`Verified metadata, social images and image alt attributes for ${publicPaths.length} public routes.`);
