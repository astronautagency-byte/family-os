import {it,expect} from 'vitest';
import {validateRoutine,nextRoutineDate} from '../routines';
import {handleAskFam} from '../index';
const draft={title:'School morning',steps:['Pack lunch','Check backpack'],cadence:'weekdays',start_date:'2026-09-18',assignee_name:'Alex'};
it('prepares a real recurring task with steps and an exact member match',()=>{
 const task=validateRoutine(draft,[{id:'alex',name:'Alex'}]);
 expect(task.recurring).toBe('routine:weekdays');expect(task.assigneeId).toBe('alex');expect(task.notes).toContain('2. Check backpack');
});
it('does not silently assign an unknown person or accept invalid schedules',()=>{
 expect(()=>validateRoutine(draft,[])).toThrow(/existing/);
 expect(()=>validateRoutine({...draft,assignee_name:'',cadence:'hourly'},[])).toThrow(/Choose/);
 expect(()=>validateRoutine({...draft,assignee_name:'',start_date:'2026-02-30'},[])).toThrow(/valid/);
 expect(()=>validateRoutine({...draft,assignee_name:'',steps:[]},[])).toThrow(/steps/);
});
it('advances weekdays, weekly and month-end dates and ignores ordinary tasks',()=>{
 expect(nextRoutineDate('2026-09-18','routine:weekdays')).toBe('2026-09-21');
 expect(nextRoutineDate('2026-09-18','routine:weekly')).toBe('2026-09-25');
 expect(nextRoutineDate('2026-01-31','routine:monthly')).toBe('2026-02-28');
 expect(nextRoutineDate('2026-09-18','')).toBe(null);
});
it('sends routine requests to proposal generation without executing a one-off task',async()=>{
 expect(await handleAskFam('Add a school morning routine',{state:{members:[]},api:{}})).toEqual({kind:'needsAi'});
});
