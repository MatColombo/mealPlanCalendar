/*
 * Classic service-worker template. Run npm run build before publishing.
 * scripts/dev.mjs compiles this same template for local development.
 * Only the generated, public app-shell inventory enters Cache Storage.
 * Imported plans, backups, shopping data and IndexedDB are never accessed.
 */
const RELEASE = {"version":"1.3.0+54e533b7af22a6d9","hash":"54e533b7af22a6d993e892349bf80f04e4bb91759af6e964bbf505a708c06bae","assets":[{"url":"examples/release-1.1/meal-plan-it.diet","sha256":"916dcf9f757c497e038c018ec8de6a33fa71e13d422934a3852c8025d8f90c83"},{"url":"index.html","sha256":"446ec691ac8e588ecf8b37114c9fcd4ff7cc1e4409207062124689a3b751a7c4"},{"url":"manifest.webmanifest","sha256":"f0253a6ecf2e9d5a8bd31bb958bbff42a4601cb1d641ce1ec65a6df0ed4eb45a"},{"url":"public/assets/apple-touch-icon.png","sha256":"b7285c6dba53667725942db17eaaa3163cf7f1a03383e8066c6ef001e702ef2d"},{"url":"public/assets/icon-192.png","sha256":"d663e51f179444e6b8539cbd0174c8090549df92bc2c57dffbcb3161fb75b32d"},{"url":"public/assets/icon-512.png","sha256":"16bd1de13c4dd3a93bbc72b13caea5b41a0fdc3ffb341ddccc350ae9b97ff642"},{"url":"public/assets/icon-maskable-512.png","sha256":"6f30d19c6b2a577fa771a94b73959ac65e7442f77428688e70ba9012fd69fcf6"},{"url":"public/assets/meal-bowl.svg","sha256":"3ae5c0628694b1ea9a0416356f187f95a729af975649d7d3d8989e83c1f5fb67"},{"url":"public/assets/sprout.svg","sha256":"cf8acec0f0522122901242cea0d8afa4477d1d3306c78ff16e93a1dba00b56df"},{"url":"src/data/backup.js","sha256":"266fc591de9fec36fb9f940851d323991dd780f240c7350f373f205abd556327"},{"url":"src/data/dates.js","sha256":"210342800600265b75a634fb0bc2fbaca80619b45273adec74d1805842a7fb50"},{"url":"src/data/demo.js","sha256":"e6a018384e9714e2eb1508b5b1612f2bbefce4263a3c879212210af9be01426b"},{"url":"src/data/diet.js","sha256":"ecf3ead2528190bcf93a3b5641f57eca60cf1bcd6958048c690dd6e045af6c6b"},{"url":"src/data/export.js","sha256":"9fcd97cff9d1a1c2107eeda7dc34957367c1069b387ca9459802d49cc8b6608e"},{"url":"src/data/imports.js","sha256":"148e0e5184bbef9de806b64664e32f9356f63d5e0c5f532ee98f7de453275929"},{"url":"src/data/navigation.js","sha256":"df4d3d79fba64ee2a5d1afda9298d2231b4fee3ec0a99e9c6ff529287a826177"},{"url":"src/data/nutrition.js","sha256":"23f035fed31a5cccdc59e804e6625b73bb85b1967d13ce34129a4d022f040215"},{"url":"src/data/provenance.js","sha256":"9aa3d40a85838d2082a0c61b019c1979ea4694118e49ad5d410ad7003acc77ee"},{"url":"src/data/recipes.js","sha256":"ab8d9235aa4fb55e2f06ff8c4ba2989ac6a012b855309a30245353a9d113b03b"},{"url":"src/data/session.js","sha256":"1eefea330904c06d4b87f404894a7e469bac7e34ef5d26e872f1226bd7f00df3"},{"url":"src/data/state.js","sha256":"27fa4eae6586e3d3e354ae9ccb477e6f3e3b521131abe5b47944c411c69125d6"},{"url":"src/data/validation.js","sha256":"a8fc6fe542d7105108042bb48075d2c595a01491ee8987f08c21a3e62d08f58f"},{"url":"src/data/workday.js","sha256":"38d6f953b88b189bfe09ccf960287bf78cc6bdc1764c9c4d46981cf4fb607458"},{"url":"src/main.js","sha256":"7c2a90819c5f8735ac8fbee762834acea04dc3840fd4a6cf77a37e48b20215dd"},{"url":"src/persistence/commit.js","sha256":"7b49ccea650f92da3492499e60acaa7a5c075dfc2786716e2aa4c78934e7b624"},{"url":"src/persistence/indexeddb.js","sha256":"37256409788d5252d319d512aa2d0054a54b81abed6e7618fbd861ef9c243b66"},{"url":"src/persistence/migrations.js","sha256":"353e8fdfca04d9c6e1193988915086181608f60e86a86f4f808727d38812b3ab"},{"url":"src/persistence/repository.js","sha256":"62111ba7de4ed698acfece8ffbac0bd85c4d44daa6f66ff390f30ffedb7613da"},{"url":"src/pwa/client.js","sha256":"be7904959835aff110de31829419ab4268b2eb60a4924f199685105b9ee0f851"},{"url":"src/shopping/categories.js","sha256":"73a7002e354c88d0e82327c8716759f489ab08a9429505d0a495d2c6f7f2312f"},{"url":"src/shopping/list.js","sha256":"9a701f253152d6ba6c8bb87091bb96b5c5df74084ea5bc4d4b4aa70a7942c8fd"},{"url":"src/shopping/quantities.js","sha256":"a99068fe3aa676e4d7c977c754fee075982963ea789f9402182072e4ac9bad1c"},{"url":"src/ui/compact.css","sha256":"b7daa584058244fa724b2fad1eb2916616dd63199da9bc30b5e324c7d788deda"},{"url":"src/ui/components.js","sha256":"ecd5240b1555ca0196ce60ef35d6dfdfcb651c69567e9c9f599c4151930e6d5f"},{"url":"src/ui/i18n.js","sha256":"83cb457553cbe0bfab9b856ec152771f88656cbf01cf46042d8516bfa220e94d"},{"url":"src/ui/icons.js","sha256":"44a4db3b02b4b5927c50e5e5cd9269a4d1be428477350c51e45698fab12ff57b"},{"url":"src/ui/locales/en.js","sha256":"0e47500ee4ad3ab9f2c14531675f3d0c329cc24faa94ccd88ce72f3206ad0f7a"},{"url":"src/ui/locales/it.js","sha256":"aa8a93a20289fc41adfb88f94e4b2e1230acf07119395699d9de775412740c68"},{"url":"src/ui/motion.js","sha256":"a38fabb26cbffa2bef4d821bd5bab26a50653c47915387f95d3165c20b80988b"},{"url":"src/ui/recipes-view.js","sha256":"f5cb2501ead46d508ed8a136765b716bf6e87088faba4e8bb9d87e88dceee9b7"},{"url":"src/ui/render.js","sha256":"92b5eeba5065c624a17476964b7d846c2fd5b4bcd61ab2fdef1708b6b7b0d9e5"},{"url":"src/ui/scroll.js","sha256":"feea2b1846458630a9bfe31ed5f922c737c3154dac3db51d95f953716b3d9474"},{"url":"src/ui/shopping-output.js","sha256":"202d88f8e6a26b7f1e532d861bc46f6e23f4dfb04d21a168377c0c66bbc6cd24"},{"url":"src/ui/styles.css","sha256":"9b43fb72039897f5ff6bbecb5274dbfc6793f0f9bd5fdab807826381bee70e56"},{"url":"src/ui/tokens.css","sha256":"7028df7e23deaaba536c3be2c9682b144c43dc58a5242b0539cb21323b83a5e7"}]};
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
