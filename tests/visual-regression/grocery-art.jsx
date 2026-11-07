import React from 'react';
import { createRoot } from 'react-dom/client';
import GroceryIllustration from '../../src/components/GroceryIllustration';
import { GROCERY_ICONS } from '../../src/data/groceryIcons';

createRoot(document.getElementById('root')).render(<main style={{fontFamily:'system-ui',padding:24,background:'#fffdf7'}}><h1>FamOS item illustrations</h1><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:16}}>{Object.keys(GROCERY_ICONS).map(icon=><div key={icon} style={{display:'grid',justifyItems:'center',gap:8,padding:12,background:'#fff',borderRadius:12}}><GroceryIllustration icon={icon} size={56}/><span>{icon}</span></div>)}</div></main>);
