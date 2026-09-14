import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import CompletionScreen from '../../src/components/CompletionScreen';
import ReferenceAgenda from '../../src/components/ReferenceAgenda';
import PageHeader from '../../src/components/PageHeader';
import '../../src/index.css';
import '../../src/theme/component-consistency.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/page-layout.css';
import '../../src/theme/reference-screens.css';
const kind = new URLSearchParams(location.search).get('kind');
const events = ['School drop-off','Team meeting','Lunch with Sarah','Soccer practice','Dance class','Family dinner','Take out the garbage'].map((title,i)=>({id:String(i),title,start:`2026-09-16T${['08:00','10:00','12:00','15:15','17:00','18:00','20:00'][i]}:00`,eventType:['school','work','social','family'][i%4],location:i===3?'Leo':i===5?'Chicken Tacos':''}));
function Fixture(){const [open,setOpen]=useState(true);return kind==='calendar'?<div className="app-shell"><main className="app-content"><PageHeader title="September 2026" onAdd={()=>{}} addLabel="Add event"/><div style={{padding:'0 16px'}}><div className="reference-segments"><button>Month</button><button aria-pressed="true">Week</button><button>Day</button></div><div className="apple-date-strip">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=><button key={day} className={i===2?'selected':''}><small>{day}</small><strong>{14+i}</strong></button>)}</div><ReferenceAgenda events={events} onSelect={()=>{}} colorFor={event=>['#008aff','#447ad6','#de8a45','#8956ea','#cd5bd7','#ff9600','#00a974'][Number(event.id)]}/></div></main></div>:<>{open?<CompletionScreen kind={kind} onClose={()=>setOpen(false)}/>:<button onClick={()=>setOpen(true)}>Replay celebration</button>}</>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
