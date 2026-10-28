import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;
const source = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const secret = 'local-test-secret';
const makeRequest = (body, signature = '') => new Request('https://example.com/api/stripe/webhook', {
  method: 'POST', body, headers: { 'Stripe-Signature': signature }
});
assert.equal((await worker.fetch(makeRequest('{}'), {})).status, 503);
assert.equal((await worker.fetch(makeRequest('{}'), { STRIPE_WEBHOOK_SECRET: secret })).status, 400);
async function sign(body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `t=${timestamp},v1=${Buffer.from(digest).toString('hex')}`;
}
assert.equal((await worker.fetch(makeRequest('{}', await sign('{}', 'invalid')), { STRIPE_WEBHOOK_SECRET: secret })).status, 400);
assert.equal((await worker.fetch(makeRequest('{}', await sign('{}', '1')), { STRIPE_WEBHOOK_SECRET: secret })).status, 400);
assert.equal((await worker.fetch(makeRequest('invalid-json', await sign('invalid-json')), { STRIPE_WEBHOOK_SECRET: secret })).status, 400);
const body = JSON.stringify({ id: 'evt_local', type: 'audit.ignored', data: { object: {} } });
let writes = 0;
const DB = { prepare() { return { bind() { return { first: async () => null, run: async () => { writes++; } }; } }; } };
assert.equal((await worker.fetch(makeRequest(body, await sign(body)), { STRIPE_WEBHOOK_SECRET: secret, DB })).status, 200);
assert.equal(writes, 1);
console.log('Webhook checks passed: missing secret, unsigned, invalid/stale timestamp, malformed JSON, and valid signature.');
