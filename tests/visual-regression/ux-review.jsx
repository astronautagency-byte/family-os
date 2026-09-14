import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import PageHeader from '../../src/components/PageHeader';
import ReferenceAgenda from '../../src/components/ReferenceAgenda';
import {Modal,TextField,PrimaryButton,EmptyState,Checkbox} from '../../src/components/ui';
import {ListTodo} from '../../src/components/icons';
import '../../src/index.css';
import '../../src/theme/component-consistency.css';
import '../../src/theme/illustrated-ui.css';
import '../../src/theme/page-layout.css';
import '../../src/theme/reference-screens.css';
import '../../src/theme/product-feedback.css';
import '../../src/theme/ux-refinements.css';
function Preview(){
 const [dark,setDark]=useState(false),[editor,setEditor]=useState(null),[title,setTitle]=useState(''),[tasks,setTasks]=useState([]),[events,setEvents]=useState([]);
 useEffect(()=>{document.documentElement.dataset.famosTheme=dark?'dark':'light';return()=>delete document.documentElement.dataset.famosTheme;},[dark]);
 return <main className={`app-shell ${dark?'theme-dark':''}`} style={{display:'block',minHeight:'100vh',background:'var(--color-canvas)',color:'var(--color-ink)'}}>
 <div className="app-content" style={{margin:0,maxWidth:720,paddingBottom:40,marginInline:'auto'}}>
 <p style={{padding:16,fontSize:13}}>UX component preview · local sample data only</p>
 <button className="empty-state-action" style={{marginLeft:16}} onClick={()=>setDark(!dark)}>{dark?'Light mode':'Dark mode'}</button>
 <div className="reference-tasks"><PageHeader title="Tasks" onAdd={()=>setEditor('task')} addLabel="Add task"/><div style={{padding:16}}>
 {tasks.length?tasks.map((task,index)=><div className="task-board-row" key={index}><Checkbox checked={task.done} label={`Complete ${task.title}`} onChange={()=>setTasks(items=>items.map((t,i)=>i===index?{...t,done:!t.done}:t))}/><span className="task-row-copy"><strong>{task.title}</strong><small>Today · Family</small></span></div>):<EmptyState icon={<ListTodo size={40}/>} title="You’re all caught up" subtitle="Add a task, choose a due date, and share the responsibility." actionLabel="Add your first task" onAction={()=>setEditor('task')}/>}
 </div></div>
 <PageHeader title="Today's calendar"/><div style={{padding:16}}><ReferenceAgenda events={events} colorFor={()=>'#20B4C9'} onSelect={()=>{}} onAdd={()=>setEditor('event')}/></div>
 <Modal open={!!editor} onClose={()=>setEditor(null)} title={editor==='event'?'Add sample event':'Add sample task'}><TextField label={editor==='event'?'Event':'Task'} value={title} onChange={e=>setTitle(e.target.value)}/><PrimaryButton disabled={!title.trim()} onClick={()=>{if(editor==='event')setEvents(items=>[...items,{id:items.length+1,title:title.trim(),start:new Date().toISOString(),allDay:true}]);else setTasks(items=>[...items,{title:title.trim(),done:false}]);setTitle('');setEditor(null);}}>{editor==='event'?'Add event':'Add task'}</PrimaryButton></Modal>
 </div></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
