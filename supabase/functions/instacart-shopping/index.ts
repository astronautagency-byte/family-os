import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticatedHousehold, consumeUsage, usageLimitResponse } from '../_shared/usage.ts';
import { buildInstacartList, validInstacartLink } from '../_shared/instacartShopping.js';
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'};
const reply = (data: object, status=200) => Response.json(data,{status,headers});
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok',{headers});
  if (request.method !== 'POST') return reply({error:'Method not allowed.'},405);
  try {
    await authenticatedHousehold(request);
    const key = Deno.env.get('INSTACART_API_KEY');
    if (!key || Deno.env.get('INSTACART_ENV') !== 'production') return reply({error:'Instacart list transfer is not available yet. Copy your list to shop manually.',code:'NOT_CONFIGURED'},503);
    const raw = await request.text();
    if (raw.length > 30000) return reply({error:'This list is too large.'},400);
    const payload = buildInstacartList(JSON.parse(raw).items);
    const usage = await consumeUsage(request,'premium_api_operations');
    if (!usage.allowed) return usageLimitResponse(usage,headers);
    const response = await fetch('https://connect.instacart.com/idp/v1/products/products_link',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if (!response.ok) return reply({error:'Instacart could not prepare the list. Please try again or copy it.'},502);
    const result = await response.json();
    if (!validInstacartLink(result.products_link_url)) return reply({error:'Instacart returned an invalid link. Please try again.'},502);
    return reply({url:result.products_link_url});
  } catch (error) {
    if (error instanceof Error && /Sign in|Household not found/.test(error.message)) return reply({error:'Sign in to continue.'},401);
    return reply({error:'Could not prepare the shopping list. Please try again or copy it.'},400);
  }
});
