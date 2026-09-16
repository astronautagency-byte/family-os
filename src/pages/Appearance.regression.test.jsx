import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { writeFileSync } from 'node:fs';
import Settings from './Settings';
import Meals from './Meals';
import KitchenWatch from './KitchenWatch';
import BottomNav from '../components/BottomNav';
import BillingPlans from '../components/BillingPlans';

vi.mock('../context/AuthContext', () => ({useAuth:()=>({configured:false,user:{id:'parent',email:'parent@example.test'},household:{name:'Sample family'},memberProfile:{role:'Parent'}})}));
vi.mock('../context/FamilyContext', () => ({useFamily:()=>({members:[],memberById:{},meals:[],groceries:[],taskLists:[],refreshData:async()=>{},googleClientId:'sample',googleConnected:true,googleStatus:'synced',googleEvents:[],googleCalendars:[{id:'family',summary:'Family Shared',primary:true,backgroundColor:'#0891B2'}],googleCalendarColors:{},selectedGoogleCalendarIds:['family'],sharedGoogleCalendarIds:['family'],calendarFeeds:[]})}));
vi.mock('../hooks/useKitchenInventory',()=>({default:()=>({items:[],ingredientNames:[],addItem:vi.fn(),updateItem:vi.fn(),removeItem:vi.fn()})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
vi.mock('../components/EmailInbox',()=>({default:()=>null}));
vi.mock('../lib/supabase',()=>({supabase:null}));
afterEach(cleanup);

it('renders the real settings, meal toolbar and kitchen form for visual regression',()=>{
 window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const snapshots={};
 const capture=name=>{
  const clone=document.body.cloneNode(true);
  clone.querySelectorAll('select').forEach((select,index)=>{
   const value=document.body.querySelectorAll('select')[index].value;
   [...select.options].forEach(option=>option.toggleAttribute('selected',option.value===value));
  });
  snapshots[name]=clone.innerHTML;
 };
 render(<Settings colorScheme="forest"/>);
 expect(document.querySelector('.settings-color-scheme-card')).toBeTruthy();
 capture('settings');
 cleanup();
 render(<Meals/>);
 expect(document.querySelector('.meal-plan-toolbar').textContent).toContain('Find Meal Ideas');
 capture('meals');
 cleanup();
 render(<KitchenWatch/>);
 fireEvent.click(document.querySelector('.page-add-button'));
 expect(document.querySelector('.kw-item-form .kw-modal-grid')).toBeTruthy();
 capture('kitchen');
 cleanup();
 render(<div className="reference-settings"><BillingPlans loaded isOwner subscription={null} busy={null} interval="yearly" onInterval={()=>{}} onCheckout={()=>{}} onManage={()=>{}}/></div>);
 capture('billingOffer');
 cleanup();
 const nav=render(<BottomNav active="today" onChange={()=>{}} preferenceKey="visual-test"/>);
 capture('navigation');
 fireEvent.click(nav.getByRole('button',{name:'More'}));
 fireEvent.click(nav.getByRole('button',{name:/Customize shortcuts/}));
 capture('shortcutEditor');
 // Opt-in artifact consumed by the browser test; no production data/auth.
 if(process.env.FAMOS_UI_SNAPSHOT) writeFileSync(process.env.FAMOS_UI_SNAPSHOT,JSON.stringify(snapshots));
});
