import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({auth:{},invoke:vi.fn(),rpc:vi.fn(),store:false}));
vi.mock('../lib/distribution',()=>({get IS_APP_STORE(){return mocks.store;}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>mocks.auth}));
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke},rpc:mocks.rpc}}));
vi.mock('../lib/onboardingEmails',()=>({sendWelcomeEmail:vi.fn().mockResolvedValue(undefined)}));
import {HouseholdOnboarding,SignIn} from './Auth';
const key='family-os:onboarding-draft:v2:house_test:user_test';
beforeEach(()=>{
  cleanup();localStorage.clear();vi.clearAllMocks();mocks.store=false;
  window.matchMedia=vi.fn().mockImplementation(query=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  mocks.auth={household:{id:'house_test',role:'owner'},session:{user:{id:'user_test',email:'test@example.invalid'}},saveHouseholdProfile:vi.fn().mockResolvedValue(undefined),markOnboardingComplete:vi.fn(),skipOnboardingInvites:vi.fn(),invitePartner:vi.fn().mockResolvedValue(undefined)};
});
function atStep(step){localStorage.setItem(key,JSON.stringify({ownerStep:step,onboardingFamilyMembers:[{firstName:'Test Parent',relationship:'parent',birthday:''}]}));render(<HouseholdOnboarding/>);}
describe('compact authentication',()=>{
  it('keeps one brand image and the sign-in controls without a hero illustration',()=>{
    const {container}=render(<SignIn/>);
    expect(screen.getByRole('heading',{name:'Welcome back'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'FamOS'})).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Sign in',exact:true})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'New here? Create an account'}));
    expect(screen.getByRole('heading',{name:'Create your FamOS account'})).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
describe('owner onboarding flow',()=>{
  it('requires a name and starts new households with Free Core',()=>{
    render(<HouseholdOnboarding/>);
    expect(screen.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
    expect(screen.getByText(/FamOS Core is free/)).toBeInTheDocument();
  });
  it('lets people choose their first goal',()=>{
    atStep(1);
    fireEvent.click(screen.getByRole('button',{name:'Plan meals'}));
    expect(screen.getByRole('button',{name:'Plan meals'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button',{name:'Continue'})).toBeEnabled();
  });
  it('saves a draft across remounts',async()=>{
    atStep(1);cleanup();render(<HouseholdOnboarding/>);
    await waitFor(()=>expect(screen.getByText('What would help most?')).toBeInTheDocument());
  });
  it.each([3,4,5,7,99,4.8])('restores step %s to free completion', async step=>{
    atStep(step);
    fireEvent.click(screen.getByRole('button',{name:'Start using FamOS'}));
    await waitFor(()=>expect(mocks.auth.markOnboardingComplete).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('invited household members do not get a second subscription checkout',()=>{
    mocks.auth.household.role='member';
    render(<HouseholdOnboarding/>);
    expect(screen.getByRole('heading',{name:'Tell us about you'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Start 7-day Pro trial'})).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

 describe('store release onboarding',()=>{
  it('shows successful account deletion on sign-in',()=>{
    mocks.auth.accountDeleted=true;render(<SignIn/>);
    expect(screen.getByRole('status')).toHaveTextContent('Your account has been deleted. You are signed out.');
  });
  it('makes deletion accessible before setup is finished',()=>{
    render(<HouseholdOnboarding/>);
    fireEvent.click(screen.getByRole('button',{name:'Delete account',exact:true}));
    expect(screen.getByRole('dialog',{name:'Permanently delete your account?'})).toBeInTheDocument();
  });
  it.each([3,4,99])('finishes Core without checkout, including restored step %s',async(step)=>{
    mocks.store=true;atStep(step);
    expect(screen.queryByText(/Choose your plan/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Start 7-day Pro trial'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'See plan options'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Start using FamOS'}));
    await waitFor(()=>expect(mocks.auth.markOnboardingComplete).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
 });
