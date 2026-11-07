import {useState} from 'react';
import {CalendarDays,CheckSquare,ShoppingCart,Gift,ChefHat,BookOpen,MessageCircle,Sparkles,Star} from './icons';

const examples={
 calendar:{title:'Family calendar',icon:CalendarDays,rows:[['9:00 AM','School drop-off'],['12:30 PM','Lunch together'],['4:00 PM','Soccer practice']]},
 today:{title:'Today',icon:CalendarDays,rows:[['9:00 AM','School drop-off'],['TASK','Pack school bags'],['DINNER','Tacos tonight']]},
 tasks:{title:'Tasks',icon:CheckSquare,rows:[['○','Pack school bags'],['○','Walk the dog'],['✓','Water the plants']]},
 shopping:{title:'Shopping',icon:ShoppingCart,rows:[['○','Apples'],['○','School supplies'],['✓','Milk']]},
 meals:{title:'Meal plan',icon:ChefHat,rows:[['BREAKFAST','Berry pancakes'],['LUNCH','Veggie wraps'],['DINNER','Chicken fajitas']]},
 recipes:{title:'Recipe Book',icon:BookOpen,rows:[['15 MIN','Family pancakes'],['30 MIN','Weeknight pasta'],['45 MIN','Sunday soup']]},
 kitchen:{title:'Kitchen Watch',icon:ShoppingCart,rows:[['FRIDGE','Fresh spinach'],['FRIDGE','Milk'],['PANTRY','Pasta']]},
 rewards:{title:'RewardBank',icon:Gift,rows:[['★ 5','Make your bed'],['★ 3','Feed the dog'],['★ 20','Movie night']]},
 chat:{title:'Family chat',icon:MessageCircle,rows:[['M','I’ll pick up the groceries'],['J','Thanks! See you at dinner'],['M','Sounds good ❤️']]},
 ai:{title:'Fam AI',icon:Sparkles,rows:[['YOU','Help plan our week'],['AI','Here are a few ideas'],['✓','Ready for your review']]},
 settings:{title:'Family settings',icon:Star,rows:[['✓','Your household'],['✓','Shared calendar'],['✓','Your preferences']]}
};
export default function MarketingProductPreview({kind='today'}){
 const data=examples[kind]||examples.today;const Icon=data.icon;
 const [checked,setChecked]=useState({});
 const [selected,setSelected]=useState(null);
 const isChecklist=kind==='tasks'||kind==='shopping';
 const selectRow=(i,tag)=>{
  if(isChecklist){setChecked(current=>({...current,[i]:!(current[i] ?? tag==='✓')}));return;}
  setSelected(current=>current===i?null:i);
 };
 return <div className="marketing-ui-preview" aria-label={`Interactive FamOS ${data.title} preview`}><div className="marketing-ui-header"><span><Icon size={18}/></span><strong>{data.title}</strong><span className="marketing-ui-dot"/></div><p className="marketing-ui-hint">{isChecklist?'Try checking an item':'Tap an item to explore'}</p><div className="marketing-ui-rows">{data.rows.map(([tag,label],i)=>{const active=isChecklist?(checked[i] ?? tag==='✓'):selected===i;return <button type="button" className={`marketing-ui-row${active?' is-selected':''}`} key={label} style={{'--row-index':i}} aria-pressed={active} onClick={()=>selectRow(i,tag)}><span className="marketing-ui-tag">{isChecklist?(active?'✓':'○'):tag}</span><strong>{label}</strong>{kind==='rewards'&&<Star size={15}/>}</button>})}</div>{!isChecklist&&selected!==null&&<p className="marketing-ui-detail" role="status">{kind==='calendar'||kind==='today'?`Your family can see ${data.rows[selected][1].toLowerCase()} on the calendar.`:kind==='rewards'?`${data.rows[selected][1]} is part of the family’s rewards plan.`:`Explore ${data.rows[selected][1].toLowerCase()} in FamOS.`}</p>}</div>;
}
