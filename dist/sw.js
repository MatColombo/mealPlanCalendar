/*
 * Classic service-worker template. Run npm run build before publishing.
 * scripts/dev.mjs compiles this same template for local development.
 * Only the generated, public app-shell inventory enters Cache Storage.
 * Imported plans, backups, shopping data and IndexedDB are never accessed.
 */
const RELEASE = {"version":"1.0.0+e09efecc821d5246","hash":"e09efecc821d5246ee18adaee30fbec1d62bdcbece82ec112abe0f21a1cda5d7","assets":[{"url":"examples/phase-3/ui-demo-it.diet","sha256":"d30173d82b5c24646293dda96f99a4931c7397a5f0ecad710875757750ba3c61"},{"url":"index.html","sha256":"ba7707824789070ae89dbc297aa8990fb8545f52dd67a2df273017709293d3a4"},{"url":"manifest.webmanifest","sha256":"2dc0471431a1ed8d241500c6e9d9b641dde7d268ccd586bb7a69277afe315f96"},{"url":"public/assets/apple-touch-icon.png","sha256":"b7285c6dba53667725942db17eaaa3163cf7f1a03383e8066c6ef001e702ef2d"},{"url":"public/assets/icon-192.png","sha256":"d663e51f179444e6b8539cbd0174c8090549df92bc2c57dffbcb3161fb75b32d"},{"url":"public/assets/icon-512.png","sha256":"16bd1de13c4dd3a93bbc72b13caea5b41a0fdc3ffb341ddccc350ae9b97ff642"},{"url":"public/assets/icon-maskable-512.png","sha256":"6f30d19c6b2a577fa771a94b73959ac65e7442f77428688e70ba9012fd69fcf6"},{"url":"public/assets/meal-bowl.svg","sha256":"a2f5319a55201be39a97b7c6767ebb284c1660ee1f698bd7039d6358c196a36a"},{"url":"public/assets/sprout.svg","sha256":"45a3306681e03eb6bf6f586a87d65193f547e29a7254edd7d0524500927ffcb7"},{"url":"src/data/backup.js","sha256":"4fad4f8c765c32ebca4266e5478d8fff874fe54ca4c5bafeb196f8b149b07fb5"},{"url":"src/data/dates.js","sha256":"68b0406d5127e3266b06a79ea6cd36ced0a6ac911c599c3bf08ca83be692e97f"},{"url":"src/data/demo.js","sha256":"c5f54149f7e09793b96df0ea71294f83c43ce8bbd338dd33b95287f87c0007a3"},{"url":"src/data/diet.js","sha256":"761b9050c9492ac04434c54f6aa6fd7892c1f9cea38817488791e77595bf8438"},{"url":"src/data/export.js","sha256":"e9aee1840e95ccd996e1c067f074cf38541f5e2a4328dfdc9275fe89527ab9b3"},{"url":"src/data/imports.js","sha256":"56f79bd372723edca41e2112de6bc6ba65a5843d659f2dba2790268abedc16ac"},{"url":"src/data/navigation.js","sha256":"d59f9c2ed83b02c734f7921a29463095c64bd58f4a6076a6d1087204756c07d1"},{"url":"src/data/provenance.js","sha256":"0c79b2a1414bacd8b970444be2547d7f0030a2f54327199975fd5911878eaf62"},{"url":"src/data/session.js","sha256":"83d4f27db7e6b4bf1715fc4756fb4f428a726c81b497f2af73f628d657c0c0f6"},{"url":"src/data/state.js","sha256":"3200c1a883bdb474779499b6bc418145a9ae1621bc1ea7e746b5afb4b04b97e4"},{"url":"src/data/validation.js","sha256":"3cc3c787097f2d37f038059812dc4829814765f8f6d1a3cbffb7fdc8541e6f36"},{"url":"src/main.js","sha256":"19ed90e5c95dbe511b1802ee063f2a4bd045ae655c1eb577078b5937e6bd0780"},{"url":"src/persistence/commit.js","sha256":"213ae354d30300fcf340f7da75d52eef92c58a32b65b70239c9d88317ed8cab6"},{"url":"src/persistence/indexeddb.js","sha256":"d9fc781023e7f177b102aa9dce8a753d4bb69116cc40b907b9160533dc9cb868"},{"url":"src/persistence/migrations.js","sha256":"e8e98750c8370f84b4cf3945dc8c85e43e012655c3d804e4d06e5aee0ec6fa09"},{"url":"src/persistence/repository.js","sha256":"5f560174303849e4d33e098a76d4476455ac80bb8ee157aabf26fff021f76e59"},{"url":"src/pwa/client.js","sha256":"44e4ede0365f7598489efb106abd0f3f89d13f1ee1673fb6e8537d171674c6ed"},{"url":"src/shopping/list.js","sha256":"bb9a9aef7e3f340856aa31f9139efe76cc0dacd1a7f1f10e331669115d32bda2"},{"url":"src/shopping/quantities.js","sha256":"0afb73a5c2e5caac35302cae2067a9ca3583f45a336e9064a1c68e6b086f9875"},{"url":"src/ui/components.js","sha256":"f6742b3040bc402a9dba2a3e78b4c38bf8233655426c865f5b69de5ecd26932e"},{"url":"src/ui/i18n.js","sha256":"735a80edfc7ba331722b1e77b55683a087443db4e5b502d04a24ddc318551476"},{"url":"src/ui/icons.js","sha256":"71946d882091be33375581918057eca3e2e89bf721e2f626f8cd2226e0c3336b"},{"url":"src/ui/locales/en.js","sha256":"7022b736680ef532488acc5bc640938e69b42158feb85f8d962413d43bfc0a86"},{"url":"src/ui/locales/it.js","sha256":"6b4e22ac2656f91df7ef6265c1da782b574f491dda504096c27d10bb3d01e734"},{"url":"src/ui/render.js","sha256":"43cbaf3db1352b91cabd9b7b56b1b98510b6a9726436afe6cb17fb6a0ba9e3df"},{"url":"src/ui/shopping-output.js","sha256":"d6402e75b74d49f163cdbbcc7b7b5a13f5812b999beb100cd4af73ddb9be817c"},{"url":"src/ui/styles.css","sha256":"a2e4f6b292b93c65a863533c21427c36817c74e4f7a8844410b74973649e198a"},{"url":"src/ui/tokens.css","sha256":"43dbeb4dc9fa6edf9c0102269dc6d03621509a91d94ff8a69fc9a7d1c9478e0f"}]};
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
