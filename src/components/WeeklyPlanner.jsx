import { useMemo, useState } from 'react';
import { CalendarDays, CheckSquare, ChefHat, ChevronRight, Users, X } from './icons';
import { expandRecurringEvents } from '../lib/eventRecurrence';
import { eventDateLocal } from '../lib/dates';
import './weekly-planner.css';

const localDay = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function summarizeWeek({ events = [], tasks = [], meals = [], now = new Date() }) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const first = localDay(start), after = localDay(end);
  const plannedEvents = expandRecurringEvents(events, start, new Date(end.getTime()-1))
    .filter(event => event.start && eventDateLocal(event.start) >= first && eventDateLocal(event.start) < after)
    .sort((a,b) => a.start.localeCompare(b.start));
  const openTasks = tasks.filter(task => !task.done);
  const dinners = meals.filter(meal => meal.title && meal.slot === 'dinner' && meal.date >= first && meal.date < after);
  return { plannedEvents, openTasks, dinners };
}

export default function WeeklyPlanner({ events, tasks, meals, members, features, onNavigate, onInvite, addTask, firstGoal, onClearGoal }) {
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const summary = useMemo(() => summarizeWeek({events,tasks,meals}), [events,tasks,meals]);
  const firstGoalLabel = {calendar:'Add your first plan', meals:'Plan your first meal', tasks:'Add your first task'}[firstGoal];
  const hasActivity = summary.plannedEvents.length || summary.openTasks.length || summary.dinners.length;
  const submitTask = async event => {
    event.preventDefault();
    if (!taskTitle.trim() || saving) return;
    setSaving(true); setError('');
    try { await addTask({title:taskTitle.trim(), assigneeIds:assignee ? [assignee] : []}); setTaskTitle(''); setAssignee(''); }
    catch { setError('Could not save this task. Your text is still here; please try again.'); }
    finally { setSaving(false); }
  };
  return <section className="weekly-planner" aria-labelledby="weekly-planner-heading">
    <div className="weekly-planner-head"><div><h2 id="weekly-planner-heading">Plan your week</h2><p>The next seven days, together.</p></div><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Review week'} <ChevronRight size={16}/></button></div>
    {firstGoalLabel && !open && <div className="weekly-first-goal"><span>Start with what matters to you</span><button type="button" onClick={() => {onClearGoal(); onNavigate(firstGoal);}}>{firstGoalLabel} <ChevronRight size={15}/></button><button type="button" aria-label="Dismiss first goal" onClick={onClearGoal}><X size={17}/></button></div>}
    {open && <div className="weekly-planner-body">
      {features.calendar !== false && <div className="weekly-planner-row"><CalendarDays size={20}/><div><strong>{summary.plannedEvents.length} upcoming {summary.plannedEvents.length === 1 ? 'event' : 'events'}</strong><span>{summary.plannedEvents[0]?.title || 'No events in the next seven days'}</span></div><button type="button" onClick={() => onNavigate('calendar')}>Calendar</button></div>}
      {features.meals !== false && <div className="weekly-planner-row"><ChefHat size={20}/><div><strong>{summary.dinners.length} {summary.dinners.length === 1 ? 'dinner' : 'dinners'} planned</strong><span>{summary.dinners[0]?.title || 'Add a dinner when you’re ready'}</span></div><button type="button" onClick={() => onNavigate('meals')}>Meals</button></div>}
      {features.tasks !== false && <><div className="weekly-planner-row"><CheckSquare size={20}/><div><strong>{summary.openTasks.length} open {summary.openTasks.length === 1 ? 'task' : 'tasks'}</strong><span>{summary.openTasks[0]?.title || 'Add something your family can share'}</span></div><button type="button" onClick={() => onNavigate('tasks')}>Tasks</button></div>
      <form className="weekly-add-task" onSubmit={submitTask}><label htmlFor="weekly-task">Add a task</label><input id="weekly-task" value={taskTitle} maxLength={160} placeholder="What needs doing?" onChange={event=>setTaskTitle(event.target.value)}/><select aria-label="Assign task to" value={assignee} onChange={event=>setAssignee(event.target.value)}><option value="">Anyone</option>{members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select><button type="submit" disabled={saving || !taskTitle.trim()}>{saving?'Saving…':'Add task'}</button>{error && <p role="alert">{error}</p>}</form></>}
      {members.length < 2 && Boolean(hasActivity) && <div className="weekly-invite"><Users size={20}/><div><strong>Make it a shared plan</strong><span>Invite someone to help with your week.</span></div><button type="button" onClick={onInvite}>Invite</button></div>}
    </div>}
  </section>;
}
