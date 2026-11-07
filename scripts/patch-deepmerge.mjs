// Temporary build-only mitigation for GHSA-gcqx-w48m-w2h4.
// Remove after upstream publishes a verified fix. Fail closed on source drift.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('deepmerge/package.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'),'utf8'));
if (pkg.version !== '4.3.1') throw new Error('Review deepmerge security patch for new upstream version');
for (const file of ['index.js','dist/cjs.js','dist/umd.js']) {
 const target = path.join(root,file);
 let text = fs.readFileSync(target,'utf8');
 if (text.includes('FamOS prototype-key guard')) continue;
 const keys = 'return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))';
 if (!text.includes(keys)) throw new Error(`Unexpected deepmerge source: ${file}`);
 text = text.replace(keys, `// FamOS prototype-key guard: filter both target and source before assignment.\n\treturn Object.keys(target).concat(getEnumerableOwnPropertySymbols(target)).filter(function(key) {\n\t\treturn key !== '__proto__' && key !== 'constructor' && key !== 'prototype';\n\t})`);
 fs.writeFileSync(target,text);
}
console.log('Applied build-only deepmerge prototype-key guard');
