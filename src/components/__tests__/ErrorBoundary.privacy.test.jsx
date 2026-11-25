import {afterEach,expect,it,vi} from 'vitest';
import ErrorBoundary from '../ErrorBoundary';
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();window.history.replaceState(null,'','/');});
it('excludes private URL fragments and query parameters from crash-route diagnostics',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 window.history.replaceState(null,'','/auth?code=private-code#access_token=private-token');
 const boundary=new ErrorBoundary({});boundary.setState=vi.fn();
 boundary.componentDidCatch(new Error('Synthetic render failure'),{componentStack:'SampleComponent'});
 const stored=localStorage.getItem('famos:recent-crash:v1');
 expect(JSON.parse(stored).route).toBe('/auth');expect(stored).not.toContain('private-code');expect(stored).not.toContain('private-token');
 boundary.componentWillUnmount();
});
