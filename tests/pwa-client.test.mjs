import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';
import { createPwaManager, getPwaCapabilities, requestWorkerMessage } from '../src/pwa/client.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const BASE = 'https://example.test/meal-planner/';

class Worker extends EventTarget {
  constructor(version, state = 'activated') { super(); this.version = version; this.state = state; this.ready = true; }
  change(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}

function setup({ online = true, active = new Worker('0.7.0-old'), persisted = false, grant = true } = {}) {
  const media = Object.assign(new EventTarget(), { matches: false });
  const windowObject = Object.assign(new EventTarget(), { isSecureContext: true, matchMedia: () => media });
  const registration = Object.assign(new EventTarget(), { scope: BASE, active, waiting: null, installing: null });
  const serviceWorker = Object.assign(new EventTarget(), { controller: active });
  const calls = { register: [], persist: 0, reload: 0, messages: [], update: 0 };
  serviceWorker.getRegistration = async () => registration;
  serviceWorker.register = async (url, options) => { calls.register.push({ url, options }); return registration; };
  registration.update = async () => { calls.update += 1; };
  const storage = {
    persisted: async () => persisted,
    persist: async () => { calls.persist += 1; return grant; },
  };
  const navigatorObject = { onLine: online, serviceWorker, storage, userAgent: '', platform: '', maxTouchPoints: 0 };
  let reply = async (worker, message) => {
    if (message.type === 'GET_STATUS') return { ready: worker.ready, version: worker.version };
    if (message.type === 'REPAIR_CACHE') { worker.ready = true; return { ready: true, version: worker.version }; }
    return { applied: false, reason: 'other-tabs' };
  };
  const snapshots = [];
  const manager = createPwaManager({
    navigatorObject, windowObject, baseUrl: BASE,
    onChange: state => snapshots.push(state), onReload: () => { calls.reload += 1; },
    requestMessage: async (worker, message) => { calls.messages.push(message.type); return reply(worker, message); },
    lifecycleTimeoutMs: 30,
  });
  return { manager, registration, serviceWorker, navigatorObject, storage, windowObject, media, calls, snapshots,
    setReply: fn => { reply = fn; },
    activate(worker) {
      registration.active = worker; registration.waiting = null; registration.installing = null;
      serviceWorker.controller = worker;
      worker.change('activated');
      serviceWorker.dispatchEvent(new Event('controllerchange'));
    },
  };
}

test('capabilities use actual APIs and display mode, with installation hints only where appropriate', () => {
  const win = { isSecureContext: true, matchMedia: () => ({ matches: false }) };
  const nav = { onLine: false, serviceWorker: { register() {} }, userAgent: 'iPhone', standalone: false };
  assert.deepEqual(getPwaCapabilities(nav, win), { online: false, secureContext: true, supported: true, installMode: 'ios' });
  assert.equal(getPwaCapabilities({ ...nav, userAgent: '', platform: 'MacIntel', maxTouchPoints: 5 }, win).installMode, 'ios');
  assert.equal(getPwaCapabilities({ ...nav, standalone: true }, win).installMode, 'installed');
  assert.equal(getPwaCapabilities(nav, { ...win, matchMedia: () => ({ matches: true }) }).installMode, 'installed');
  assert.equal(getPwaCapabilities({ ...nav, userAgent: 'Desktop' }, win).installMode, 'manual');
  assert.equal(getPwaCapabilities(nav, { ...win, isSecureContext: false }).supported, false);
  assert.equal(getPwaCapabilities({}, {}).installMode, 'unavailable');
});

test('offline startup reads the existing shell, requests persistence once and keeps the subfolder scope', async () => {
  const h = setup({ online: false });
  try {
    await h.manager.start();
    await h.manager.start();
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.manager.getState().online, false);
    assert.equal(h.manager.getState().persistence, 'granted');
    assert.equal(h.calls.persist, 1);
    assert.deepEqual(h.calls.register[0], { url: BASE + 'sw.js', options: { scope: BASE, updateViaCache: 'none' } });
    h.windowObject.dispatchEvent(new Event('online'));
    await tick();
    assert.equal(h.manager.getState().online, true);
    h.windowObject.dispatchEvent(new Event('offline'));
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.calls.reload, 0);
  } finally { h.manager.destroy(); }
});

test('a failed registration still uses a known offline shell and grants remain independent of it', async () => {
  const h = setup({ online: false, persisted: true });
  h.serviceWorker.register = () => { throw new Error('Offline update request'); };
  try {
    await h.manager.start();
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.manager.getState().persistence, 'granted');
    assert.equal(h.calls.persist, 0);
    const check = await h.manager.checkForUpdate();
    assert.equal(check.checked, true);
    assert.equal(h.calls.reload, 0);
  } finally { h.manager.destroy(); }
});

test('initial activation and arriving updates never reload without explicit confirmation', async () => {
  const h = setup({ active: null });
  const first = new Worker('0.7.0-first', 'installing');
  h.registration.installing = first;
  try {
    await h.manager.start();
    assert.equal(h.manager.getState().status, 'preparing');
    h.activate(first);
    await tick();
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.calls.reload, 0);
    const next = new Worker('0.7.0-next', 'installing');
    h.registration.installing = next;
    h.registration.dispatchEvent(new Event('updatefound'));
    h.registration.waiting = next;
    h.registration.installing = null;
    next.change('installed');
    await tick();
    assert.equal(h.manager.getState().updateAvailable, true);
    assert.equal(h.manager.getState().version, first.version);
    assert.equal(h.calls.messages.includes('APPLY_UPDATE'), false);
    assert.equal(h.calls.reload, 0);
  } finally { h.manager.destroy(); }
});

test('explicit update handles other tabs and the activation-before-reply race without an automatic second reload', async () => {
  const h = setup();
  const next = new Worker('0.7.0-new', 'installed');
  h.registration.waiting = next;
  try {
    await h.manager.start();
    assert.equal(await h.manager.applyUpdate(), false);
    assert.equal(h.manager.getState().error, 'pwa.errors.otherTabs');
    assert.equal(h.manager.getState().updating, false);
    assert.equal(h.calls.reload, 0);
    h.setReply(async (worker, message) => {
      if (message.type === 'GET_STATUS') return { ready: true, version: worker.version };
      if (message.type === 'APPLY_UPDATE') { h.activate(next); return { applied: true }; }
      throw new Error('Unexpected message');
    });
    assert.equal(await h.manager.applyUpdate(), true);
    assert.equal(h.calls.reload, 1);
    h.serviceWorker.dispatchEvent(new Event('controllerchange'));
    await tick();
    assert.equal(h.calls.reload, 1);
  } finally { h.manager.destroy(); }
});

test('late activation after an update timeout does not interrupt subsequent local work', async () => {
  const h = setup();
  const next = new Worker('0.7.0-delayed', 'installed');
  h.registration.waiting = next;
  h.setReply(async (worker, message) => message.type === 'GET_STATUS'
    ? { ready: true, version: worker.version } : { applied: true });
  try {
    await h.manager.start();
    assert.equal(await h.manager.applyUpdate(), false);
    assert.equal(h.manager.getState().updating, false);
    assert.equal(h.manager.getState().error, 'pwa.errors.applyUpdate');
    h.activate(next);
    await tick();
    assert.equal(h.calls.reload, 0);
  } finally { h.manager.destroy(); }
});

test('persistence denial and errors are distinct and retryable while cached app availability remains intact', async () => {
  const h = setup({ grant: false });
  try {
    await h.manager.start();
    assert.equal(h.manager.getState().persistence, 'not-granted');
    assert.equal(h.manager.getState().status, 'ready');
    h.storage.persisted = () => { throw new Error('Permission read denied'); };
    assert.equal(await h.manager.requestPersistence(), 'error');
    h.storage.persisted = async () => false;
    h.storage.persist = async () => true;
    assert.equal(await h.manager.requestPersistence(), 'granted');
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.calls.reload, 0);
  } finally { h.manager.destroy(); }
});

test('an incomplete shell is repaired explicitly and stale status replies cannot overwrite a newer result', async () => {
  const h = setup();
  h.registration.active.ready = false;
  try {
    await h.manager.start();
    assert.equal(h.manager.getState().status, 'error');
    assert.equal(await h.manager.repair(), true);
    assert.equal(h.manager.getState().status, 'ready');
    let staleReply;
    let number = 0;
    h.setReply(async () => ++number === 1 ? new Promise(resolve => { staleReply = resolve; })
      : { ready: true, version: 'new-status' });
    const oldRequest = h.manager.refresh();
    await h.manager.refresh();
    staleReply({ ready: false, version: 'old-status' });
    await oldRequest;
    assert.equal(h.manager.getState().status, 'ready');
    assert.equal(h.manager.getState().version, 'new-status');
  } finally { h.manager.destroy(); }
});

test('a prompt is single-use and accepted is not reported as installed until the browser says so', async () => {
  const h = setup();
  let prompts = 0;
  try {
    await h.manager.start();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => { prompts += 1; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    h.windowObject.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(h.manager.getState().installMode, 'prompt');
    assert.equal(await h.manager.promptInstall(), 'accepted');
    assert.equal(h.manager.getState().installMode, 'manual');
    assert.equal(await h.manager.promptInstall(), 'unavailable');
    assert.equal(prompts, 1);
    h.windowObject.dispatchEvent(new Event('appinstalled'));
    await tick();
    assert.equal(h.manager.getState().installMode, 'installed');
  } finally { h.manager.destroy(); }
});

test('an update check waits for installation and does not announce no updates while assets are being prepared', async () => {
  const h = setup();
  try {
    await h.manager.start();
    const worker = new Worker('0.7.0-preparing', 'installing');
    h.registration.update = async () => {
      h.registration.installing = worker;
      h.registration.dispatchEvent(new Event('updatefound'));
    };
    let completed = false;
    const check = h.manager.checkForUpdate().then(value => { completed = true; return value; });
    await tick();
    assert.equal(h.manager.getState().checkingUpdate, true);
    assert.equal(completed, false);
    h.registration.waiting = worker;
    h.registration.installing = null;
    worker.change('installed');
    assert.deepEqual(await check, { checked: true, available: true });
    assert.equal(h.manager.getState().checkingUpdate, false);
  } finally { h.manager.destroy(); }
});

test('worker messaging returns an actual channel response and closes timeout/failure paths', async () => {
  const worker = { postMessage(message, ports) { ports[0].postMessage({ ready: true, version: message.type }); } };
  assert.deepEqual(await requestWorkerMessage(worker, { type: 'GET_STATUS' }, { MessageChannelClass: MessageChannel }),
    { ready: true, version: 'GET_STATUS' });
  await assert.rejects(requestWorkerMessage({ postMessage() {} }, {}, { MessageChannelClass: MessageChannel, timeoutMs: 5 }),
    error => error.code === 'PWA_MESSAGE_TIMEOUT');
  await assert.rejects(requestWorkerMessage({ postMessage() { throw new Error('Worker stopped'); } }, {},
    { MessageChannelClass: MessageChannel }), /Worker stopped/u);
});
