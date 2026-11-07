import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../supabase/functions/google-calendar-token/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*;$/m, '')
  .replace('body: Record<string, unknown>', 'body');
function endpoint({ readError = null, invalidGrant = false } = {}) {
  let handler;
  const filters = [];
  const db = {
    select() { return this; }, delete() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    async maybeSingle() { return { data: { refresh_token: 'old-token' }, error: readError }; },
    then(resolve) { resolve({ error: null }); },
  };
  vm.runInNewContext(source, {
    Deno: { env: { get: () => 'test-config' }, serve: fn => { handler = fn; } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: () => db }),
    Response, URLSearchParams, AbortController, DOMException, setTimeout, clearTimeout,
    console: { error() {} },
    fetch: async () => new Response(JSON.stringify(invalidGrant ? { error: 'invalid_grant' } : { access_token: 'access' }), { status: invalidGrant ? 400 : 200 }),
  });
  return { filters, call: action => handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ action }) })) };
}
test('token responses cannot be cached', async () => {
  const response = await endpoint().call('token');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('storage outages do not pretend the user revoked calendar permission', async () => {
  for (const action of ['status', 'token']) {
    const response = await endpoint({ readError: { message: 'private database detail' } }).call(action);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private database detail|reconnect_required/);
  }
});
test('an expired token cannot delete a concurrently replaced credential', async () => {
  const api = endpoint({ invalidGrant: true });
  const response = await api.call('token');
  assert.equal(response.status, 409);
  assert.ok(api.filters.some(([key, value]) => key === 'refresh_token' && value === 'old-token'));
});
test('unknown actions fail closed', async () => {
  assert.equal((await endpoint().call('surprise')).status, 400);
});

test('a deferred credential upload cannot run under a different signed-in account', async () => {
  const code = fs.readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  const invokeCode = code.slice(code.indexOf('export async function invokeEdgeFunction')).replace('export async function', 'async function');
  let sent = false;
  const context = vm.createContext({
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'new-account', user: { id: 'different-owner' } } } }) } },
    supabaseUrl: 'https://example.com', supabaseKey: 'public-key',
    fetch: async () => { sent = true; },
  });
  vm.runInContext(invokeCode, context);
  await assert.rejects(context.invokeEdgeFunction('google-calendar-token', { action: 'store', refresh_token: 'original-owner-token' }, { expectedUserId: 'original-owner' }), /Account changed/);
  assert.equal(sent, false);
});
