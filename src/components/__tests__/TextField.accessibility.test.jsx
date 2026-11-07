import {it,expect} from 'vitest';
import {render} from '@testing-library/react';
import {TextField} from '../ui';
it('connects labels and validation guidance while preserving existing descriptions',()=>{
 const {getByLabelText,getByRole}=render(<><p id="privacy">Only your family sees this</p><TextField label="Event name" hint="Use a clear title" error="Enter an event name" aria-describedby="privacy"/><TextField label="Location"/></>);
 const input=getByLabelText('Event name');
 expect(input.getAttribute('aria-invalid')).toBe('true');
 expect(input.getAttribute('aria-describedby').split(' ')).toEqual(['privacy',getByRole('alert').id]);
 expect(input.id).not.toBe(getByLabelText('Location').id);
});
