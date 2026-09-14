import React from 'react';
import {createRoot} from 'react-dom/client';
import * as icons from '../../src/components/icons';
import '../../src/index.css';
import '../../src/theme/component-consistency.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/page-layout.css';
const main = ['Home','CalendarDays','ListTodo','ShoppingCart','MessageCircle','Refrigerator','CookingPot','Users','Bell','ShieldCheck','Mail','MapPin','Bot','WalletCards','BookOpen','Sun','Heart','Star','Leaf','Clock'];
createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:1120,margin:'auto',color:'#18294B'}}><h1 style={{fontSize:28,marginBottom:8}}>FamOS · flat colour icons</h1><p style={{marginBottom:24}}>Core illustrations and compact controls · 16, 24, and 40 pixels</p><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12}}>{[...main,...Object.keys(icons).filter(n=>!main.includes(n))].map(name=>{const Icon=icons[name];return <article key={name} style={{background:'#FFF',border:'1px solid #E5EAF0',borderRadius:16,padding:16}}><div style={{display:'flex',alignItems:'center',gap:12,height:48}}>{[16,24,40].map(size=><Icon key={size} size={size}/>)}</div><p style={{fontSize:12,marginTop:8}}>{name}</p></article>})}</section><nav className="reference-mobile-nav" style={{position:'relative',marginTop:24}}>{['Home','CalendarDays','Plus','MessageCircle','MoreHorizontal'].map(name=>{const Icon=icons[name];return <button key={name} aria-label={name} className={name==='Plus'?'reference-add-button':''}><Icon size={24}/></button>})}</nav></main>);
