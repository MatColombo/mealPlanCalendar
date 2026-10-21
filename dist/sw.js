/*
 * Classic service-worker template. Run npm run build before publishing.
 * scripts/dev.mjs compiles this same template for local development.
 * Only the generated, public app-shell inventory enters Cache Storage.
 * Imported plans, backups, shopping data and IndexedDB are never accessed.
 */
const RELEASE = {"version":"1.2.0+4bdb7c8cfc811d0a","hash":"4bdb7c8cfc811d0ae97cbc781b2c69112844e778b4138a3df374914786efbce2","assets":[{"url":"examples/release-1.1/meal-plan-it.diet","sha256":"cae67667a60e8566ba9ee1a494f5ba80b19351e36d99a19ce92f255eaad560ae"},{"url":"index.html","sha256":"446ec691ac8e588ecf8b37114c9fcd4ff7cc1e4409207062124689a3b751a7c4"},{"url":"manifest.webmanifest","sha256":"2dc0471431a1ed8d241500c6e9d9b641dde7d268ccd586bb7a69277afe315f96"},{"url":"public/assets/apple-touch-icon.png","sha256":"b7285c6dba53667725942db17eaaa3163cf7f1a03383e8066c6ef001e702ef2d"},{"url":"public/assets/icon-192.png","sha256":"d663e51f179444e6b8539cbd0174c8090549df92bc2c57dffbcb3161fb75b32d"},{"url":"public/assets/icon-512.png","sha256":"16bd1de13c4dd3a93bbc72b13caea5b41a0fdc3ffb341ddccc350ae9b97ff642"},{"url":"public/assets/icon-maskable-512.png","sha256":"6f30d19c6b2a577fa771a94b73959ac65e7442f77428688e70ba9012fd69fcf6"},{"url":"public/assets/meal-bowl.svg","sha256":"a2f5319a55201be39a97b7c6767ebb284c1660ee1f698bd7039d6358c196a36a"},{"url":"public/assets/sprout.svg","sha256":"45a3306681e03eb6bf6f586a87d65193f547e29a7254edd7d0524500927ffcb7"},{"url":"src/data/backup.js","sha256":"4fad4f8c765c32ebca4266e5478d8fff874fe54ca4c5bafeb196f8b149b07fb5"},{"url":"src/data/dates.js","sha256":"68b0406d5127e3266b06a79ea6cd36ced0a6ac911c599c3bf08ca83be692e97f"},{"url":"src/data/demo.js","sha256":"c43c845dfd3f86c827eb8b69985467f0b0bce8a72467b6d48cdc56638c5d2858"},{"url":"src/data/diet.js","sha256":"761b9050c9492ac04434c54f6aa6fd7892c1f9cea38817488791e77595bf8438"},{"url":"src/data/export.js","sha256":"1dba27868fe26f526a5b1a11e5c12a5b4b6d4ba580e41cc159b27c445ba20414"},{"url":"src/data/imports.js","sha256":"4069480a76ad0a232bbcf86020dc6d9bfa265b8b3740073466803cd47fa7d1ee"},{"url":"src/data/navigation.js","sha256":"5b53d124f6e7f17255a1a86f6f2cdca10433227920a19689d6448abdf96cabc9"},{"url":"src/data/nutrition.js","sha256":"cf89fae950aa380eb6504b23602f7946d3f3994e47607892350dc1e028cf20e8"},{"url":"src/data/provenance.js","sha256":"0c79b2a1414bacd8b970444be2547d7f0030a2f54327199975fd5911878eaf62"},{"url":"src/data/recipes.js","sha256":"ab8d9235aa4fb55e2f06ff8c4ba2989ac6a012b855309a30245353a9d113b03b"},{"url":"src/data/session.js","sha256":"28b9a5a7b977a9948e2f60d9ba626f9ec58da32bb9ea8e98a5c6897ba1a44b0f"},{"url":"src/data/state.js","sha256":"27fa4eae6586e3d3e354ae9ccb477e6f3e3b521131abe5b47944c411c69125d6"},{"url":"src/data/validation.js","sha256":"a8fc6fe542d7105108042bb48075d2c595a01491ee8987f08c21a3e62d08f58f"},{"url":"src/data/workday.js","sha256":"b698e4eddb8c10411403acdfd7dc5cb67337c3c35adcac695c426026840b87af"},{"url":"src/main.js","sha256":"10a2c674f657339a1378c52f635209168772ef0837f738f77f8af853862c74b9"},{"url":"src/persistence/commit.js","sha256":"213ae354d30300fcf340f7da75d52eef92c58a32b65b70239c9d88317ed8cab6"},{"url":"src/persistence/indexeddb.js","sha256":"d9fc781023e7f177b102aa9dce8a753d4bb69116cc40b907b9160533dc9cb868"},{"url":"src/persistence/migrations.js","sha256":"e8e98750c8370f84b4cf3945dc8c85e43e012655c3d804e4d06e5aee0ec6fa09"},{"url":"src/persistence/repository.js","sha256":"5f560174303849e4d33e098a76d4476455ac80bb8ee157aabf26fff021f76e59"},{"url":"src/pwa/client.js","sha256":"44e4ede0365f7598489efb106abd0f3f89d13f1ee1673fb6e8537d171674c6ed"},{"url":"src/shopping/categories.js","sha256":"73a7002e354c88d0e82327c8716759f489ab08a9429505d0a495d2c6f7f2312f"},{"url":"src/shopping/list.js","sha256":"9a701f253152d6ba6c8bb87091bb96b5c5df74084ea5bc4d4b4aa70a7942c8fd"},{"url":"src/shopping/quantities.js","sha256":"0afb73a5c2e5caac35302cae2067a9ca3583f45a336e9064a1c68e6b086f9875"},{"url":"src/ui/compact.css","sha256":"b7daa584058244fa724b2fad1eb2916616dd63199da9bc30b5e324c7d788deda"},{"url":"src/ui/components.js","sha256":"d6435c92f964d3d7751d186db9c3d33af4851faddb258de4618fac2bad865c28"},{"url":"src/ui/i18n.js","sha256":"735a80edfc7ba331722b1e77b55683a087443db4e5b502d04a24ddc318551476"},{"url":"src/ui/icons.js","sha256":"a55d41e47a118bdeacfac6fff97d7e788d1acfeae01770f551f8f5aabffa8031"},{"url":"src/ui/locales/en.js","sha256":"3d6153915acd157de091228cf440235e5a9df69b34e5b89f5b2f16cb75d784e8"},{"url":"src/ui/locales/it.js","sha256":"ec355cc73c0f5797e930533910e2d635f729fea04b43d281fdc99e58b41fb623"},{"url":"src/ui/motion.js","sha256":"a38fabb26cbffa2bef4d821bd5bab26a50653c47915387f95d3165c20b80988b"},{"url":"src/ui/recipes-view.js","sha256":"f5cb2501ead46d508ed8a136765b716bf6e87088faba4e8bb9d87e88dceee9b7"},{"url":"src/ui/render.js","sha256":"e3ceb5d6f77885598331944b40e4d14d5c67de5153029745c177b1fd1277204b"},{"url":"src/ui/scroll.js","sha256":"feea2b1846458630a9bfe31ed5f922c737c3154dac3db51d95f953716b3d9474"},{"url":"src/ui/shopping-output.js","sha256":"202d88f8e6a26b7f1e532d861bc46f6e23f4dfb04d21a168377c0c66bbc6cd24"},{"url":"src/ui/styles.css","sha256":"5bcf7625df5366dd12f6dda846eae441cb4cb3c26dc8fdd136476783606f8a48"},{"url":"src/ui/tokens.css","sha256":"a654b2fcf71de4d80cd011c7affc4c3db8ab56b017102d7c328d5d490b28d0d1"}]};
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
