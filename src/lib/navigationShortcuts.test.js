import {it,expect} from 'vitest';
import {resolveShortcuts,CHILD_SHORTCUTS} from './navigationShortcuts';
it('filters stale, duplicate, disabled and unpermitted pages and fills four slots',()=>{
 expect(resolveShortcuts(['chat','chat','secret','kitchen'],['today','calendar','tasks','chat','groceries'])).toEqual(['chat','today','calendar','tasks']);
 expect(resolveShortcuts(['today','recipes'],['tasks','chat'],CHILD_SHORTCUTS)).toEqual(['tasks','chat']);
 expect(resolveShortcuts({},['today'])).toEqual(['today']);
});
