import React from 'react';
import {createRoot} from 'react-dom/client';
import * as icons from '../../src/components/icons';
import '../../src/index.css';
import '../../src/theme/component-consistency.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/page-layout.css';
const main = ['Home','CalendarDays','ListTodo','ShoppingCart','MessageCircle','Refrigerator','CookingPot','Users','Bell','ShieldCheck','Mail','MapPin','Bot','WalletCards','BookOpen','Sun','Heart','Star','Leaf','Clock'];
const approved=['Home','CalendarDays','ListTodo','ShoppingCart','Refrigerator','Utensils','MessageCircle','Users','Bot','Settings','Bell','WalletCards'];
function Preview(){
 const [dark,setDark]=React.useState(false);
 const background=dark?'#18283E':'#FFFFFF';
 const foreground=dark?'#F8FAFC':'#18283E';
 return <main style={{padding:24,maxWidth:1120,margin:'auto',color:foreground,background,minHeight:'100vh'}}>
  <h1 style={{fontSize:28,marginBottom:8}}>FamOS · Colour Outline</h1>
  <p>Flat SVGs · rounded strokes · five shared colours</p>
  <button onClick={()=>setDark(!dark)} aria-pressed={dark} style={{margin:'16px 0',padding:'10px 16px',border:'1px solid currentColor',borderRadius:8}}>Dark background</button>
  <section aria-label="Approved core icons" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:24,margin:'24px 0 40px'}}>{approved.map(name=>{const Icon=icons[name];return <article key={name} style={{textAlign:'center'}}><Icon size={56}/><p style={{marginTop:12,fontSize:13}}>{name}</p></article>})}</section>
  <h2>Complete UI library · 16, 24 and 40 pixels</h2>
  <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12,marginTop:20}}>{[...main,...Object.keys(icons).filter(n=>!main.includes(n))].map(name=>{const Icon=icons[name];return <article key={name} style={{border:`1px solid ${dark?'#34465F':'#E5EAF0'}`,borderRadius:12,padding:16}}><div style={{display:'flex',alignItems:'center',gap:12,height:48}}>{[16,24,40].map(size=><Icon key={size} size={size}/>)}</div><p style={{fontSize:12,marginTop:8}}>{name}</p></article>})}</section>
 </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
