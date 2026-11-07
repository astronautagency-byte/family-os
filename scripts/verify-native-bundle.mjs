import {readFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const directory=resolve(process.argv[2]||'dist-ios');
const html=await readFile(join(directory,'index.html'),'utf8');
if(!html.includes('id="root"'))throw Error('Native entry point is missing the app root.');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1]);
if(!assets.some(a=>a.endsWith('.js')))throw Error('Native bundle has no JavaScript entry.');
for(const asset of assets)await access(join(directory,asset.slice(1)));
console.log(`Native entry and ${assets.length} referenced assets verified: ${directory}`);
