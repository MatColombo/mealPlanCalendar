/**
 * Optional browser capabilities. This module never reads or writes personal
 * state and never gates local data operations on a network connection.
 */
const APP_BASE_URL = new URL('../../', import.meta.url);

function pwaError(code, message) {
  return Object.assign(new Error(message), { code });
}

function safeRead(read, fallback) {
  try { return read() ?? fallback; } catch { return fallback; }
}

/** Feature detection first; device hints are used only for installation help. */
export function getPwaCapabilities(navigatorObject, windowObject) {
  const secureContext = safeRead(() => windowObject.isSecureContext === true, false);
  const serviceWorker = safeRead(() => navigatorObject.serviceWorker, null);
  const media = safeRead(() => windowObject.matchMedia('(display-mode: standalone)'), null);
  const installed = media?.matches === true || safeRead(() => navigatorObject.standalone === true, false);
  const ios = /iPad|iPhone|iPod/u.test(safeRead(() => navigatorObject.userAgent, ''))
    || (safeRead(() => navigatorObject.platform, '') === 'MacIntel'
      && safeRead(() => navigatorObject.maxTouchPoints, 0) > 1);
  return {
    online: safeRead(() => navigatorObject.onLine !== false, true),
    secureContext,
    supported: secureContext && typeof serviceWorker?.register === 'function',
    installMode: installed ? 'installed' : !secureContext ? 'unavailable' : ios ? 'ios' : 'manual',
  };
}

/** MessageChannel requests are bounded and close their ports on every exit. */
export function requestWorkerMessage(worker, message, {
  MessageChannelClass = globalThis.MessageChannel,
  timeoutMs = message?.type === 'REPAIR_CACHE' ? 60000 : 12000,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!worker || typeof worker.postMessage !== 'function' || typeof MessageChannelClass !== 'function') {
      reject(pwaError('PWA_MESSAGE_UNAVAILABLE', 'Service worker messaging is unavailable.'));
      return;
    }
    const channel = new MessageChannelClass();
    let complete = false;
    let timeout;
    const finish = (error, value) => {
      if (complete) return;
      complete = true;
      clearTimer(timeout);
      channel.port1.onmessage = null;
      channel.port1.onmessageerror = null;
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve(value);
    };
    channel.port1.onmessage = event => finish(null, event.data);
    channel.port1.onmessageerror = () => finish(pwaError('PWA_MESSAGE_FAILED', 'Unreadable worker response.'));
    timeout = setTimer(() => finish(pwaError('PWA_MESSAGE_TIMEOUT', 'The worker did not respond.')), timeoutMs);
    try { worker.postMessage(message, [channel.port2]); }
    catch (error) { finish(error); }
  });
}

/**
 * The injected browser objects keep lifecycle tests independent of a browser.
 * onReload runs only after an explicitly requested update controls this page.
 */
export function createPwaManager({
  navigatorObject = globalThis.navigator,
  windowObject = globalThis.window,
  baseUrl = APP_BASE_URL,
  onChange = () => {},
  onReload = () => windowObject.location.reload(),
  requestMessage = requestWorkerMessage,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  lifecycleTimeoutMs = 30000,
} = {}) {
  const capabilities = getPwaCapabilities(navigatorObject, windowObject);
  const serviceWorker = safeRead(() => navigatorObject.serviceWorker, null);
  const storage = safeRead(() => navigatorObject.storage, null);
  const scopeUrl = new URL('./', baseUrl);
  const workerUrl = new URL('sw.js', scopeUrl);
  let state = {
    ...capabilities,
    status: capabilities.supported ? 'checking' : 'unsupported',
    version: null, updateAvailable: false, updating: false, checkingUpdate: false,
    persistence: typeof storage?.persist === 'function' ? 'checking' : 'unsupported',
    error: null,
  };
  let registration = null;
  let started = false;
  let destroyed = false;
  let startPromise = null;
  let registerPromise = null;
  let persistencePromise = null;
  let updatePromise = null;
  let installPrompt = null;
  let installingPrompt = false;
  let installedThisSession = capabilities.installMode === 'installed';
  let refreshRevision = 0;
  let reloadWaiter = null;
  const subscriptions = [];
  const watched = new WeakSet();

  const getState = () => ({ ...state });
  const publish = patch => {
    if (destroyed) return;
    const next = { ...state, ...patch };
    if (Object.keys(next).every(key => next[key] === state[key])) return;
    state = next;
    onChange(getState());
  };
  const clearError = (...keys) => keys.includes(state.error) ? { error: null } : {};
  const listen = (target, type, listener) => {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(type, listener);
    subscriptions.push(() => target.removeEventListener(type, listener));
  };
  const fallbackInstallMode = () => installedThisSession ? 'installed'
    : getPwaCapabilities(navigatorObject, windowObject).installMode;

  async function refresh() {
    if (destroyed || !state.supported || !registration) return getState();
    const revision = ++refreshRevision;
    const active = registration.active;
    publish({ updateAvailable: Boolean(registration.waiting && registration.waiting !== active) });
    if (!active) {
      const failed = registration.installing?.state === 'redundant'
        || (!registration.installing && state.status === 'error');
      publish({ status: failed ? 'error' : 'preparing', version: null });
      return getState();
    }
    try {
      const result = await requestMessage(active, { type: 'GET_STATUS' });
      if (destroyed || revision !== refreshRevision) return getState();
      if (result?.ready !== true || typeof result.version !== 'string') {
        throw pwaError('PWA_CACHE_INCOMPLETE', 'The offline app is not completely cached.');
      }
      publish({ status: 'ready', version: result.version, ...clearError('pwa.errors.setup') });
    } catch {
      if (revision === refreshRevision) publish({ status: 'error', error: 'pwa.errors.setup' });
    }
    return getState();
  }

  function watchWorker(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    listen(worker, 'statechange', () => {
      if (worker.state === 'redundant' && worker !== registration?.active) {
        // A failed new install leaves a working old cache available.
        publish({ error: registration?.active ? 'pwa.errors.checkUpdate' : 'pwa.errors.setup' });
        if (!registration?.active) publish({ status: 'error' });
      }
      if (['installed', 'activating', 'activated', 'redundant'].includes(worker.state)) void refresh();
    });
  }

  async function register() {
    if (!state.supported || destroyed) return null;
    if (registerPromise) return registerPromise;
    registerPromise = Promise.resolve().then(async () => {
      if (!registration?.active) publish({ status: 'preparing', error: null });
      try {
        // An existing registration is local browser state. It remains usable
        // even when an offline register/update attempt cannot reach the server.
        if (!registration && typeof serviceWorker.getRegistration === 'function') {
          const existing = await serviceWorker.getRegistration(scopeUrl.href);
          if (existing && existing.scope === scopeUrl.href) {
            registration = existing;
            listen(registration, 'updatefound', () => {
              watchWorker(registration.installing);
              if (!registration.active) publish({ status: 'preparing' });
            });
            watchWorker(registration.installing);
            watchWorker(registration.waiting);
            watchWorker(registration.active);
            await refresh();
          }
        }
        const result = await serviceWorker.register(workerUrl.href, {
          scope: scopeUrl.href, updateViaCache: 'none',
        });
        if (destroyed) return null;
        if (registration !== result) {
          registration = result;
          listen(registration, 'updatefound', () => {
            watchWorker(registration.installing);
            if (!registration.active) publish({ status: 'preparing' });
          });
        }
        watchWorker(registration.installing);
        watchWorker(registration.waiting);
        watchWorker(registration.active);
        await refresh();
        return registration;
      } catch {
        // Registration/check failure must not turn a usable old cache into
        // a data error. Query its active worker when one is already known.
        if (registration?.active) await refresh();
        else publish({ status: 'error', error: 'pwa.errors.setup' });
        return null;
      } finally { registerPromise = null; }
    });
    return registerPromise;
  }

  async function requestPersistence() {
    if (destroyed) return state.persistence;
    if (persistencePromise) return persistencePromise;
    if (typeof storage?.persist !== 'function') {
      publish({ persistence: 'unsupported' });
      return 'unsupported';
    }
    persistencePromise = Promise.resolve().then(async () => {
      publish({ persistence: 'checking' });
      try {
        const already = typeof storage.persisted === 'function' && await storage.persisted();
        const granted = already || await storage.persist();
        const persistence = granted ? 'granted' : 'not-granted';
        publish({ persistence, ...clearError('pwa.errors.persistence') });
        return persistence;
      } catch {
        publish({ persistence: 'error' });
        return 'error';
      } finally { persistencePromise = null; }
    });
    return persistencePromise;
  }

  async function refreshPersistence() {
    if (destroyed || persistencePromise || typeof storage?.persisted !== 'function') return;
    try {
      const granted = await storage.persisted();
      publish({ persistence: granted ? 'granted' : 'not-granted' });
    } catch { publish({ persistence: 'error' }); }
  }

  function waitForInstallation(worker) {
    if (!worker || ['installed', 'activated'].includes(worker.state)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => { clearTimer(timer); worker.removeEventListener('statechange', changed); };
      const changed = () => {
        if (worker.state === 'redundant') {
          cleanup(); reject(pwaError('PWA_INSTALL_FAILED', 'The new worker could not install.'));
        } else if (['installed', 'activated'].includes(worker.state)) { cleanup(); resolve(); }
      };
      timer = setTimer(() => {
        cleanup(); reject(pwaError('PWA_INSTALL_TIMEOUT', 'The update is still being prepared.'));
      }, lifecycleTimeoutMs);
      worker.addEventListener('statechange', changed);
      changed();
    });
  }

  async function checkForUpdate() {
    if (destroyed || !state.supported) return { checked: false, available: false };
    if (updatePromise) return updatePromise;
    updatePromise = Promise.resolve().then(async () => {
      publish({ checkingUpdate: true, ...clearError('pwa.errors.checkUpdate') });
      try {
        if (!registration && !await register()) throw pwaError('PWA_SETUP_FAILED', 'Registration unavailable.');
        await registration.update();
        if (registration.installing) await waitForInstallation(registration.installing);
        await refresh();
        return { checked: true, available: state.updateAvailable };
      } catch {
        publish({ error: 'pwa.errors.checkUpdate' });
        return { checked: false, available: state.updateAvailable };
      } finally {
        publish({ checkingUpdate: false });
        updatePromise = null;
      }
    });
    return updatePromise;
  }

  async function repair() {
    if (destroyed || !state.supported) return false;
    publish({ ...clearError('pwa.errors.setup') });
    if (!registration && !await register()) return false;
    const active = registration?.active;
    if (!active) { await refresh(); return false; }
    publish({ status: 'preparing' });
    try {
      const result = await requestMessage(active, { type: 'REPAIR_CACHE' });
      if (result?.ready !== true) throw pwaError('PWA_CACHE_INCOMPLETE', 'Offline cache repair failed.');
      await refresh();
      return state.status === 'ready';
    } catch {
      publish({ status: 'error', error: 'pwa.errors.setup' });
      return false;
    }
  }

  async function promptInstall() {
    if (!installPrompt || installingPrompt || destroyed) return 'unavailable';
    const prompt = installPrompt;
    installPrompt = null;
    installingPrompt = true;
    publish({ installMode: fallbackInstallMode(), ...clearError('pwa.errors.install') });
    try {
      // This call stays on the originating click's stack, before any await.
      const prompted = prompt.prompt();
      await prompted;
      const choice = await prompt.userChoice;
      return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      publish({ error: 'pwa.errors.install' });
      return 'error';
    } finally { installingPrompt = false; }
  }

  async function applyUpdate() {
    if (destroyed || state.updating || !registration?.waiting) return false;
    const worker = registration.waiting;
    publish({ updating: true, ...clearError('pwa.errors.applyUpdate', 'pwa.errors.otherTabs') });
    try {
      const answer = await requestMessage(worker, { type: 'APPLY_UPDATE' });
      if (answer?.applied !== true) {
        publish({ updating: false, error: answer?.reason === 'other-tabs'
          ? 'pwa.errors.otherTabs' : 'pwa.errors.applyUpdate' });
        return false;
      }
      await new Promise((resolve, reject) => {
        let timer;
        const finish = (error) => {
          clearTimer(timer);
          reloadWaiter = null;
          if (error) reject(error); else resolve();
        };
        reloadWaiter = () => {
          if (serviceWorker.controller === worker) finish();
        };
        timer = setTimer(() => finish(pwaError('PWA_ACTIVATION_TIMEOUT', 'The update did not take control.')), lifecycleTimeoutMs);
        reloadWaiter();
      });
      if (destroyed) return false;
      onReload();
      return true;
    } catch {
      reloadWaiter = null;
      publish({ updating: false, error: 'pwa.errors.applyUpdate' });
      return false;
    }
  }

  function start() {
    if (started) return startPromise;
    started = true;
    listen(windowObject, 'online', () => { publish({ online: true }); void refresh(); });
    listen(windowObject, 'offline', () => { publish({ online: false }); });
    listen(windowObject, 'beforeinstallprompt', event => {
      if (installedThisSession) return;
      event.preventDefault();
      installPrompt = event;
      publish({ installMode: 'prompt' });
    });
    listen(windowObject, 'appinstalled', () => {
      installedThisSession = true;
      installPrompt = null;
      publish({ installMode: 'installed', ...clearError('pwa.errors.install') });
      void requestPersistence();
    });
    const media = safeRead(() => windowObject.matchMedia('(display-mode: standalone)'), null);
    listen(media, 'change', () => {
      if (media.matches) installedThisSession = true;
      publish({ installMode: installPrompt ? 'prompt' : fallbackInstallMode() });
    });
    listen(serviceWorker, 'controllerchange', () => { reloadWaiter?.(); void refresh(); });
    listen(windowObject, 'focus', () => { void refresh(); void refreshPersistence(); });
    // Neither operation is awaited by the application bootstrap or its data
    // repository. A slow network or a permission decision cannot block them.
    startPromise = Promise.allSettled([register(), requestPersistence()]).then(getState);
    return startPromise;
  }

  function destroy() {
    destroyed = true;
    refreshRevision += 1;
    reloadWaiter = null;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    installPrompt = null;
  }

  return { getState, start, refresh, checkForUpdate, requestPersistence, repair, promptInstall, applyUpdate, destroy };
}
