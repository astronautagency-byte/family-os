import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {ALL_MARKETING_PAGES} from '../src/data/marketingPages.js';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
try {
 const {default:Page,publicPageMeta}=await server.ssrLoadModule('/src/pages/MarketingFeatures.jsx');
 const template=(await readFile('dist/index.html','utf8')).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
 // Vite's CSS splitting places the public chunk CSS in a separate asset.
 const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
 const entry=manifest['src/pages/MarketingFeatures.jsx'];
 const styles=new Set();
 const visit=(e)=>{for(const c of e?.css||[])styles.add(c);for(const k of e?.imports||[])visit(manifest[k]);};
 visit(entry);
 const paths=['/features',...ALL_MARKETING_PAGES.map(p=>p.path)];
 for(const path of paths){
  const meta=publicPageMeta(path);
  let html=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`)
   .replace(/(<meta name="description" content=")[^"]*/,`$1${escape(meta.description)}`)
   .replace(/(<link rel="canonical" href=")[^"]*/,`$1${meta.canonical}`)
   .replace(/(<meta property="og:title" content=")[^"]*/,`$1${escape(meta.title)}`)
   .replace(/(<meta property="og:description" content=")[^"]*/,`$1${escape(meta.description)}`)
   .replace(/(<meta property="og:url" content=")[^"]*/,`$1${meta.canonical}`)
   .replace(/(<meta name="twitter:title" content=")[^"]*/,`$1${escape(meta.title)}`)
   .replace(/(<meta name="twitter:description" content=")[^"]*/,`$1${escape(meta.description)}`);
  html=html.replace('</head>',[...styles].map(css=>`<link rel="stylesheet" href="/${css}">`).join('')+'</head>');
  html=html.replace(/<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/,`<div id="root">${renderToString(React.createElement(Page,{path}))}</div>`);
  const dest=`dist/__public${path}.html`; await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,html);
 }
 // Public homepage gets its real content too; the app-domain shell remains separate.
 const {default:Landing}=await server.ssrLoadModule('/src/pages/Landing.jsx');
 const homeStyles=new Set();
 const collectHome=e=>{for(const c of e?.css||[])homeStyles.add(c);for(const k of e?.imports||[])collectHome(manifest[k]);};
 collectHome(manifest['src/pages/Landing.jsx']);
 let home=(await readFile('dist/index.html','utf8')).replace(/<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/,`<div id="root">${renderToString(React.createElement(Landing))}</div>`);
 home=home.replace('</head>',[...homeStyles].map(css=>`<link rel="stylesheet" href="/${css}">`).join('')+'<noscript><style>.landing-page [style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript></head>');
 await writeFile('dist/__public/home.html',home);
 // Avoid filesystem index precedence swallowing the host-specific homepage rewrite.
 await rename('dist/index.html','dist/app-shell.html');
 const sitemapPaths=['/','/pricing','/contact','/privacy','/terms',...paths];
 await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPaths.map(path=>`<url><loc>https://fam-os.app${path}</loc></url>`).join('')}</urlset>`);
 console.log(`Prerendered ${paths.length} public pages with unique metadata and visible content.`);
} finally {await server.close();}
