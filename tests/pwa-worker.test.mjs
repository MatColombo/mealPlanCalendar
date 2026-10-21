import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { compileServiceWorker, createPwaWorker, createReleaseMetadata } from '../scripts/pwa-build.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TEMPLATE = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = (suffix = 'first') => ({
  'index.html': `<html>${suffix}</html>`,
  'src/main.js': `/* main ${suffix} */`,
  'src/ui/locales/it.js': '/* italiano */',
  'src/ui/locales/en.js': '/* English */',
  'src/ui/styles.css': 'body { color: green; }',
  'public/assets/icon-192.png': 'synthetic icon bytes',
  'manifest.webmanifest': '{"display":"standalone"}',
  'examples/phase-3/ui-demo-it.diet': '{"demo":true}',
});

class CacheStorageDouble {
  entries = new Map();
  failPut = new Set();
  deleted = [];
  async has(name) { return this.entries.has(name); }
  async keys() { return [...this.entries.keys()]; }
  async delete(name) { this.deleted.push(name); return this.entries.delete(name); }
  async open(name) {
    if (!this.entries.has(name)) this.entries.set(name, new Map());
    const entries = this.entries.get(name);
    const key = request => typeof request === 'string' ? request : request.url;
    return {
      match: async request => entries.get(key(request))?.clone(),
      put: async (request, response) => {
        if (this.failPut.has(key(request))) throw new Error('Synthetic cache write failure.');
        entries.set(key(request), response.clone());
      },
      delete: async request => entries.delete(key(request)),
    };
  }
}

function worker({ scope = 'https://example.test/meal-planner/', files = fixture(), caches = new CacheStorageDouble() } = {}) {
  const assets = Object.entries(files).map(([url, body]) => ({ url, sha256: hash(body) }));
  const release = createReleaseMetadata({ version: '0.7.0', assets, template: TEMPLATE });
  const listeners = new Map();
  const network = { offline: false, missing: new Set(), corrupt: new Set(), calls: [] };
  const clients = { windows: [{ id: 'main', type: 'window', url: scope + '#shopping' }], calls: [], claimed: 0 };
  let skipped = 0;
  const context = vm.createContext({
    URL, Request, Response, crypto: webcrypto, caches,
    indexedDB: { open() { throw new Error('The shell worker must never open IndexedDB.'); } },
    fetch: async request => {
      const url = typeof request === 'string' ? request : request.url;
      network.calls.push({ url, cache: request.cache });
      if (network.offline) throw new Error('Synthetic offline network.');
      const relative = url.startsWith(scope) ? url.slice(scope.length) : null;
      if (network.missing.has(url) || !Object.hasOwn(files, relative)) return new Response('Missing', { status: 404 });
      return new Response(network.corrupt.has(url) ? 'bytes from another release' : files[relative]);
    },
    self: {
      registration: { scope },
      clients: {
        matchAll: async options => { clients.calls.push(structuredClone(options)); return [...clients.windows]; },
        get: async id => clients.windows.find(client => client.id === id),
        claim: async () => { clients.claimed += 1; },
      },
      skipWaiting: async () => { skipped += 1; },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
  });
  vm.runInContext(compileServiceWorker(TEMPLATE, release), context, { filename: 'generated-sw.js' });
  async function dispatch(name, fields = {}) {
    const pending = [];
    listeners.get(name)({ ...fields, waitUntil: promise => pending.push(promise) });
    await Promise.all(pending);
  }
  return {
    scope, release, caches, network, clients,
    get skipped() { return skipped; },
    cacheName: 'meal-planner-shell:' + encodeURIComponent(new URL(scope).pathname) + ':' + release.version,
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    message: async (type, source = { id: 'main' }) => {
      let reply;
      await dispatch('message', { data: { type }, source, ports: [{ postMessage: value => { reply = structuredClone(value); } }] });
      return reply;
    },
    fetch: async (url, { mode = 'cors', method = 'GET' } = {}) => {
      let response;
      listeners.get('fetch')({ request: { url, method, mode }, respondWith: promise => { response = promise; } });
      return { handled: response !== undefined, response: response === undefined ? null : await response };
    },
  };
}

test('release generation inventories local dependencies and includes every content and worker change in its version', async () => {
  const { release, worker: generated } = await createPwaWorker(ROOT);
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  // Per the manifest algorithm, an omitted id inherits the processed start_url.
  // `id: './'` would instead resolve against the origin and collapse subpaths.
  assert.equal(Object.hasOwn(manifest, 'id'), false);
  for (const scope of ['https://example.test/', 'https://example.test/meal-planner/']) {
    const manifestUrl = new URL('manifest.webmanifest', scope);
    assert.equal(new URL(manifest.start_url, manifestUrl).href, scope);
    assert.equal(new URL(manifest.scope, manifestUrl).href, scope);
  }
  const urls = new Set(release.assets.map(asset => asset.url));
  for (const required of ['index.html', 'manifest.webmanifest', 'src/main.js', 'src/ui/styles.css', 'src/ui/tokens.css',
    'src/ui/locales/it.js', 'src/ui/locales/en.js', 'public/assets/icon-192.png', 'public/assets/icon-512.png',
    'public/assets/icon-maskable-512.png', 'public/assets/apple-touch-icon.png', 'examples/release-1.1/meal-plan-it.diet',
    'src/ui/recipes-view.js', 'src/ui/motion.js', 'src/data/nutrition.js', 'src/data/workday.js']) {
    assert.ok(urls.has(required), required);
  }
  assert.ok(!urls.has('sw.js'));
  assert.ok(!urls.has('examples/phase-6/shopping-backup.json'));
  assert.ok(![...urls].some(url => url.startsWith('docs/')));
  assert.ok(release.assets.every(asset => /^[a-f0-9]{64}$/.test(asset.sha256)));
  assert.ok(!generated.includes('/*__MEAL_PLANNER_RELEASE__*/ null'));
  const metadata = { version: '0.7.0', assets: [{ url: 'index.html', sha256: hash('first') }], template: TEMPLATE };
  const original = createReleaseMetadata(metadata);
  assert.deepEqual(createReleaseMetadata(metadata), original);
  assert.notEqual(createReleaseMetadata({ ...metadata, template: TEMPLATE + '\n// updated behavior' }).version, original.version);
  assert.notEqual(createReleaseMetadata({ ...metadata, assets: [{ url: 'index.html', sha256: hash('second') }] }).version, original.version);
  assert.notEqual(createReleaseMetadata({ ...metadata, version: '0.7.1' }).version, original.version);
});

test('complete root and project shells serve offline navigation and known assets without caching personal or unrelated requests', async () => {
  for (const scope of ['https://example.test/', 'https://example.test/meal-planner/']) {
    const runtime = worker({ scope });
    assert.deepEqual(await runtime.message('GET_STATUS'), { ready: false, version: runtime.release.version });
    await runtime.install();
    assert.equal(runtime.skipped, 0);
    assert.ok(runtime.network.calls.every(call => call.cache === 'reload'));
    assert.equal(runtime.network.calls.length, runtime.release.assets.length);
    assert.deepEqual(await runtime.message('GET_STATUS'), { ready: true, version: runtime.release.version });
    runtime.network.offline = true;
    for (const url of [scope, scope + '?launch=pwa', scope + 'index.html']) {
      const result = await runtime.fetch(url, { mode: 'navigate' });
      assert.equal(result.handled, true);
      assert.equal(await result.response.text(), fixture()['index.html']);
    }
    for (const asset of runtime.release.assets) {
      const result = await runtime.fetch(new URL(asset.url, scope).href);
      assert.equal(result.handled, true);
      assert.equal(await result.response.text(), fixture()[asset.url]);
    }
    const count = runtime.network.calls.length;
    for (const [url, options] of [
      [scope + 'personal-backup.json'], [scope + 'uploaded.diet'], [scope + 'docs/DIET_FORMAT.md', { mode: 'navigate' }],
      [scope + 'src/main.js?private=1'], ['https://other.test/index.html'], [scope + 'src/main.js', { method: 'POST' }],
    ]) assert.equal((await runtime.fetch(url, options)).handled, false);
    assert.equal(runtime.network.calls.length, count);
    assert.deepEqual(await runtime.caches.keys(), [runtime.cacheName]);
  }
});

test('failed downloads, mixed release bytes and failed cache writes leave the previous complete release intact', async () => {
  for (const failure of ['missing', 'corrupt', 'write']) {
    const old = worker();
    await old.install();
    const next = worker({ files: fixture('second'), caches: old.caches });
    const target = next.scope + 'src/main.js';
    if (failure === 'write') next.caches.failPut.add(target);
    else next.network[failure].add(target);
    await assert.rejects(next.install());
    assert.deepEqual(await old.message('GET_STATUS'), { ready: true, version: old.release.version });
    assert.deepEqual(await next.message('GET_STATUS'), { ready: false, version: next.release.version });
    assert.equal(await (await (await old.caches.open(old.cacheName)).match(old.scope + 'src/main.js')).text(), fixture()['src/main.js']);
    assert.equal(await old.caches.has(next.cacheName), false);
    assert.equal(next.skipped, 0);
  }
});

test('evicted resources only fall back to verified bytes from the same release and never refill the cache implicitly', async () => {
  const runtime = worker();
  await runtime.install();
  const cache = await runtime.caches.open(runtime.cacheName);
  for (const [resource, requestedUrl, options] of [
    ['src/main.js', runtime.scope + 'src/main.js', {}],
    ['index.html', runtime.scope + '?launch=pwa', { mode: 'navigate' }],
  ]) {
    const canonicalUrl = runtime.scope + resource;
    await cache.delete(canonicalUrl);
    const available = await runtime.fetch(requestedUrl, options);
    assert.equal(available.response.status, 200);
    assert.equal(await available.response.text(), fixture()[resource]);
    assert.deepEqual(runtime.network.calls.at(-1), { url: canonicalUrl, cache: 'reload' });
    assert.equal(await cache.match(canonicalUrl), undefined);
    runtime.network.corrupt.add(canonicalUrl);
    const newer = await runtime.fetch(requestedUrl, options);
    assert.equal(newer.response.status, 503);
    assert.ok(!(await newer.response.text()).includes('bytes from another release'));
    runtime.network.corrupt.delete(canonicalUrl);
    runtime.network.offline = true;
    assert.equal((await runtime.fetch(requestedUrl, options)).response.status, 503);
    runtime.network.offline = false;
    assert.equal(await cache.match(canonicalUrl), undefined);
  }
  assert.deepEqual(await runtime.message('GET_STATUS'), { ready: false, version: runtime.release.version });
  assert.equal(await (await cache.match(runtime.scope + 'src/ui/locales/it.js')).text(), fixture()['src/ui/locales/it.js']);
});

test('an update requires a complete cache and exactly the requesting window, including uncontrolled app windows', async () => {
  const runtime = worker();
  assert.deepEqual(await runtime.message('APPLY_UPDATE'), { applied: false, reason: 'not-ready' });
  await runtime.install();
  assert.deepEqual(await runtime.message('APPLY_UPDATE', { id: 'unknown' }), { applied: false, reason: 'invalid-client' });
  runtime.clients.windows.push({ id: 'second', type: 'window', url: runtime.scope + '#today' });
  assert.deepEqual(await runtime.message('APPLY_UPDATE'), { applied: false, reason: 'other-tabs' });
  assert.equal(runtime.skipped, 0);
  assert.deepEqual(runtime.clients.calls.at(-1), { type: 'window', includeUncontrolled: true });
  runtime.clients.windows[1] = { id: 'unrelated', type: 'window', url: 'https://example.test/another-app/' };
  assert.deepEqual(await runtime.message('APPLY_UPDATE', { id: 'unrelated' }), { applied: false, reason: 'invalid-client' });
  assert.deepEqual(await runtime.message('APPLY_UPDATE'), { applied: true, version: runtime.release.version });
  assert.equal(runtime.skipped, 1);
});

test('activation keeps prior releases for live pages and only cleans its own scope when no app window remains', async () => {
  const old = worker();
  await old.install();
  const next = worker({ files: fixture('second'), caches: old.caches });
  await next.install();
  const other = worker({ scope: 'https://example.test/another-app/', caches: old.caches });
  await other.install();
  await old.caches.open('another-product-cache');
  await next.activate();
  assert.equal(await old.caches.has(old.cacheName), true);
  assert.equal(next.clients.claimed, 1);
  next.clients.windows = [{ id: 'outside', type: 'window', url: 'https://example.test/another-app/' }];
  await next.activate();
  assert.equal(await old.caches.has(old.cacheName), false);
  assert.equal(await old.caches.has(next.cacheName), true);
  assert.equal(await old.caches.has(other.cacheName), true);
  assert.equal(await old.caches.has('another-product-cache'), true);
  assert.equal(next.clients.claimed, 2);
});

test('explicit cache repair is coalesced, reports incomplete shells and preserves usable assets on failure', async () => {
  const runtime = worker();
  await runtime.install();
  const cache = await runtime.caches.open(runtime.cacheName);
  const missing = runtime.scope + 'src/ui/locales/en.js';
  const preserved = runtime.scope + 'index.html';
  await cache.delete(missing);
  assert.deepEqual(await runtime.message('GET_STATUS'), { ready: false, version: runtime.release.version });
  runtime.network.missing.add(missing);
  assert.deepEqual(await runtime.message('REPAIR_CACHE'), { ready: false, version: runtime.release.version });
  assert.equal(await (await cache.match(preserved)).text(), fixture()['index.html']);
  runtime.network.missing.clear();
  const before = runtime.network.calls.length;
  const replies = await Promise.all([runtime.message('REPAIR_CACHE'), runtime.message('REPAIR_CACHE')]);
  assert.ok(replies.every(reply => reply.ready && reply.version === runtime.release.version));
  assert.equal(runtime.network.calls.length - before, runtime.release.assets.length);
  assert.equal(await (await cache.match(missing)).text(), fixture()['src/ui/locales/en.js']);
  assert.deepEqual(await runtime.message('GET_STATUS'), { ready: true, version: runtime.release.version });
  const calls = runtime.network.calls.length;
  assert.deepEqual(await runtime.message('REPAIR_CACHE', { id: 'outside' }), { ready: false, version: runtime.release.version });
  assert.equal(runtime.network.calls.length, calls);
});
