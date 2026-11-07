import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {ALL_MARKETING_PAGES} from '../src/data/marketingPages.js';
import {publicMeta} from '../src/data/publicMeta.js';
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
 const paths=['/features',...ALL_MARKETING_PAGES.filter(p=>p.id!=='fam-ai').map(p=>p.path)];
 const withMeta=(html,meta)=>html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`)
   .replace(/(<meta name="description" content=")[^"]*/,`$1${escape(meta.description)}`)
   .replace(/(<link rel="canonical" href=")[^"]*/,`$1${escape(meta.canonical)}`)
   .replace(/(<meta property="og:title" content=")[^"]*/,`$1${escape(meta.title)}`)
   .replace(/(<meta property="og:description" content=")[^"]*/,`$1${escape(meta.description)}`)
   .replace(/(<meta property="og:url" content=")[^"]*/,`$1${escape(meta.canonical)}`)
   .replace(/(<meta property="og:image" content=")[^"]*/,`$1${escape(meta.image)}`)
   .replace(/(<meta property="og:image:secure_url" content=")[^"]*/,`$1${escape(meta.image)}`)
   .replace(/(<meta property="og:image:width" content=")[^"]*/,(_,prefix)=>`${prefix}1200`)
   .replace(/(<meta property="og:image:height" content=")[^"]*/,(_,prefix)=>`${prefix}630`)
   .replace(/(<meta property="og:image:alt" content=")[^"]*/,`$1${escape(meta.imageAlt)}`)
   .replace(/(<meta name="twitter:title" content=")[^"]*/,`$1${escape(meta.title)}`)
   .replace(/(<meta name="twitter:description" content=")[^"]*/,`$1${escape(meta.description)}`)
   .replace(/(<meta name="twitter:image" content=")[^"]*/,`$1${escape(meta.image)}`)
   .replace(/(<meta name="twitter:image:alt" content=")[^"]*/,`$1${escape(meta.imageAlt)}`);
 for(const path of paths){
  const meta=publicPageMeta(path);
  let html=withMeta(template,meta);
  html=html.replace('</head>',[...styles].map(css=>`<link rel="stylesheet" href="/${css}">`).join('')+'</head>');
  html=html.replace(/<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/,`<div id="root">${renderToString(React.createElement(Page,{path}))}</div>`);
  const dest=`dist/__public${path}.html`; await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,html);
 }
 // Public homepage gets its real content too; the app-domain shell remains separate.
 const {default:Landing}=await server.ssrLoadModule('/src/pages/Landing.jsx');
 const homeStyles=new Set();
 const collectHome=e=>{for(const c of e?.css||[])homeStyles.add(c);for(const k of e?.imports||[])collectHome(manifest[k]);};
 collectHome(manifest['src/pages/Landing.jsx']);
 let home=withMeta(await readFile('dist/index.html','utf8'),publicMeta('/')).replace(/<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/,`<div id="root">${renderToString(React.createElement(Landing))}</div>`);
 home=home.replace('</head>',[...homeStyles].map(css=>`<link rel="stylesheet" href="/${css}">`).join('')+'<noscript><style>.landing-page [style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript></head>');
 await writeFile('dist/__public/home.html',home);
 // Prerender the rest of the indexable public pages for crawlers and link previews.
 for(const [path,moduleName] of [['/fam-ai','FamAIMarketing'],['/pricing','Landing'],['/download','Download'],['/contact','Contact'],['/privacy','Privacy'],['/terms','Terms']]){
  const {default:Component}=await server.ssrLoadModule(`/src/pages/${moduleName}.jsx`); const meta=publicMeta(path);const css=new Set();
  const collect=e=>{for(const c of e?.css||[])css.add(c);for(const k of e?.imports||[])collect(manifest[k]);};collect(manifest[`src/pages/${moduleName}.jsx`]);
  let html=withMeta(template,meta).replace(/<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/,`<div id="root">${renderToString(React.createElement(Component))}</div>`);
  const schema=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:meta.title,description:meta.description,url:meta.canonical}).replaceAll('<','\\u003c');
  html=html.replace('</head>',[...css].map(c=>`<link rel="stylesheet" href="/${c}">`).join('')+`<script type="application/ld+json">${schema}</script>`+'</head>');await writeFile(`dist/__public${path}.html`,html);
 }
 // Unindexed helper entry: preserve app scripts, replace only generic marketing metadata.
 const helperMeta={title:'Family helpers | FamOS',description:'Open your private helper space for selected task lists, shopping lists and calendars. No account needed.',canonical:'https://home.fam-os.app/helpers',image:'https://home.fam-os.app/marketing/social/helpers-v1.jpg',imageAlt:'FamOS Family helpers: private passcode access to shared task lists, shopping lists and calendars'};
 let helperHtml=withMeta(template,helperMeta).replace('</head>','<meta name="robots" content="noindex,nofollow" /></head>');
 await writeFile('dist/__public/helpers.html',helperHtml);
 // Existing standalone legal documents take precedence over rewrites. Preserve their content and update their head metadata.
 for(const path of ['/privacy','/terms']){
  const file=`dist${path}/index.html`,meta=publicMeta(path);let html=withMeta(await readFile(file,'utf8'),meta);
  const tags=[['property','og:type','website'],['property','og:site_name','FamOS'],['property','og:url',meta.canonical],['property','og:title',meta.title],['property','og:description',meta.description],['property','og:image',meta.image],['property','og:image:secure_url',meta.image],['property','og:image:type','image/jpeg'],['property','og:image:width','1200'],['property','og:image:height','630'],['property','og:image:alt',meta.imageAlt],['name','twitter:card','summary_large_image'],['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:image',meta.image],['name','twitter:image:alt',meta.imageAlt]];
  html=html.replace('</head>',tags.map(([attr,key,value])=>`<meta ${attr}="${key}" content="${escape(value)}">`).join('')+'</head>');await writeFile(file,html);
 }
 // Avoid filesystem index precedence swallowing the host-specific homepage rewrite.
 await rename('dist/index.html','dist/app-shell.html');
 const sitemapPaths=['/','/pricing','/contact','/privacy','/terms','/download','/fam-ai',...paths];
 await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPaths.map(path=>`<url><loc>https://fam-os.app${path}</loc></url>`).join('')}</urlset>`);
 console.log(`Prerendered ${paths.length} public pages with unique metadata and visible content.`);
} finally {await server.close();}
