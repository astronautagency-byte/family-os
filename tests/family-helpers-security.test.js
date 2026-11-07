import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner='00000000-0000-0000-0000-000000000001', helper='00000000-0000-0000-0000-000000000002', outsider='00000000-0000-0000-0000-000000000003', member='00000000-0000-0000-0000-000000000004';
const home='10000000-0000-0000-0000-000000000001', other='10000000-0000-0000-0000-000000000002';
const list='20000000-0000-0000-0000-000000000001', foreign='20000000-0000-0000-0000-000000000002', item='30000000-0000-0000-0000-000000000001', event='40000000-0000-0000-0000-000000000001';
async function fixture() {
  const db=new PGlite();
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create publication supabase_realtime;`);
  for (const name of ['202607120001_initial_family_os.sql','202608020001_coordination_mvp.sql','202608020002_calendars_and_task_lists.sql','202608160001_task_notes_and_shopping_lists.sql','202608160003_event_recurrence.sql','202611070008_family_helpers.sql','202611070009_family_membership_guards.sql','202611070013_helper_passcodes.sql']) {
    let sql=await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
    sql=sql.replace('create extension if not exists pgcrypto;','');
    await db.exec(sql);
  }
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values ('${owner}','owner@example.com',now()),('${helper}','helper@example.com',now()),('${outsider}','outsider@example.com',now()),('${member}','member@example.com',now());
    insert into public.households(id,name,created_by) values ('${home}','Family A','${owner}'),('${other}','Family B','${outsider}');
    insert into public.household_members(household_id,user_id,role) values ('${home}','${owner}','owner'),('${home}','${member}','member'),('${other}','${outsider}','owner');
    insert into public.grocery_lists(id,household_id,name,created_by) values ('${list}','${home}','Cleaning supplies','${owner}'),('${foreign}','${other}','Private supplies','${outsider}');
    insert into public.grocery_items(id,household_id,list_id,name,added_by) values ('${item}','${home}','${list}','Soap','${owner}');
    insert into public.events(id,household_id,title,starts_at,ends_at,created_by) values ('${event}','${home}','Birthday',now()+interval '1 day',now()+interval '1 day 2 hours','${owner}');
    grant select,insert,update,delete on public.grocery_items,public.grocery_lists,public.tasks,public.events,public.messages to authenticated;
    set role authenticated;`);
  const as=async id=>db.query("select set_config('test.uid',$1,false)",[id]);
  const manage=async(action,payload={},h=home)=>(await db.query('select public.family_helpers($1,$2,$3::jsonb) result',[action,h,JSON.stringify(payload)])).rows[0].result;
  const guest=async(action,payload={})=>(await db.query('select public.helper_portal($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
  const invite=async(grants=[{kind:'groceries',id:list,permission:'complete'}],extra={})=>{await as(owner); return manage('invite',{name:'Sam',email:'helper@example.com',preset:'housekeeping',expires_at:new Date(Date.now()+86400000*3).toISOString(),grants,...extra});};
  return {db,as,manage,guest,invite};
}

test('helper invitation, minimal reads, item completion, resource revoke and removal enforce server authority',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  try {
    await as(member); await assert.rejects(manage('load'),/owner access required/i);
    await as(outsider); await assert.rejects(manage('load'),/owner access required/i);
    await as(owner); await assert.rejects(invite([{kind:'groceries',id:foreign,permission:'complete'}]),/cannot be shared/i);
    const invitation=await invite();
    await as(outsider); await assert.rejects(guest('accept',{token:invitation.token}),/unavailable/i);
    await as(helper);
    const preview=await guest('preview',{token:invitation.token});
    assert.equal(preview.family,'Family A'); assert.equal(preview.resources[0].name,'Cleaning supplies'); assert.equal(preview.resources[0].items,undefined);
    await guest('accept',{token:invitation.token});
    await assert.rejects(guest('accept',{token:invitation.token}),/unavailable/i);
    assert.equal((await db.query('select * from public.grocery_items')).rows.length,0);
    assert.equal((await db.query('select * from public.messages')).rows.length,0);
    await assert.rejects(db.query('select * from public.household_helper_access'),/permission denied/i);
    await assert.rejects(db.query('select public.helper_shared_resources($1)',[invitation.id]),/permission denied/i);
    const data=await guest('read',{id:invitation.id}), resource=data.resources[0];
    assert.deepEqual(Object.keys(resource.items[0]).sort(),['done','id','title']);
    await guest('complete',{id:invitation.id,grant_id:resource.grant_id,item_id:item,done:true,household_id:other,title:'Injected'});
    await as(owner); assert.equal((await db.query('select name,is_checked from public.grocery_items where id=$1',[item])).rows[0].is_checked,true);
    assert.equal((await db.query('select name from public.grocery_items where id=$1',[item])).rows[0].name,'Soap');
    await as(helper); await assert.rejects(guest('complete',{id:invitation.id,grant_id:resource.grant_id,item_id:foreign,done:true}),/unavailable/i);
    await as(outsider); await assert.rejects(guest('read',{id:invitation.id}),/unavailable/i);
    await as(owner); await manage('revoke_resource',{id:invitation.id,grant_id:resource.grant_id});
    await as(helper); await assert.rejects(guest('read',{id:invitation.id}),/access ended/i);
    await assert.rejects(guest('complete',{id:invitation.id,grant_id:resource.grant_id,item_id:item,done:false}),/access ended/i);
    await as(owner); await manage('remove',{id:invitation.id}); assert.equal((await manage('load')).helpers.length,0);
    assert.equal((await db.query('select * from public.grocery_items where id=$1',[item])).rows.length,1);
  } finally {await db.close();}
});

test('event confirmation grants no access; cancellation revokes job access while general access survives',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  try {
    const general=await invite(); await as(helper); await guest('accept',{token:general.token});
    await as(owner);
    const request=await manage('request',{event_id:event,service:'babysitting',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+93600000).toISOString(),area:'Richmond Hill',requirements:'Evening care',budget:'CAD 100'});
    await assert.rejects(invite([{kind:'event',id:event,permission:'view'}],{request_id:request.id}),/confirm/i);
    await manage('request_status',{id:request.id,status:'confirmed'});
    await as(helper); assert.equal((await guest('homes')).length,1);
    const job=await invite([{kind:'event',id:event,permission:'view'}],{request_id:request.id,expires_at:new Date(Date.now()+100800000).toISOString()});
    await as(helper); await guest('accept',{token:job.token}); assert.equal((await guest('homes')).length,2);
    const data=await guest('read',{id:job.id}); assert.equal(data.resources[0].kind,'event'); assert.equal(data.resources[0].items[0].location,undefined);
    await as(owner); await manage('request_status',{id:request.id,status:'cancelled'});
    await as(helper); await assert.rejects(guest('read',{id:job.id}),/access ended/i); assert.equal((await guest('read',{id:general.id})).resources.length,1);
    await as(owner); await assert.rejects(manage('request_status',{id:request.id,status:'confirmed'}),/transition/i);
  } finally {await db.close();}
});

test('private items, changed container privacy, expiry, leave and unverified accounts fail closed',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  try {
    const taskList='50000000-0000-0000-0000-000000000001';
    await db.exec(`reset role; insert into public.task_lists(id,household_id,name,created_by) values ('${taskList}','${home}','Care tasks','${owner}');
      insert into public.tasks(household_id,title,created_by,list_id,visibility) values ('${home}','Public task','${owner}','${taskList}','household'),('${home}','Private task','${owner}','${taskList}','private'); set role authenticated;`);
    const invitation=await invite([{kind:'tasks',id:taskList,permission:'view'}]);
    await as(helper); await guest('accept',{token:invitation.token});
    const data=await guest('read',{id:invitation.id}); assert.equal(data.resources[0].items.length,1);
    await assert.rejects(guest('complete',{id:invitation.id,grant_id:data.resources[0].grant_id,item_id:data.resources[0].items[0].id,done:true}),/not permitted/i);
    await db.exec(`reset role; update public.task_lists set visibility='private' where id='${taskList}'; set role authenticated;`);
    assert.equal((await guest('read',{id:invitation.id})).resources.length,0);
    await guest('leave',{id:invitation.id}); await assert.rejects(guest('read',{id:invitation.id}),/access ended/i);
    const expired=await invite();
    await db.exec(`reset role; update public.household_helper_access set invite_expires_at=now()-interval '1 second' where id='${expired.id}'; set role authenticated;`);
    await as(helper); await assert.rejects(guest('accept',{token:expired.token}),/unavailable/i);
    const unverified=await invite();
    await db.exec(`reset role; update auth.users set email_confirmed_at=null where id='${helper}'; set role authenticated;`);
    await as(helper); await assert.rejects(guest('accept',{token:unverified.token}),/verified/i);
    await as(owner); assert.equal((await manage('load')).helpers.find(x=>x.id===expired.id).state,'expired');
    assert.equal((await db.query("select has_function_privilege('anon','public.helper_portal(text,jsonb)','execute') allowed")).rows[0].allowed,false);
  } finally {await db.close();}
});

test('default calendar shares only FamOS household events and private parents block individual grants',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  try {
    const calendar='60000000-0000-0000-0000-000000000001';
    await db.exec(`reset role;
      insert into public.events(household_id,title,starts_at,ends_at,created_by,visibility,source) values
      ('${home}','Private appointment',now(),now()+interval '1 hour','${owner}','private','familyos'),
      ('${home}','Google meeting',now(),now()+interval '1 hour','${owner}','household','google');
      insert into public.calendars(id,household_id,name,created_by) values ('${calendar}','${home}','Care schedule','${owner}');
      set role authenticated;`);
    const invitation=await invite([{kind:'family_calendar',id:home,permission:'view'}]);
    await as(helper);await guest('accept',{token:invitation.token});
    const data=await guest('read',{id:invitation.id});assert.deepEqual(data.resources[0].items.map(x=>x.title),['Birthday']);
    const single=await invite([{kind:'event',id:event,permission:'view'}]);
    await as(helper);await guest('accept',{token:single.token});
    await db.exec(`reset role;update public.events set calendar_id='${calendar}' where id='${event}';update public.calendars set visibility='private' where id='${calendar}';set role authenticated;`);
    assert.equal((await guest('read',{id:single.id})).resources.length,0);
    assert.equal((await guest('read',{id:invitation.id})).resources[0].items.length,0);
    await as(owner);await assert.rejects(invite([{kind:'event',id:event,permission:'view'}]),/cannot be shared/i);
  } finally {await db.close();}
});

test('a helper can serve two families without gaining membership and expiry blocks accepted sessions',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  try {
    const first=await invite();await as(helper);await guest('accept',{token:first.token});
    await as(outsider);
    const second=await manage('invite',{name:'Sam',email:'helper@example.com',preset:'custom',expires_at:new Date(Date.now()+86400000).toISOString(),grants:[{kind:'groceries',id:foreign,permission:'view'}]},other);
    await as(helper);await guest('accept',{token:second.token});assert.equal((await guest('homes')).length,2);
    assert.equal((await guest('read',{id:first.id})).family,'Family A');assert.equal((await guest('read',{id:second.id})).family,'Family B');
    assert.equal((await db.query(`select * from public.grocery_lists`)).rows.length,0);
    await db.exec(`reset role;update public.household_helper_access set expires_at=now()-interval '1 second' where id='${first.id}';set role authenticated;`);
    await assert.rejects(guest('read',{id:first.id}),/access ended/i);
    assert.equal((await guest('homes')).length,1);
    await as(outsider);await manage('revoke',{id:second.id},other);
    await as(helper);await assert.rejects(guest('read',{id:second.id}),/access ended/i);
    await db.exec('reset role');assert.equal((await db.query('select * from public.household_members where user_id=$1',[helper])).rows.length,0);
  } finally {await db.close();}
});


test('restrictive membership guards resist broad policies and remove former-member table access',async()=>{
  const {db,as}=await fixture();
  try {
    await db.exec(`reset role;
      create policy "accidental broad groceries" on public.grocery_items for all to authenticated using(true) with check(true);
      create policy "accidental broad tasks" on public.tasks for all to authenticated using(true) with check(true);
      create policy "accidental broad messages" on public.messages for all to authenticated using(true) with check(true);
      insert into public.tasks(household_id,title,created_by) values ('${home}','Former member task','${member}');
      insert into public.messages(household_id,sender_id,body) values ('${home}','${owner}','Private family conversation');
      set role authenticated;`);
    await as(member); assert.equal((await db.query('select * from public.grocery_items')).rows.length,1);
    await db.exec(`reset role; delete from public.household_members where user_id='${member}'; set role authenticated;`);
    for(const who of [member,helper]) {
      await as(who);
      for(const table of ['tasks','grocery_items','messages']) {
        assert.equal((await db.query('select * from public.'+table)).rows.length,0);
        assert.equal((await db.query('delete from public.'+table+' returning id')).rows.length,0);
      }
      assert.equal((await db.query("update public.grocery_items set name='Forged' returning id")).rows.length,0);
      await assert.rejects(db.query('insert into public.grocery_items(household_id,name,added_by) values($1,$2,$3)',[home,'Injected',who]),/row.level security/i);
    }
    await as(owner);assert.equal((await db.query('select * from public.grocery_items')).rows.length,1);
  }finally {await db.close();}
});

test('task-list grants isolate tasks, enforce check-off permission and stop immediately on revoke',async()=>{
  const {db,as,manage,guest,invite}=await fixture();
  const tasksList='50000000-0000-0000-0000-000000000001', hiddenList='50000000-0000-0000-0000-000000000002';
  const visible='60000000-0000-0000-0000-000000000001', privateTask='60000000-0000-0000-0000-000000000002', unshared='60000000-0000-0000-0000-000000000003';
  try {
    await db.exec(`reset role;
      insert into public.task_lists(id,household_id,name,created_by,visibility) values ('${tasksList}','${home}','Cleaning checklist','${owner}','household'),('${hiddenList}','${home}','Private list','${owner}','private');
      insert into public.tasks(id,household_id,list_id,title,created_by,visibility) values ('${visible}','${home}','${tasksList}','Vacuum','${owner}','household'),('${privateTask}','${home}','${tasksList}','Private reminder','${owner}','private'),('${unshared}','${home}',null,'Unshared task','${owner}','household');
      set role authenticated;`);
    await as(owner);
    assert.ok((await manage('load')).resources.some(r=>r.kind==='tasks'&&r.id===tasksList));
    await assert.rejects(invite([{kind:'tasks',id:hiddenList,permission:'view'}]),/cannot be shared/i);
    const readonly=await invite([{kind:'tasks',id:tasksList,permission:'view'}]);
    await as(helper);await guest('accept',{token:readonly.token});
    let resource=(await guest('read',{id:readonly.id})).resources[0];
    assert.deepEqual(resource.items.map(i=>i.title),['Vacuum']);
    await assert.rejects(guest('complete',{id:readonly.id,grant_id:resource.grant_id,item_id:visible,done:true}),/permission|not permitted|unavailable/i);
    const editable=await invite([{kind:'tasks',id:tasksList,permission:'complete'}]);
    await as(helper);await guest('accept',{token:editable.token});
    resource=(await guest('read',{id:editable.id})).resources[0];
    await guest('complete',{id:editable.id,grant_id:resource.grant_id,item_id:visible,done:true});
    for(const id of [privateTask,unshared])await assert.rejects(guest('complete',{id:editable.id,grant_id:resource.grant_id,item_id:id,done:true}),/unavailable/i);
    await as(owner);assert.equal((await db.query('select is_done from public.tasks where id=$1',[visible])).rows[0].is_done,true);
    await manage('revoke',{id:editable.id});
    await as(helper);await assert.rejects(guest('read',{id:editable.id}),/access ended/i);
    await assert.rejects(guest('complete',{id:editable.id,grant_id:resource.grant_id,item_id:visible,done:false}),/access ended/i);
  } finally {await db.close();}
});


test('passcode helpers need no account and sessions are scoped, rate limited and revocable',async()=>{
 const {db,as,manage}=await fixture();
 const create=async(permission='complete')=>{await as(owner);return (await db.query("select public.invite_helper_passcode('invite',$1,$2::jsonb) result",[home,JSON.stringify({name:'Guest cleaner',passcode:'9876543210',preset:'housekeeping',expires_at:new Date(Date.now()+86400000).toISOString(),grants:[{kind:'groceries',id:list,permission}]})])).rows[0].result;};
 const login=async(token,passcode)=>(await db.query('select public.helper_guest_login($1,$2) result',[token,passcode])).rows[0].result;
 const portal=async(secret,action,payload={})=>(await db.query('select public.helper_guest_portal($1,$2,$3::jsonb) result',[secret,action,JSON.stringify(payload)])).rows[0].result;
 try{
  const invitation=await create();
  await assert.rejects(login(invitation.token,'9876543210'),/permission denied/i);
  await db.exec('reset role');
  for(let i=0;i<5;i++)assert.ok((await login(invitation.token,'bad')).error);
  assert.match((await login(invitation.token,'9876543210')).error,/too many attempts/i);
  await db.query("update public.helper_passcodes set locked_until=now()-interval '1 second' where access_id=$1",[invitation.id]);
  const session=await login(invitation.token,'9876543210');assert.ok(session.secret);
  const data=await portal(session.secret,'read');assert.equal(data.resources.length,1);assert.equal(data.resources[0].name,'Cleaning supplies');
  const grant=data.resources[0].grant_id;
  await portal(session.secret,'complete',{grant_id:grant,item_id:item,done:true});
  await assert.rejects(portal(session.secret,'complete',{grant_id:grant,item_id:foreign,done:true}),/unavailable/i);
  assert.equal((await db.query('select is_checked from public.grocery_items where id=$1',[item])).rows[0].is_checked,true);
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,4);
  await db.exec('set role authenticated');await as(owner);await manage('revoke',{id:invitation.id});await db.exec('reset role');
  assert.ok((await portal(session.secret,'read')).error);assert.ok((await portal(session.secret,'complete',{grant_id:grant,item_id:item,done:false})).error);
  const readonly=await create('view');await db.exec('reset role');const ro=await login(readonly.token,'9876543210');const r=(await portal(ro.secret,'read')).resources[0];
  await assert.rejects(portal(ro.secret,'complete',{grant_id:r.grant_id,item_id:item,done:false}),/not permitted/i);
  await portal(ro.secret,'logout');assert.ok((await portal(ro.secret,'read')).error);
 }finally{await db.close();}
});

test('passcode invite SMS claims require owner, phone consent and correct credentials; expired access fails closed',async()=>{
 const {db,as}=await fixture();
 const payload={name:'Nanny',passcode:'MiaHelper987',phone:'+14165550123',sms_consent:true,preset:'nanny',expires_at:new Date(Date.now()+86400000).toISOString(),grants:[{kind:'groceries',id:list,permission:'view'}]};
 const invite=async p=>(await db.query("select public.invite_helper_passcode('invite',$1,$2::jsonb) result",[home,JSON.stringify(p)])).rows[0].result;
 const claim=async(id,actor,token,code)=>(await db.query('select public.claim_helper_sms($1,$2,$3,$4) result',[id,actor,token,code])).rows[0].result;
 try{
  await as(outsider);await assert.rejects(invite(payload),/owner/i);
  await as(owner);await assert.rejects(invite({...payload,sms_consent:false}),/confirm permission/i);await assert.rejects(invite({...payload,passcode:'1234'}),/8 to 64/i);
  const invitation=await invite(payload);
  await assert.rejects(db.query('select * from public.helper_passcodes'),/permission denied/i);
  await assert.rejects(claim(invitation.id,owner,invitation.token,payload.passcode),/permission denied/i);
  await db.exec('reset role');
  await assert.rejects(claim(invitation.id,outsider,invitation.token,payload.passcode),/unavailable/i);
  await assert.rejects(claim(invitation.id,owner,invitation.token,'wrong'),/unavailable/i);
  const delivery=await claim(invitation.id,owner,invitation.token,payload.passcode);assert.equal(delivery.phone,payload.phone);
  await assert.rejects(claim(invitation.id,owner,invitation.token,payload.passcode),/recently attempted/i);
  await db.query("update public.household_helper_access set invite_expires_at=now()-interval '1 second' where id=$1",[invitation.id]);
  const login=async()=>(await db.query('select public.helper_guest_login($1,$2) result',[invitation.token,payload.passcode])).rows[0].result;
  assert.ok((await login()).error);
  await db.query("update public.household_helper_access set invite_expires_at=now()+interval '1 day' where id=$1",[invitation.id]);
  const session=await login();assert.ok(session.secret);
  await db.query("update public.helper_guest_sessions set expires_at=now()-interval '1 second'");
  assert.ok((await db.query("select public.helper_guest_portal($1,'read') result",[session.secret])).rows[0].result.error);
 }finally{await db.close();}
});
