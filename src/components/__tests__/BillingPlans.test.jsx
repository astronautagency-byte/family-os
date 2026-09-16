import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import BillingPlans from '../BillingPlans';
const base={subscription:null,loaded:true,error:false,isOwner:true,busy:null,interval:'monthly',onInterval:vi.fn(),onCheckout:vi.fn(),onManage:vi.fn()};
it('offers a card-required seven-day Pro trial using the checkout trial flag',()=>{
 const checkout=vi.fn();render(<BillingPlans {...base} onCheckout={checkout}/>);
 expect(screen.getByText(/Card required. No subscription charge today/).textContent).toContain('$19.99/month');
 fireEvent.click(screen.getByRole('button',{name:'Start 7-day Pro trial'}));
 expect(checkout).toHaveBeenCalledWith('pro','monthly',true);
});
it('shows the yearly total and correct monthly equivalent without inventing discounts',()=>{
 render(<BillingPlans {...base} interval="yearly"/>);
 expect(screen.getByText(/\$16.58\/month equivalent/)).toBeDefined();
 expect(screen.getByText(/Card required. No subscription charge today/).textContent).toContain('$199.00/year');
});
it.each([{loaded:false},{error:true},{isOwner:false}])('blocks checkout until status and authority are known: %j',state=>{
 render(<BillingPlans {...base} {...state}/>);
 screen.getAllByRole('button').filter(b=>/Choose FamOS|Start 7-day/.test(b.textContent)).forEach(b=>expect(b).toBeDisabled());
});
it('keeps the real legacy Plus trial and cancellation date visible',()=>{
 render(<BillingPlans {...base} subscription={{plan:'plus',status:'trialing',trial_ends_at:'2030-09-22T12:00:00Z',cancel_at_period_end:true}}/>);
 expect(screen.getByRole('heading',{name:'FamOS Plus trial'})).toBeDefined();
 expect(screen.getByText(/Renewal is cancelled/)).toBeDefined();
 expect(screen.queryByRole('button',{name:'Start 7-day Pro trial'})).toBeNull();
});
it('routes an existing subscription to billing instead of creating a second trial',()=>{
 const manage=vi.fn(),checkout=vi.fn();render(<BillingPlans {...base} subscription={{plan:'pro',status:'active'}} onManage={manage} onCheckout={checkout}/>);
 fireEvent.click(screen.getByRole('button',{name:'Manage renewal / Free plan'}));
 expect(manage).toHaveBeenCalledOnce();expect(checkout).not.toHaveBeenCalled();
});
it('does not offer repeat trials to cancelled subscribers',()=>{
 const checkout=vi.fn();render(<BillingPlans {...base} subscription={{plan:'pro',status:'canceled'}} onCheckout={checkout}/>);
 expect(screen.queryByRole('button',{name:'Start 7-day Pro trial'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Choose FamOS Pro'}));
 expect(checkout).toHaveBeenCalledWith('pro','monthly',false);
});
