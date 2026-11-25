import {expect,it} from 'vitest';
import {requireChangedRecord} from './confirmedMutation';
it('rejects an RLS-filtered or stale record instead of reporting a false save',()=>{
 expect(()=>requireChangedRecord({data:[],error:null},'task-a','No access')).toThrow('No access');
 expect(()=>requireChangedRecord({data:[{id:'task-b'}]},'task-a','No access')).toThrow('No access');
});
it('preserves server errors for the retry dialog and accepts a confirmed change',()=>{
 const error=new Error('Offline');
 expect(()=>requireChangedRecord({error},'a','Missing')).toThrow(error);
 expect(()=>requireChangedRecord({data:[{id:'a'}]},'a','Missing')).not.toThrow();
});
