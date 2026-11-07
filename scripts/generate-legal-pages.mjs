import fs from 'node:fs/promises';
import {privacySections,termsSections,LEGAL_UPDATED} from '../src/data/legalContent.js';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const [route,title,sections] of [['privacy','Your family life stays yours.',privacySections],['terms','Simple terms for keeping families in sync.',termsSections]]){
 const file=`public/${route}/index.html`;let html=await fs.readFile(file,'utf8');
 const body=`<h1>${escape(title)}</h1><p>Last updated ${escape(LEGAL_UPDATED)}</p>`+sections.map(([heading,paragraphs])=>`<section><h2>${escape(heading)}</h2>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('')+'<p>Contact: <a href="mailto:support@fam-os.app">support@fam-os.app</a></p><p><a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en">EEA data-protection authorities</a> · <a href="https://ico.org.uk/make-a-complaint/">UK Information Commissioner</a></p>';
 if(!/<main\b[^>]*>[\s\S]*?<\/main>/.test(html))throw Error(`Legal template missing main: ${file}`);
 html=html.replace(/(<main\b[^>]*>)[\s\S]*?<\/main>/,`$1${body}</main>`).replaceAll('Developed by the team at Astronaut Digital · Part of Astronaut Ventures','© 2026 Astronaut Digital Inc.');
 await fs.writeFile(file,html);
}
console.log('Generated public legal pages from shared policy content.');
