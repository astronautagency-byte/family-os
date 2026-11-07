import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeeklyPlanner, { summarizeWeek } from './WeeklyPlanner';

afterEach(cleanup);
it('summarizes only the next seven days while keeping open tasks', () => {
  const result = summarizeWeek({ now:new Date(2026,10,7,12), events:[{id:'a',title:'Practice',start:'2026-11-08T12:00:00',end:'2026-11-08T13:00:00'},{id:'b',title:'Later',start:'2026-11-15T12:00:00',end:'2026-11-15T13:00:00'}], tasks:[{title:'Open',done:false},{title:'Done',done:true}], meals:[{date:'2026-11-09',slot:'dinner',title:'Pasta'},{date:'2026-11-15',slot:'dinner',title:'Later'}] });
  expect(result.plannedEvents.map(event=>event.title)).toEqual(['Practice']);
  expect(result.openTasks.map(task=>task.title)).toEqual(['Open']);
  expect(result.dinners.map(meal=>meal.title)).toEqual(['Pasta']);
});
it('creates an assigned task and offers an invitation after activity', async () => {
  const addTask = vi.fn().mockResolvedValue(undefined), invite = vi.fn();
  render(<WeeklyPlanner events={[]} tasks={[{title:'Existing',done:false}]} meals={[]} members={[{id:'a',name:'Alex'}]} features={{}} onNavigate={vi.fn()} onInvite={invite} addTask={addTask}/>);
  fireEvent.click(screen.getByRole('button',{name:/Review week/}));
  fireEvent.change(screen.getByLabelText('Add a task'),{target:{value:'Pack bags'}});
  fireEvent.change(screen.getByLabelText('Assign task to'),{target:{value:'a'}});
  fireEvent.click(screen.getByRole('button',{name:'Add task'}));
  await waitFor(()=>expect(addTask).toHaveBeenCalledWith({title:'Pack bags',assigneeIds:['a']}));
  fireEvent.click(screen.getByRole('button',{name:'Invite'}));
  expect(invite).toHaveBeenCalledOnce();
});
it('keeps the task text when saving fails', async () => {
  render(<WeeklyPlanner events={[]} tasks={[]} meals={[]} members={[]} features={{}} onNavigate={vi.fn()} onInvite={vi.fn()} addTask={vi.fn().mockRejectedValue(new Error('offline'))}/>);
  fireEvent.click(screen.getByRole('button',{name:/Review week/}));
  fireEvent.change(screen.getByLabelText('Add a task'),{target:{value:'Pack bags'}});
  fireEvent.click(screen.getByRole('button',{name:'Add task'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(screen.getByLabelText('Add a task')).toHaveValue('Pack bags');
});
