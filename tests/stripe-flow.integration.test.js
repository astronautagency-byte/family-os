// Executes the actual edge handlers with simulated Stripe/Supabase services.
// No network requests, real card numbers, customers or subscriptions are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

function harness(endpoint, overrides={}) {
  const calls=[];
  const state={role:'owner',owner:'user_test',current:null,history:[],sessions:[],price:{active:true,currency:'cad',unit_amount:1999,recurring:{interval:'month',interval_count:1}},...overrides};
  const capture=(name,value)=>{calls.push({name,value});};
  const idempotentSessions=new Map();
  const stripe={
    prices:{retrieve:async()=>state.price},
    customers:{create:async value=>{capture('customer',value);return {id:'cus_test'};}},
    subscriptions:{list:async()=>({data:state.history}),retrieve:async()=>state.sub},
    checkout:{sessions:{list:async()=>({data:state.sessions}),expire:async id=>capture('expire',id),create:async (value,options)=>{
      const key=options?.idempotencyKey;
      const previous=key && idempotentSessions.get(key);
      if(previous){
        if(previous.body!==JSON.stringify(value)) throw new Error('Idempotency key reused with different parameters');
        return previous.result;
      }
      capture('checkout',value);capture('checkoutOptions',options);
      const result={url:'https://checkout.stripe.test/session',id:'cs_test'};
      if(key) idempotentSessions.set(key,{body:JSON.stringify(value),result});
      return result;
    }}},
    billingPortal:{sessions:{create:async value=>{capture('portal',value);return {url:'https://billing.stripe.test/session'};}}},
    paymentMethods:{retrieve:async()=>({card:{brand:'visa',last4:'4242'}})},
    webhooks:{constructEventAsync:async()=>{if(state.badSignature) throw new Error('invalid signature');return state.event;}},
  };
  const admin={auth:{getUser:async()=>({data:state.badUser?null:{user:{id:'user_test',email:'test@example.invalid'}}})},
    from(table){
      const query={select(){return this;},eq(){return this;},limit(){return this;},
        single:async()=>({data:table==='household_members'?{household_id:'home_test',role:state.role}:{id:'home_test',created_by:state.owner,name:'Test household'}}),
        maybeSingle:async()=>({data:state.current,error:state.dbError?new Error('database unavailable'):null}),
        upsert:async value=>{capture('upsert',value);return {error:state.saveError?new Error('save failed'):null};},
      };return query;
    },
    rpc:async(name,value)=>{capture(name,value);return {error:state.rpcError?new Error('write failed'):null};},
  };
  let handler;
  const env={STRIPE_SECRET_KEY:'sk_test_simulated',STRIPE_WEBHOOK_SECRET:'whsec_simulated',SUPABASE_URL:'https://db.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',STRIPE_PRICE_PRO_MONTHLY:'price_pro',STRIPE_PRICE_PRO_YEARLY:'price_year',STRIPE_PRICE_PLUS_MONTHLY:'price_plus',FRONTEND_URL:'https://app.example.invalid'};
  const context=vm.createContext({Request,Response,console:{warn(){},error(){}},Stripe:function(){return stripe;},createClient:()=>admin,Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}}});
  const helper=readFileSync(new URL('../supabase/functions/_shared/checkoutPolicy.ts',import.meta.url),'utf8').replace('export function','function');
  const source=readFileSync(new URL(`../supabase/functions/${endpoint}/index.ts`,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInContext(stripTypeScriptTypes(helper+'\n'+source),context);
  return {calls, async request(body={},headers={authorization:'Bearer fake-token'},method='POST'){
    const response=await handler(new Request('https://edge.example.invalid',{method,headers, ...(method==='POST'?{body:JSON.stringify(body)}:{})}));
    return {status:response.status,body:await response.json()};
  }};
}

test('new signup creates card-required seven-day Pro trial, not an immediate payment',async()=>{
  const h=harness('create-checkout-session');
  assert.equal((await h.request({onboarding:true,feature:'plus'})).status,200);
  const checkout=h.calls.find(c=>c.name==='checkout').value;
  assert.equal(checkout.payment_method_collection,'always');
  assert.deepEqual(Array.from(checkout.payment_method_types),['card']);
  assert.equal(checkout.subscription_data.trial_period_days,7);
  assert.equal(checkout.subscription_data.trial_settings.end_behavior.missing_payment_method,'cancel');
  assert.equal(checkout.line_items[0].price,'price_pro');
  assert.equal(checkout.metadata.famos_household_id,'home_test');
  assert.match(checkout.cancel_url,/billing=cancelled/);
});
test('missing/invalid auth cannot create a checkout',async()=>{
  assert.equal((await harness('create-checkout-session').request({},{})).status,401);
  assert.equal((await harness('create-checkout-session',{badUser:true}).request()).status,401);
});
test('non-owner cannot open checkout or the billing portal',async()=>{
  for(const endpoint of ['create-checkout-session','billing-portal']){
    const h=harness(endpoint,{role:'child',owner:'another_user'});
    assert.equal((await h.request({onboarding:true})).status,403);assert.equal(h.calls.length,0);
  }
});
test('existing paid subscription opens portal without creating another subscription',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'active',stripe_customer_id:'cus_test',stripe_subscription_id:'sub_test'}});
  assert.equal((await h.request({onboarding:true})).status,200);
  assert.deepEqual(h.calls.map(c=>c.name),['portal']);
});
test('prior subscription prevents repeat trial',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'canceled',stripe_customer_id:'cus_test'},history:[{id:'sub_old'}]});
  assert.equal((await h.request({onboarding:true})).status,409);assert.equal(h.calls.length,0);
});
test('other-provider access is not overwritten',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'chargebee',status:'active'}});
  assert.equal((await h.request({onboarding:true})).status,409);assert.equal(h.calls.length,0);
});
test('cancelled checkout resumes the same open trial session',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'incomplete',stripe_customer_id:'cus_test'},sessions:[{id:'cs_existing',status:'open',mode:'subscription',url:'https://checkout.stripe.test/resume',metadata:{famos_offer:'pro-card-trial-7',famos_billing:'monthly'}}]});
  const r=await h.request({onboarding:true});assert.equal(r.body.sessionId,'cs_existing');assert.equal(h.calls.length,0);
});
test('simultaneous trial requests do not create competing checkout sessions',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'incomplete',stripe_customer_id:'cus_test'}});
  await Promise.all([h.request({onboarding:true}),h.request({onboarding:true})]);
  assert.equal(h.calls.filter(c=>c.name==='checkout').length,1,'concurrent requests must be serialized or use a shared Stripe idempotency key');
  assert.match(h.calls.find(c=>c.name==='checkoutOptions').value.idempotencyKey,/^famos-pro-trial-v1-cus_test-initial$/);
});
test('an expired session gets a fresh stable retry key, not a permanently expired checkout',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'incomplete',stripe_customer_id:'cus_test'},sessions:[{id:'cs_expired',status:'expired',mode:'subscription',metadata:{famos_offer:'pro-card-trial-7',famos_billing:'monthly'}}]});
  await Promise.all([h.request({onboarding:true}),h.request({onboarding:true})]);
  assert.equal(h.calls.filter(c=>c.name==='checkout').length,1);
  assert.equal(h.calls.find(c=>c.name==='checkoutOptions').value.idempotencyKey,'famos-pro-trial-v1-cus_test-cs_expired');
  assert.equal(h.calls.some(c=>c.name==='expire'),false);
});
test('an open trial with a different interval is not silently replaced',async()=>{
  const h=harness('create-checkout-session',{current:{provider:'stripe',status:'incomplete',stripe_customer_id:'cus_test'},sessions:[{id:'cs_yearly',status:'open',mode:'subscription',metadata:{famos_offer:'pro-card-trial-7',famos_billing:'yearly'}}]});
  assert.equal((await h.request({onboarding:true})).status,409);assert.equal(h.calls.length,0);
});
test('incorrect advertised price fails closed',async()=>{
  const h=harness('create-checkout-session',{price:{active:true,currency:'usd',unit_amount:1999}});
  assert.equal((await h.request({onboarding:true})).status,503);assert.equal(h.calls.length,0);
});
test('database failures do not proceed to checkout',async()=>{
  for(const fail of [{dbError:true},{saveError:true}]){
    const h=harness('create-checkout-session',fail);assert.equal((await h.request({onboarding:true})).status,500);
    assert.equal(h.calls.some(c=>c.name==='checkout'),false);
  }
});
test('regular paid upgrade does not reset the trial',async()=>{
  const h=harness('create-checkout-session');await h.request({feature:'plus'});
  assert.equal(h.calls.find(c=>c.name==='checkout').value.subscription_data.trial_period_days,undefined);
});
function subscription(status,cancel=false){return {id:'sub_test',status,customer:'cus_test',metadata:{famos_household_id:'home_test',famos_plan:'pro'},items:{data:[{price:{id:'price_pro',unit_amount:1999,recurring:{interval:'month'}}}]},currency:'cad',trial_end:1800000000,current_period_start:1799395200,current_period_end:1800000000,cancel_at_period_end:cancel,default_payment_method:'pm_test'};}
test('webhook maps trial, paid renewal, scheduled cancellation and expired cancellation',async()=>{
  for(const [status,cancel,expected] of [['trialing',false,'trial'],['active',false,'active'],['trialing',true,'trial'],['canceled',false,'canceled']]){
    const h=harness('stripe-webhook',{event:{type:'customer.subscription.updated',data:{object:subscription(status,cancel)}}});
    assert.equal((await h.request({}, {'stripe-signature':'simulated'})).status,200);
    const sync=h.calls.find(c=>c.name==='upsert_from_stripe').value;
    assert.equal(sync.p_status,expected);assert.equal(sync.p_cancel_at_period_end,cancel);assert.equal(sync.p_plan_key,'pro');assert.equal(sync.p_amount_cents,1999);
  }
});
test('forged webhook signatures cannot mutate entitlements',async()=>{
  const h=harness('stripe-webhook',{badSignature:true});assert.equal((await h.request({}, {'stripe-signature':'bad'})).status,400);assert.equal(h.calls.length,0);
});
test('webhook returns retryable failure if entitlement persistence fails',async()=>{
  const h=harness('stripe-webhook',{rpcError:true,event:{type:'customer.subscription.updated',data:{object:subscription('trialing')}}});
  assert.equal((await h.request({}, {'stripe-signature':'simulated'})).status,500);
});
