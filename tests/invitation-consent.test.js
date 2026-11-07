import test from 'node:test';
import assert from 'node:assert/strict';
import {canSendInvitationSms,canSendTestSms} from '../supabase/functions/_shared/invitation-consent.js';
test('SMS invitations require a per-message confirmation',()=>{
 assert.equal(canSendInvitationSms({wantsSms:true,phone:'+14165550123',consent:false}),false);
 assert.equal(canSendInvitationSms({wantsSms:true,phone:'+14165550123',consent:true}),true);
 assert.equal(canSendInvitationSms({wantsSms:false,phone:'+14165550123',consent:false}),true);
});
test('test texts only go to a matching verified account number',()=>{
 const user={verifiedPhone:'14165550123',phoneConfirmed:true};
 assert.equal(canSendTestSms({...user,phone:'+14165550123'}),true);
 assert.equal(canSendTestSms({...user,phone:'+14165550124'}),false);
 assert.equal(canSendTestSms({...user,phone:'+14165550123',phoneConfirmed:false}),false);
 assert.equal(canSendTestSms({...user,phone:'bad'}),false);
});
