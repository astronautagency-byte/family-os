import { ROUTINE_CADENCES } from '../lib/famai/routines';
import './completion-screen.css';
export default function RoutineReviewFields({args,members,onChange}) {
  const change=(key,value)=>onChange({...args,[key]:value});
  return <div className="routine-review-fields">
    <label>Routine name<input value={args.title || ''} onChange={e=>change('title',e.target.value)}/></label>
    <label>Repeats<select value={args.cadence || ''} onChange={e=>change('cadence',e.target.value)}><option value="">Choose frequency</option>{ROUTINE_CADENCES.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <label>Starts<input type="date" value={args.start_date || ''} onChange={e=>change('start_date',e.target.value)}/></label>
    <label>Assigned to<select value={args.assignee_name || ''} onChange={e=>change('assignee_name',e.target.value)}><option value="">Unassigned</option>{members.map(member=><option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
    <label>Steps (one per line)<textarea rows={4} value={Array.isArray(args.steps)?args.steps.join('\n'):''} onChange={e=>change('steps',e.target.value.split('\n'))}/></label>
    <small>Saved in Tasks. Completing it creates the next scheduled occurrence. Reminders use your existing task notification settings.</small>
  </div>;
}
