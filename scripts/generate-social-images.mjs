import sharp from 'sharp';import {readFile,mkdir} from 'node:fs/promises';import {publicPaths,publicMeta} from '../src/data/publicMeta.js';
const copy={
 '/fam-ai':['Meet Mia.','A little more headspace.','Your personal AI home assistant'],
 '/':['A little less planning.','A lot more family.','Your family, in sync'],
 '/features':['The family stuff,','all in one place.','Explore FamOS'],
 '/features/voice':['Say it.','Consider it done.','Review before adding'],
 '/features/calendar':['One calendar.','The whole family.','Plans everyone can see'],
 '/features/location':['A little closer,','wherever you are.','Share on your terms'],
 '/features/today':['The day ahead,','all together.','Your family at a glance'],
 '/features/meals':['Less dinner stress.','More family time.','Make a meal plan'],
 '/features/shopping':['One list.','Every helping hand.','Shopping, together'],
 '/features/tasks':['Little tasks.','Big team effort.','Chores with a clear owner'],
 '/features/recipes':['Keep the recipe.','Make the memory.','A home for favourites'],
 '/features/kitchen':['See what you have.','Use what you love.','Your kitchen, organized'],
 '/features/chat':['Keep everyone','in the loop.','Family chat'],
 '/features/fam-ai':['A little help','for your big week.','Meet Fam AI'],
 '/features/rewards':['Little chores.','Big celebrations.','Celebrate their effort'],
 '/features/family':['Make FamOS','feel like yours.','Your family, your setup'],
 '/features/tablet':['The family plan,','right at home.','Make room for what matters'],
 '/calendar-sync':['Schedules together.','Less back-and-forth.','Connect your calendars'],
 '/calendar-photo-import':['Paper schedule?','Make it a plan.','Review events before saving'],
 '/compare':['Find your','family’s fit.','Compare family organizers'],
 '/compare/cozi':['Find the organizer','that fits your family.','FamOS and Cozi'],
 '/compare/familywall':['Find the organizer','that fits your family.','FamOS and FamilyWall'],
 '/compare/skylight':['Find the organizer','that fits your family.','FamOS and Skylight'],
 '/pricing':['Start small.','Grow together.','Find your FamOS plan'],
 '/download':['Your family.','On every screen.','Open FamOS on your device'],
 '/contact':['Need a hand?','We’re here.','Contact FamOS support'],
 '/privacy':['Your family’s','privacy matters.','Read our privacy policy'],
 '/terms':['The details,','made clear.','Read the FamOS terms'],
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await mkdir('public/marketing/social',{recursive:true});
const logo=await sharp('public/brand/famos-logo.png').resize(100,100,{fit:'contain',background:'#fbf6ed'}).flatten({background:'#fbf6ed'}).png().toBuffer();
for(const path of publicPaths){
 const m=publicMeta(path),name=path==='/'?'home':path.slice(1).replaceAll('/','-'),content=copy[path];if(!content)throw Error(`Missing social copy: ${path}`);
 if(path==='/fam-ai'){const info=await sharp('public/marketing/social/fam-ai-v3.jpg').metadata();if(info.width!==1200||info.height!==630)throw Error('FamAI social image must be 1200x630');continue;}
 const food=['meals','recipes','shopping','kitchen'].some(x=>path.includes(x));const photo=await sharp(`public/marketing/lifestyle/${food?'cooking':'family'}-1536.webp`).resize(600,630,{fit:'cover',position:'centre'}).jpeg().toBuffer();
 const [line1,line2,kicker]=content;
 const svg=`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="600" height="630" fill="#fbf6ed"/><circle cx="448" cy="80" r="9" fill="#f6ba48"/><rect x="492" y="112" width="13" height="27" rx="5" fill="#80bca6" transform="rotate(32 498 125)"/><path d="M535 63 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2z" fill="#f08c75"/><circle cx="484" cy="163" r="5" fill="#ea6b50"/><rect x="41" y="188" width="8" height="66" rx="4" fill="#f26547"/><text x="66" y="220" fill="#c64d34" font-family="Arial,sans-serif" font-size="20" font-weight="bold" letter-spacing="2">${esc(m.name.toUpperCase())}</text><text x="56" y="312" fill="#18382e" font-family="Arial,sans-serif" font-size="53" font-weight="bold">${esc(line1)}</text><text x="56" y="381" fill="#18382e" font-family="Arial,sans-serif" font-size="53" font-weight="bold">${esc(line2)}</text><text x="58" y="454" fill="#506b5f" font-family="Arial,sans-serif" font-size="23" font-weight="bold">${esc(kicker)}</text><path d="M63 527 C82 509 98 545 118 525 S152 512 167 527" fill="none" stroke="#f36b4c" stroke-width="5" stroke-linecap="round"/><circle cx="217" cy="539" r="7" fill="#facb52"/><rect x="255" y="523" width="11" height="22" rx="4" fill="#72b89e" transform="rotate(30 260 534)"/><path d="M303 531 l8 -12 8 12 -8 12z" fill="#f49a85"/><circle cx="348" cy="525" r="5" fill="#ed7054"/><text x="58" y="586" fill="#597268" font-family="Arial,sans-serif" font-size="20" font-weight="bold">fam-os.app</text></svg>`;
 const layers=[{input:photo,left:600,top:0},{input:Buffer.from(svg),left:0,top:0},{input:logo,left:54,top:48}];
 if(m.capture){const file=`public/marketing/product-captures/${m.capture}${['voice','location'].includes(m.capture)?'-social.png':'-640.webp'}`;await readFile(file);const frame=Buffer.from(`<svg width="430" height="288" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="430" height="288" rx="20" fill="#fff" stroke="#e0eae4" stroke-width="3"/></svg>`);const input=sharp(file);if(m.capture==='voice')input.extract({left:30,top:145,width:690,height:500});const screen=await input.resize(408,266,{fit:'contain',background:'#fff'}).flatten({background:'#fff'}).png().toBuffer();layers.push({input:frame,left:735,top:307},{input:screen,left:746,top:318});}
 await sharp({create:{width:1200,height:630,channels:3,background:'#fff'}}).composite(layers).jpeg({quality:86,mozjpeg:true}).toFile(`public/marketing/social/${name}-v2.jpg`);
}
console.log(`Generated ${publicPaths.length} social previews.`);

// Helper invitations have their own preview, without household data or lifestyle photos.
const helperSvg=`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#102c25"/><circle cx="1060" cy="70" r="360" fill="#1b4539"/><text x="72" y="98" font-family="Arial" font-size="25" fill="#b5d8c5" letter-spacing="4">FAMOS · FAMILY HELPERS</text><text x="72" y="242" font-family="Arial" font-weight="bold" font-size="66" fill="#fff">A helping hand.</text><text x="72" y="325" font-family="Arial" font-weight="bold" font-size="66" fill="#fff">A shared plan.</text><text x="76" y="405" font-family="Arial" font-size="25" fill="#c6ded1">Your private space for the lists</text><text x="76" y="446" font-family="Arial" font-size="25" fill="#c6ded1">and calendars the family shares.</text><rect x="76" y="506" width="280" height="52" rx="26" fill="#c6e9d2"/><text x="104" y="540" font-family="Arial" font-size="21" fill="#102c25">Private passcode access</text><rect x="772" y="155" width="350" height="345" rx="28" fill="#f7fbf8"/><text x="806" y="210" font-family="Arial" font-weight="bold" font-size="25" fill="#183c31">Shared with you</text><g font-family="Arial" font-size="22" fill="#315a48"><text x="854" y="290">Task lists</text><text x="854" y="365">Shopping lists</text><text x="854" y="440">Calendars</text></g><g fill="none" stroke="#3f7e62" stroke-width="4"><rect x="806" y="267" width="26" height="26" rx="6"/><path d="m811 280 6 6 12-15"/><rect x="806" y="342" width="26" height="26" rx="6"/><path d="m811 355 6 6 12-15"/><rect x="806" y="417" width="26" height="26" rx="6"/></g></svg>`;
await sharp(Buffer.from(helperSvg)).jpeg({quality:92}).toFile('public/marketing/social/helpers-v1.jpg');
