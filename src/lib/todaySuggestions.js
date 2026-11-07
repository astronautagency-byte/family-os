/** Small, deterministic prompts based on the household's existing plans. */
export function todaySuggestions({tasks=[],meals=[],today,features={},hidden=[]}) {
 const due=features.tasks!==false&&!hidden.includes('tasks')?tasks.filter(t=>!t.done && typeof t.due==='string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) && t.due<=today).sort((a,b)=>a.due.localeCompare(b.due)):[];
 if(due.length){const overdue=due.filter(t=>t.due<today).length;return {page:'tasks',title:overdue?`${overdue} overdue task${overdue===1?'':'s'} to review`:`${due.length} task${due.length===1?'':'s'} due today`,detail:due[0].title,action:'Review tasks'};}
 if(features.meals!==false&&!hidden.includes('meals')&&!meals.some(m=>m.date===today&&m.slot==='dinner'))return {page:'meals',title:'Make a plan for dinner',detail:'Choose something for tonight when you’re ready.',action:'Plan dinner'};
 return null;
}
