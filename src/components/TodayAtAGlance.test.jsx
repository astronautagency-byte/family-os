import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TodayAtAGlance from './TodayAtAGlance';

afterEach(cleanup);

it('shows real household counts and opens the selected page', () => {
  const onSelect = vi.fn();
  render(<TodayAtAGlance features={{}} hidden={[]} eventCount={2} taskCount={1} dinner="Pasta" shoppingCount={3} onSelect={onSelect} />);
  expect(screen.getByRole('button', { name: /calendar.*2 events today/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /tasks.*1 task to do/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /dinner.*pasta/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /shopping.*3 items to get/i }));
  expect(onSelect).toHaveBeenCalledWith('groceries');
});

it('respects disabled features and the user’s hidden cards', () => {
  render(<TodayAtAGlance features={{ calendar: false }} hidden={['tasks']} eventCount={0} taskCount={0} shoppingCount={0} onSelect={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /calendar/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /tasks/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /dinner.*plan a meal/i })).toBeInTheDocument();
});
