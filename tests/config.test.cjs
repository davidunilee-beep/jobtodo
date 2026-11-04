const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/config.js');

function request(env, method = 'GET') {
  const names = [
    'JOBTODO_SUPABASE_URL', 'JOBTODO_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => { delete process.env[name]; });
  Object.assign(process.env, env);
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try { handler({ method }, response); }
  finally {
    names.forEach((name) => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  }
  return response;
}

const publicEnv = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' };
const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.test`;

test('app override replaces an integration project as a complete pair', () => {
  const res = request({ ...publicEnv, JOBTODO_SUPABASE_URL: 'https://other.supabase.co', JOBTODO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { supabaseUrl: 'https://other.supabase.co', supabaseKey: 'sb_publishable_other' });
  assert.equal(request({ ...publicEnv, JOBTODO_SUPABASE_URL: 'https://other.supabase.co' }).code, 503);
  assert.equal(request({ ...publicEnv, JOBTODO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' }).code, 503);
});

test('returns only public configuration and prevents caching', () => {
  const res = request({ ...publicEnv, SUPABASE_SERVICE_ROLE_KEY: 'private-test-marker' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { supabaseUrl: publicEnv.SUPABASE_URL, supabaseKey: publicEnv.SUPABASE_PUBLISHABLE_KEY });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(res.body).includes('private-test-marker'));
});

test('supports integration-prefixed variables and legacy anon keys', () => {
  const key = jwt('anon');
  const res = request({ NEXT_PUBLIC_SUPABASE_URL: publicEnv.SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
  assert.equal(res.code, 200);
  assert.equal(res.body.supabaseKey, key);
});

test('rejects missing, malformed and privileged configuration without leaking values', () => {
  for (const env of [{}, { ...publicEnv, SUPABASE_URL: 'invalid' }, { ...publicEnv, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }, { SUPABASE_URL: publicEnv.SUPABASE_URL, SUPABASE_ANON_KEY: jwt('service_role') }]) {
    const res = request(env);
    assert.equal(res.code, 503);
    assert.deepEqual(Object.keys(res.body), ['error']);
    assert.ok(!JSON.stringify(res.body).includes('sb_secret_private'));
  }
});

test('does not accept write requests', () => {
  const res = request(publicEnv, 'POST');
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, 'GET');
});
