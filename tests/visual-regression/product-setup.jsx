import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import QuantityUnitFields from '../../src/components/QuantityUnitFields';
import StapleStarter from '../../src/components/StapleStarter';
import GroceryIllustration from '../../src/components/GroceryIllustration';
import {mergeStarterStaples} from '../../src/data/starterStaples';
import '../../src/index.css';
import '../../src/theme/component-consistency.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/page-layout.css';
import '../../src/theme/product-feedback.css';
function Preview(){const [dark,setDark]=useState(false),[items,setItems]=useState([]),[draft,setDraft]=useState({quantity:1,unit:'kg'});useEffect(()=>{document.documentElement.dataset.famosTheme=dark?'dark':'light';},[dark]);return <main className={`app-shell ${dark?'theme-dark':''}`} style={{minHeight:'100vh',padding:24,background:'var(--color-canvas)',color:'var(--color-ink)'}}><div style={{maxWidth:390,margin:'auto'}}><h1 style={{fontSize:24}}>Household setup preview</h1><p className="setup-help">Sample data only · no account changes</p><button className="setup-starter-trigger" onClick={()=>setDark(!dark)}>{dark?'Switch to light':'Switch to dark'}</button><QuantityUnitFields {...draft} onChange={patch=>setDraft(d=>({...d,...patch}))}/><StapleStarter onAdd={additions=>setItems(current=>mergeStarterStaples(current,additions))}/><div className="setup-staple-options">{items.map(item=><label key={item.id}><GroceryIllustration name={item.name}/><span>{item.name}<small>{item.quantity} {item.unit}</small></span></label>)}</div></div></main>}
createRoot(document.getElementById('root')).render(<Preview/>);
