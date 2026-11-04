const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../auth.js'), 'utf8');

// A small DOM adapter exercises UI behavior against controlled Supabase responses.
function setup({ session = null, configError = false } = {}) {
  const selectors = ['auth-dialog', 'auth-feedback', 'auth-submit', 'login-mode', 'signup-mode', 'auth-email', 'auth-password', 'auth-form', 'auth-title', 'auth-description', 'password-help', 'open-auth', 'account-email', 'logout', 'close-auth'];
  const elements = Object.fromEntries(selectors.map((id) => [id, {
    value: '', textContent: '', hidden: ['account-email', 'logout', 'password-help'].includes(id), disabled: false, attrs: {}, events: {},
    classList: { toggle() {} }, setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { this.events[name] = handler; },
    async emit(name) { return this.events[name]?.({ preventDefault() {}, target: this }); },
    showModal() { this.open = true; }, close() { this.open = false; this.events.close?.(); },
    focus() {}, reportValidity() { return true; }, reset() {}
  }]));
  const calls = [];
  let listener;
  const api = {
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    async getSession() { return { data: { session }, error: null }; },
    async signInWithPassword(input) { calls.push(['login', input]); return { data: { session: { user: { email: input.email } } }, error: null }; },
    async signUp(input) { calls.push(['signup', input]); return { data: { session: null }, error: null }; },
    async signOut(input) { calls.push(['logout', input]); listener('SIGNED_OUT', null); return { error: null }; }
  };
  const context = vm.createContext({
    document: { querySelector(selector) { return elements[selector.slice(1)]; } },
    window: { supabase: { createClient() { return { auth: api }; } } },
    location: { protocol: 'https:', origin: 'https://jobtodo.example' },
    AbortSignal, setTimeout, clearTimeout,
    async fetch() { return { ok: !configError, async json() { return configError ? { error: '설정 누락' } : { supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test' }; } }; }
  });
  vm.runInContext(source, context);
  return { elements, calls, api, settle: () => new Promise(setImmediate) };
}

test('restores a session, displays email, and logs out', async () => {
  const { elements: e, calls, settle } = setup({ session: { user: { email: 'test@example.com' } } });
  await settle();
  assert.equal(e['open-auth'].hidden, true);
  assert.equal(e['account-email'].textContent, 'test@example.com');
  assert.equal(e.logout.hidden, false);
  await e.logout.emit('click');
  assert.equal(e['open-auth'].hidden, false);
  assert.equal(e['account-email'].textContent, '');
  assert.equal(calls[0][0], 'logout');
  assert.equal(e.logout.disabled, false);
});

test('password login closes popup and clears password', async () => {
  const { elements: e, calls, settle } = setup();
  await settle();
  await e['open-auth'].emit('click');
  e['auth-email'].value = 'test@example.com';
  e['auth-password'].value = 'test-password';
  await e['auth-form'].emit('submit');
  assert.equal(calls[0][0], 'login');
  assert.equal(e['auth-dialog'].open, false);
  assert.equal(e['account-email'].textContent, 'test@example.com');
  assert.equal(e['auth-password'].value, '');
});

test('signup without session requests email confirmation and stays logged out', async () => {
  const { elements: e, calls, settle } = setup();
  await settle();
  await e['open-auth'].emit('click');
  await e['signup-mode'].emit('click');
  e['auth-email'].value = 'new@example.com';
  e['auth-password'].value = 'test-password';
  await e['auth-form'].emit('submit');
  assert.equal(e['auth-password'].minLength, 8);
  assert.equal(calls[0][0], 'signup');
  assert.equal(calls[0][1].options.emailRedirectTo, 'https://jobtodo.example/');
  assert.match(e['auth-feedback'].textContent, /인증 메일/);
  assert.equal(e['open-auth'].hidden, false);
  assert.equal(e['auth-dialog'].open, true);
});

test('signup with an immediate session logs in', async () => {
  const { elements: e, api, settle } = setup();
  await settle();
  api.signUp = async () => ({ data: { session: { user: { email: 'new@example.com' } } }, error: null });
  await e['open-auth'].emit('click');
  await e['signup-mode'].emit('click');
  await e['auth-form'].emit('submit');
  assert.equal(e['auth-dialog'].open, false);
  assert.equal(e['account-email'].textContent, 'new@example.com');
});

test('failed credentials show a useful error and leave the form usable', async () => {
  const { elements: e, api, settle } = setup();
  await settle();
  api.signInWithPassword = async () => ({ data: {}, error: { code: 'invalid_credentials' } });
  await e['open-auth'].emit('click');
  await e['auth-form'].emit('submit');
  assert.match(e['auth-feedback'].textContent, /올바르지/);
  assert.equal(e['auth-submit'].disabled, false);
  assert.equal(e['open-auth'].hidden, false);
});

test('missing server configuration shows an error without blocking the UI', async () => {
  const { elements: e, settle } = setup({ configError: true });
  await settle();
  await e['open-auth'].emit('click');
  await e['auth-form'].emit('submit');
  assert.equal(e['auth-feedback'].textContent, '설정 누락');
  assert.equal(e['auth-submit'].disabled, false);
});
