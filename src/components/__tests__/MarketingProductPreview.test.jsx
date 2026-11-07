import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import MarketingProductPreview from '../MarketingProductPreview';
afterEach(cleanup);
it('adds, completes and reopens a shopping item in the sample list',()=>{
 render(<MarketingProductPreview kind="shopping"/>);
 fireEvent.change(screen.getByLabelText('Add an item'),{target:{value:'Bread'}});
 fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Complete Bread'}));
 expect(screen.queryByRole('button',{name:'Complete Bread'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Completed'}));
 fireEvent.click(screen.getByRole('button',{name:'Reopen Bread'}));
 expect(screen.queryByRole('button',{name:'Reopen Bread'})).toBeNull();
});
it('changes calendar days and expands an event',()=>{
 render(<MarketingProductPreview kind="calendar"/>);
 fireEvent.click(screen.getByRole('button',{name:'Next day'}));
 expect(screen.getByText('Tue, Sep 15')).toBeInTheDocument();
 const event=screen.getByRole('button',{name:/Dentist/}); fireEvent.click(event);
 expect(event).toHaveAttribute('aria-expanded','true');
 expect(within(event).getByText(/Family calendar/)).toBeInTheDocument();
});
it('adds a dinner and opens a recipe',()=>{
 const {rerender}=render(<MarketingProductPreview kind="meals"/>);
 fireEvent.click(screen.getByRole('button',{name:'+ Add meal'}));
 expect(screen.getByText('Chicken fajitas')).toBeInTheDocument();
 rerender(<MarketingProductPreview kind="recipes"/>);
 fireEvent.click(screen.getByRole('button',{name:'Open recipe'}));
 expect(screen.getByText('Ingredients')).toBeInTheDocument();
});
it('shows a reward request pending approval',()=>{
 render(<MarketingProductPreview kind="rewards"/>);
 fireEvent.click(screen.getByRole('button',{name:'Request reward'}));
 expect(screen.getByText('Waiting for parent approval')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Requested'})).toBeDisabled();
});
it('sends a sample chat message and toggles a sample setting',()=>{
 const {rerender}=render(<MarketingProductPreview kind="chat"/>);
 fireEvent.change(screen.getByLabelText('Message the family'),{target:{value:'See you soon'}});
 fireEvent.click(screen.getByRole('button',{name:'Send message'}));
 expect(screen.getByText('See you soon')).toBeInTheDocument();
 rerender(<MarketingProductPreview kind="settings"/>);
 const toggle=screen.getByRole('switch',{name:'RewardBank'});fireEvent.click(toggle);
 expect(toggle).toHaveAttribute('aria-checked','true');
});
