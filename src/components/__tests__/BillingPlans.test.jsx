import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import BillingPlans from '../BillingPlans';
const base={subscription:null,loaded:true,error:false,isOwner:true,busy:null,onManage:vi.fn(),onCheckout:vi.fn()};
it('shows household USD totals without offering a new legacy subscription',()=>{
 render(<BillingPlans {...base}/>);
 expect(screen.getByText('$4.99')).toBeDefined();
 expect(screen.getByText('$7.99')).toBeDefined();
 expect(screen.getByText('$9.99')).toBeDefined();
 expect(screen.queryByRole('button',{name:/trial|choose|subscribe/i})).toBeNull();
});
it('preserves existing trial details and billing management',()=>{
 const manage=vi.fn();
 render(<BillingPlans {...base} onManage={manage} subscription={{plan:'plus',status:'trialing',trial_ends_at:'2030-09-22T12:00:00Z',cancel_at_period_end:true}}/>);
 expect(screen.getByRole('heading',{name:'FamOS Plus trial'})).toBeDefined();
 expect(screen.getByText(/Renewal is cancelled/)).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'Manage billing'}));
 expect(manage).toHaveBeenCalledOnce();
 expect(base.onCheckout).not.toHaveBeenCalled();
});
it('does not advertise plan changes when subscription lookup fails',()=>{
 render(<BillingPlans {...base} error/>);
 expect(screen.getByRole('alert')).toBeDefined();
 expect(screen.queryByText('$9.99')).toBeNull();
});
it('restricts billing management to the owner',()=>{
 render(<BillingPlans {...base} isOwner={false} subscription={{plan:'pro',status:'active'}}/>);
 expect(screen.getByRole('button',{name:'Manage billing'})).toBeDisabled();
});
