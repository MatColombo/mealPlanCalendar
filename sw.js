/*
 * Classic service-worker template. Run npm run build before publishing.
 * scripts/dev.mjs compiles this same template for local development.
 * Only the generated, public app-shell inventory enters Cache Storage.
 * Imported plans, backups, shopping data and IndexedDB are never accessed.
 */
const RELEASE = /*__MEAL_PLANNER_RELEASE__*/ null;
const SCOPE_URL = new URL(self.registration.scope);
const CACHE_PREFIX = 'meal-planner-shell:' + encodeURIComponent(SCOPE_URL.pathname) + ':';
const VERSION = RELEASE?.version ?? 'unbuilt';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const READY_URL = new URL('__meal_planner_shell_ready__', SCOPE_URL).href;
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const ASSETS = new Map((RELEASE?.assets ?? []).map(asset => [new URL(asset.url, SCOPE_URL).href, asset]));
let population = null;

function isInScope(value) {
  try {
    const url = new URL(value);
    return url.origin === SCOPE_URL.origin && url.pathname.startsWith(SCOPE_URL.pathname);
  } catch { return false; }
}

async function scopedWindows() {
  return (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter(client => isInScope(client.url));
}

async function appSender(source) {
  if (!source?.id) return null;
  const client = await self.clients.get(source.id);
  return client?.type === 'window' && isInScope(client.url) ? client : null;
}

async function cacheReady() {
  if (!RELEASE || !ASSETS.has(INDEX_URL) || !(await caches.has(CACHE_NAME))) return false;
  const cache = await caches.open(CACHE_NAME);
  const marker = await cache.match(READY_URL);
  if (!marker || await marker.text() !== VERSION) return false;
  const resources = await Promise.all([...ASSETS.keys()].map(url => cache.match(url)));
  return resources.every(Boolean);
}

async function verifiedResponse(url, asset) {
  const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
  if (!response.ok || response.type === 'opaque' || response.redirected) throw new Error('App resource unavailable: ' + asset.url);
  const bytes = await response.clone().arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) throw new Error('App resource belongs to a different release: ' + asset.url);
  return response;
}

/** Verify everything before the first write. Existing good bytes stay intact. */
async function populateShell() {
  if (await cacheReady()) return true;
  if (!RELEASE || !ASSETS.has(INDEX_URL)) throw new Error('Publish the generated service worker from npm run build.');
  const existed = await caches.has(CACHE_NAME);
  try {
    const responses = await Promise.all([...ASSETS].map(async ([url, asset]) => [url, await verifiedResponse(url, asset)]));
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
    // The marker is written last; a partial install never reports readiness.
    await cache.put(READY_URL, new Response(VERSION, { headers: { 'Content-Type': 'text/plain;charset=utf-8' } }));
    return await cacheReady();
  } catch (error) {
    // A failed new installation leaves previous releases untouched. Repair
    // never deletes an existing cache, including usable partial contents.
    if (!existed) await caches.delete(CACHE_NAME).catch(() => {});
    throw error;
  }
}

function ensureShell() {
  if (!population) population = populateShell().finally(() => { population = null; });
  return population;
}

self.addEventListener('install', event => {
  event.waitUntil(ensureShell().then(ready => {
    if (!ready) throw new Error('The app shell is incomplete.');
  }));
  // Updates wait for the page's explicit APPLY_UPDATE message.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep old releases while any old page might still fetch their resources,
    // including the interval between claim and the requesting page's reload.
    if ((await scopedWindows()).length === 0) {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name)));
    }
    await self.clients.claim();
  })());
});

async function cachedResource(url) {
  try {
    if (await caches.has(CACHE_NAME)) {
      const cached = await (await caches.open(CACHE_NAME)).match(url);
      if (cached) return cached;
    }
  } catch { /* A verified network response can still serve this release. */ }
  // Only installation/explicit repair write caches. A miss must not serve
  // newer code inside an older cached shell, even without retaining it.
  try {
    return await verifiedResponse(url, ASSETS.get(url));
  } catch {
    return new Response('Meal Planner: risorsa non disponibile. Riapri l’app quando sei online.\nMeal Planner: resource unavailable. Reopen the app when online.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !isInScope(request.url)) return;
  const url = new URL(request.url);
  // Navigation uses URL fragments, so the only app documents are its root
  // and index.html. Docs, exports and arbitrary paths are not intercepted.
  if (request.mode === 'navigate'
    && (url.pathname === SCOPE_URL.pathname || url.pathname === new URL(INDEX_URL).pathname)) {
    event.respondWith(cachedResource(INDEX_URL));
  } else if (ASSETS.has(url.href)) {
    event.respondWith(cachedResource(url.href));
  }
});

self.addEventListener('message', event => {
  const port = event.ports?.[0];
  if (!port || !['GET_STATUS', 'APPLY_UPDATE', 'REPAIR_CACHE'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'GET_STATUS') {
        port.postMessage({ ready: await cacheReady(), version: VERSION });
        return;
      }
      const sender = await appSender(event.source);
      if (event.data.type === 'REPAIR_CACHE') {
        if (!sender) { port.postMessage({ ready: false, version: VERSION }); return; }
        await ensureShell();
        port.postMessage({ ready: await cacheReady(), version: VERSION });
        return;
      }
      if (!sender) { port.postMessage({ applied: false, reason: 'invalid-client' }); return; }
      if (!await cacheReady()) { port.postMessage({ applied: false, reason: 'not-ready' }); return; }
      const windows = await scopedWindows();
      if (windows.length !== 1 || windows[0].id !== sender.id) {
        port.postMessage({ applied: false, reason: 'other-tabs' });
        return;
      }
      await self.skipWaiting();
      port.postMessage({ applied: true, version: VERSION });
    } catch {
      if (event.data.type === 'APPLY_UPDATE') port.postMessage({ applied: false, reason: 'not-ready' });
      else port.postMessage({ ready: false, version: VERSION });
    }
  })());
});
