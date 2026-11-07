import {render,cleanup,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MarketingFeatures from '../../pages/MarketingFeatures';
vi.mock('../MarketingNav',()=>({default:()=> <nav aria-label="Marketing"/>}));
vi.mock('../MarketingFooter',()=>({default:()=> <footer/>}));
afterEach(cleanup);
it('renders the chosen topic with working FAQ and related links',()=>{
 const {getByRole,getByText}=render(<MarketingFeatures path="/features/meals"/>);
 expect(getByRole('heading',{level:1}).textContent).toContain('Family meal planning');
 const question=getByText('Is basic meal planning free?');fireEvent.click(question);
 expect(question.closest('details').open).toBe(true);
 expect(getByRole('link',{name:/Explore recipe book/}).getAttribute('href')).toBe('/features/recipes');
 expect(document.title).toBe('Family Meal Planning App | FamOS');
});
it('renders calendar sync separately from the shared calendar',()=>{
 const {getByRole}=render(<MarketingFeatures path="/calendar-sync"/>);
 expect(getByRole('heading',{level:1}).textContent).toContain('calendar sync');
});
it('does not render a misleading feature for an unknown route',()=>{
 const {getByRole,container}=render(<MarketingFeatures path="/features/missing"/>);
 expect(getByRole('heading',{level:1}).textContent).toContain('isn’t here');
 expect(document.querySelector('meta[name="robots"]').content).toBe('noindex');
});
