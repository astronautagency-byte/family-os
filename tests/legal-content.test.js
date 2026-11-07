import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
test('public legal pages contain one main and the approved prices literally',()=>{
 for(const page of ['privacy','terms']){const html=fs.readFileSync(`public/${page}/index.html`,'utf8');assert.equal((html.match(/<main\b/g)||[]).length,1);assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.ok(html.includes('Astronaut Digital Inc.'));assert.ok(html.includes('164 McCaffrey Road'));}
 const terms=fs.readFileSync('public/terms/index.html','utf8');for(const price of ['CAD $14.99/month','CAD $149/year','CAD $19.99/month','CAD $199/year','US$4.99/month','US$7.99/month','US$9.99/month'])assert.ok(terms.includes(price),price);
});
test('legal generation is repeatable without nested content or changed currency values',()=>{
 const files=['public/privacy/index.html','public/terms/index.html'];const before=files.map(p=>fs.readFileSync(p,'utf8'));execFileSync(process.execPath,['scripts/generate-legal-pages.mjs']);assert.deepEqual(files.map(p=>fs.readFileSync(p,'utf8')),before);
});
