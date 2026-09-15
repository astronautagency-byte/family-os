import {it,expect,vi,afterEach} from 'vitest';
const {fire,create}=vi.hoisted(()=>{const fire=Object.assign(vi.fn(()=>new Promise(()=>{})),{reset:vi.fn()});return {fire,create:vi.fn(()=>fire)};});
vi.mock('canvas-confetti',()=>({default:{create}}));
import {launchBrandConfetti,resetBrandConfetti,BRAND_CONFETTI_COLORS} from '../brandConfetti';
afterEach(()=>{resetBrandConfetti();vi.clearAllMocks();vi.unstubAllGlobals();});
it('fires both cannons in brand colors on one non-interactive canvas',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));launchBrandConfetti();
 expect(create).toHaveBeenCalledOnce();expect(fire).toHaveBeenCalledTimes(2);
 expect(fire.mock.calls[0][0].colors).toEqual(BRAND_CONFETTI_COLORS);
 expect(document.querySelector('[data-famos-confetti]').style.pointerEvents).toBe('none');
 resetBrandConfetti();expect(document.querySelector('[data-famos-confetti]')).toBe(null);
});
it('does not create canvas when reduced motion is enabled',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));launchBrandConfetti();expect(create).not.toHaveBeenCalled();
});
