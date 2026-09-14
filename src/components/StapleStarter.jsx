import {useState} from 'react';
import {STAPLE_PACKS} from '../data/starterStaples';
import {categorizeGroceryItem} from '../lib/groceryCategories';
import GroceryIllustration from './GroceryIllustration';
import {Modal,PrimaryButton} from './ui';
export default function StapleStarter({onAdd}) {
  const [open,setOpen]=useState(false),[pack,setPack]=useState('Essentials'),[selected,setSelected]=useState([]);
  return <><button className="setup-starter-trigger" onClick={()=>{setSelected([]);setOpen(true);}}>Choose starter staples</button>
    <Modal open={open} onClose={()=>setOpen(false)} title="Start with your usual essentials">
      <p className="setup-help">Choose what your household buys. These are suggestions—not dietary recommendations. Edit quantities and units in your saved staples.</p>
      <label className="setup-pack-label">Starter pack<select value={pack} onChange={e=>setPack(e.target.value)}>{Object.keys(STAPLE_PACKS).map(name=><option key={name}>{name}</option>)}</select></label>
      <div className="setup-staple-options">{STAPLE_PACKS[pack].map(([name,quantity,unit])=><label key={name}><input type="checkbox" checked={selected.some(item=>item.name===name)} onChange={e=>setSelected(current=>e.target.checked?[...current,{name,quantity,unit,category:categorizeGroceryItem(name),id:`starter-${name.toLowerCase().replaceAll(' ','-')}`}]:current.filter(item=>item.name!==name))}/><GroceryIllustration name={name}/><span>{name}<small>{quantity} {unit}</small></span></label>)}</div>
      <PrimaryButton disabled={!selected.length} onClick={()=>{onAdd(selected);setOpen(false);}}>Save {selected.length || ''} staples</PrimaryButton>
    </Modal></>;
}
