import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({auth:{},invoke:vi.fn(),rpc:vi.fn()}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>mocks.auth}));
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke},rpc:mocks.rpc}}));
vi.mock('../lib/onboardingEmails',()=>({sendWelcomeEmail:vi.fn().mockResolvedValue(undefined)}));
import {HouseholdOnboarding,SignIn} from './Auth';
const key='family-os:onboarding-draft:v2:house_test:user_test';
beforeEach(()=>{
  cleanup();localStorage.clear();vi.clearAllMocks();
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
  it('requires a name before continuing and discloses card/renewal before setup',()=>{
    render(<HouseholdOnboarding/>);
    expect(screen.getByRole('button',{name:'That’s Everyone',exact:true})).toBeDisabled();
    expect(screen.getByText(/Setup ends with secure card checkout/)).toHaveTextContent('19.99');
    fireEvent.change(screen.getByLabelText('First name'),{target:{value:'Test Parent'}});
    expect(screen.getByRole('button',{name:'That’s Everyone',exact:true})).toBeEnabled();
  });
  it('offers the requested card-backed seven-day Pro trial',()=>{
    atStep(4);
    expect(screen.getByRole('button',{name:'Start 7-day Pro trial'})).toBeEnabled();
    expect(screen.getByText(/CAD\/month after your 7-day trial/)).toBeInTheDocument();
    expect(screen.queryByText(/30 days/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Start your Pro trial'})).toBeInTheDocument();
  });
  it('checkout failure keeps the draft and does not complete onboarding',async()=>{
    mocks.invoke.mockResolvedValue({error:new Error('offline')});atStep(4);
    fireEvent.click(screen.getByRole('button',{name:'Start 7-day Pro trial'}));
    await screen.findByText(/Could not open secure checkout/);
    expect(mocks.invoke).toHaveBeenCalledWith('create-checkout-session',{body:{feature:'pro',billing:'monthly',onboarding:true}});
    expect(mocks.auth.saveHouseholdProfile).not.toHaveBeenCalled();
    expect(mocks.auth.markOnboardingComplete).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key)).onboardingFamilyMembers[0].firstName).toBe('Test Parent');
  });
  it('saves a draft across remounts',async()=>{
    atStep(1);cleanup();render(<HouseholdOnboarding/>);
    await waitFor(()=>expect(screen.getByText('What keeps your family busy?')).toBeInTheDocument());
  });
  it('a restored older final-step draft still has a checkout action',()=>{
    atStep(5);
    expect(screen.getByRole('button',{name:'Start 7-day Pro trial'})).toBeEnabled();
  });
  it.each([7,99,4.8])('normalizes out-of-range saved step %s',step=>{
    atStep(step);
    expect(screen.getByRole('button',{name:'Start 7-day Pro trial'})).toBeEnabled();
  });
  it('invited household members do not get a second subscription checkout',()=>{
    mocks.auth.household.role='member';
    render(<HouseholdOnboarding/>);
    expect(screen.getByRole('heading',{name:'Tell us about you'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Start 7-day Pro trial'})).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
