import { it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PageHeader from '../PageHeader';
it('provides a labelled page-specific add button', () => {
  const add = vi.fn();
  const { getByRole, container } = render(<PageHeader title="Tasks" illustration="tasks" onAdd={add} addLabel="Add task"/>);
  fireEvent.click(getByRole('button', { name: 'Add task' }));
  expect(add).toHaveBeenCalledOnce();
  expect(getByRole('heading', { name: 'Tasks' })).toBeDefined();
  expect(container.querySelector('.page-spot-frame')).toBeNull();
});
