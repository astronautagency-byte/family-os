import {it, expect} from 'vitest';
import {allowedTab, isChildAccount, CHILD_TABS} from '../childExperience';
it('limits child routes and preserves parent routes',()=>{
 for(const tab of CHILD_TABS) expect(allowedTab(tab,true)).toBe(tab);
 for(const tab of ['today','settings','meals','groceries','kitchen','famai']){
  expect(allowedTab(tab,true)).toBe('tasks');
  expect(allowedTab(tab,false)).toBe(tab);
 }
});
it('uses the member profile without restricting the household owner',()=>{
 expect(isChildAccount({role:'member'},{profileType:'child'})).toBe(true);
 expect(isChildAccount({role:'owner'},{profileType:'child'})).toBe(false);
 expect(isChildAccount({role:'member'},{profileType:'parent'})).toBe(false);
 expect(isChildAccount({role:'member'},null)).toBe(false);
});
