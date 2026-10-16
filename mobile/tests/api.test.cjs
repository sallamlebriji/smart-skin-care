const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Compile the actual transport without loading React Native in the Node test runner.
const filename = path.resolve(__dirname, '../src/lib/api.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { MobileApi, normalizeEndpoint, measuredMetrics } = loaded.exports;
const user = { id: 'u1', email: 'one@example.com' };
const tokens = n => ({ user, access_token: `access${n}`, refresh_token: `refresh${n}` });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('server origin validation prevents credentials, path and query leakage', () => {
  assert.equal(normalizeEndpoint(' http://10.0.2.2:8001/ '), 'http://10.0.2.2:8001');
  for (const value of ['file:///data', 'https://a:b@example.com', 'https://example.com/api', 'https://example.com?token=x']) {
    assert.throws(() => normalizeEndpoint(value));
  }
});

test('concurrent unauthorized requests rotate once and never send cookies', async () => {
  let rotations = 0;
  const saved = [];
  const api = new MobileApi('https://api.example.com', { save: async data => saved.push(data) }, () => {}, async (url, init) => {
    assert.equal(init.credentials, 'omit');
    if (url.endsWith('/login')) return json(tokens(1));
    if (url.endsWith('/refresh')) {
      rotations++;
      assert.equal(JSON.parse(init.body).refresh_token, 'refresh1');
      await new Promise(resolve => setTimeout(resolve, 10));
      return json(tokens(2));
    }
    assert.equal(init.headers['X-Account-Session'], 'true');
    return init.headers.Authorization === 'Bearer access2' ? json({ ok: true }) : json({ detail: 'Expired' }, 401);
  });
  await api.authenticate('login', user.email, 'password');
  const results = await Promise.all([api.request('/scans'), api.request('/profile')]);
  assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  assert.equal(rotations, 1);
  assert.equal(saved.at(-1).refreshToken, 'refresh2');
});

test('logout revokes the rotated token and late responses cannot reopen a session', async () => {
  let finish;
  const saved = [];
  const api = new MobileApi('https://api.example.com', { save: async value => saved.push(value) }, () => {}, async (url, init) => {
    if (url.endsWith('/login')) return json(tokens(1));
    if (url.endsWith('/logout')) {
      assert.equal(JSON.parse(init.body).refresh_token, 'refresh1');
      return new Response(null, { status: 204 });
    }
    return new Promise(resolve => { finish = () => resolve(json({ private: true })); });
  });
  await api.authenticate('login', user.email, 'password');
  const pending = api.request('/scans');
  await api.logout();
  finish();
  await assert.rejects(pending, /Session closed/);
  await assert.rejects(api.request('/profile'), /Session closed/);
  assert.deepEqual(saved.at(-1), { endpoint: 'https://api.example.com' });
});

test('invalid refresh clears secure storage; transient failures preserve it', async () => {
  for (const status of [401, 503]) {
    const saved = [];
    let expired = 0;
    const api = new MobileApi('https://api.example.com', { save: async value => saved.push(value) }, () => expired++, async () => json({ detail: 'Unavailable' }, status));
    await assert.rejects(api.restore('saved-refresh'));
    assert.equal(expired, status === 401 ? 1 : 0);
    assert.equal(saved.length, status === 401 ? 1 : 0);
  }
});

test('secure storage failure does not expose an authenticated session', async () => {
  const api = new MobileApi('https://api.example.com', { save: async () => { throw new Error('Storage locked'); } }, () => {}, async () => json(tokens(1)));
  await assert.rejects(api.authenticate('login', user.email, 'password'), /Storage locked/);
});

test('simulated indicators cannot appear in measured comparisons', () => {
  assert.deepEqual(measuredMetrics({ result: { metrics: { acne: 58, wrinkles: 99 }, mock_metrics: ['wrinkles'] } }), { acne: 58 });
  assert.deepEqual(measuredMetrics({}), {});
});
