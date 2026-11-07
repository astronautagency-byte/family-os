import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import FamAIMarketing from '../../pages/FamAIMarketing';
vi.mock('../MarketingNav',()=>({default:()=>null}));
vi.mock('../MarketingFooter',()=>({default:()=>null}));
afterEach(cleanup);
it('switches voice and chat examples without saving or requesting microphone access',()=>{
 render(<FamAIMarketing/>);fireEvent.click(screen.getByRole('button',{name:'AI Chat',exact:true}));
 expect(screen.getByRole('heading',{name:'Big week? Start with a conversation.'})).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'Fill the list'}));expect(screen.getByText('Lemons, coming right up. Shall I add them to your shopping list?')).toBeDefined();
 expect(screen.getByText('Illustrative preview · nothing is saved')).toBeDefined();
});
it('keeps approved add-on choices separate and makes unavailable checkout explicit',()=>{
 render(<FamAIMarketing/>);const options=screen.getByRole('group',{name:'Choose an AI add-on'});
 fireEvent.click(options.querySelector('button'));
 expect(options.querySelector('button').getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByText(/Planned at US\$4.99\/month/)).toBeDefined();
 expect(screen.getByText(/Add-on checkout is coming soon/)).toBeDefined();
 expect(screen.getByText('$7.99')).toBeDefined();expect(screen.getByText('$9.99')).toBeDefined();
 expect(screen.queryByRole('button',{name:/buy|subscribe|checkout/i})).toBeNull();
});

it('lets visitors pause and resume decorative motion',()=>{
 render(<FamAIMarketing/>);const control=screen.getByRole('button',{name:'Pause motion'});
 fireEvent.click(control);expect(control.getAttribute('aria-pressed')).toBe('true');expect(screen.getByRole('button',{name:'Resume motion'})).toBeDefined();
 fireEvent.click(control);expect(control.getAttribute('aria-pressed')).toBe('false');
});
