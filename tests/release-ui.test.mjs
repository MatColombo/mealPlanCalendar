import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState } from '../src/data/state.js';
import { addManualItem } from '../src/shopping/list.js';
import { createIndexedDBRepository } from '../src/persistence/indexeddb.js';

const NOW = '2026-10-19T17:00:00.000Z';
let controllerNumber = 0;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/**
 * Minimal DOM API adapter for the real main.js event handlers. It records full
 * renders and dialog markup; it does not parse HTML or emulate a browser's
 * layout, native event ordering, focus behavior, installation or clipboard UI.
 */
async function controller(t, clipboard) {
  const originals = new Map();
  const connections = new Set();
  const pendingWorkerMessages = new Set();
  async function drainWorkerMessages() {
    // Let bootstrap continuations enqueue their messages before testing idle.
    await new Promise(resolve => setImmediate(resolve));
    while (pendingWorkerMessages.size) {
      await Promise.all([...pendingWorkerMessages]);
      // Message handling can enqueue another refresh in the same bootstrap.
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  t.after(async () => {
    try { await drainWorkerMessages(); }
    finally {
      for (const connection of connections) connection.close();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.disabled = false; }
    closest(selector) { return selector === '[data-action]' && this.dataset.action ? this : null; }
  }
  class Form extends Element {}
  class Dialog extends Element {
    constructor() { super(); this.classList = { toggle() {} }; this.body = { scrollTop: 0 }; }
    querySelector(selector) { return selector === '.modal-body' ? this.body : null; }
    showModal() {}
    contains() { return false; }
  }
  const listeners = new Map();
  const textControl = { focusCount: 0, selectCount: 0,
    focus() { this.focusCount++; }, select() { this.selectCount++; } };
  const pwaSlot = { innerHTML: '', contains() { return false; } };
  const app = {
    html: '', renders: 0, dialog: null,
    set innerHTML(html) { this.html = html; this.renders++; this.dialog = html.includes('<dialog ') ? new Dialog() : null; },
    querySelector(selector) {
      if (selector === 'dialog') return this.dialog;
      if (selector === 'dialog .modal-body') return this.dialog?.body ?? null;
      if (selector === '#shopping-copy-text' && this.html.includes('id="shopping-copy-text"')) return textControl;
      if (selector === '[data-pwa-status]') return pwaSlot;
      return null;
    },
    querySelectorAll() { return []; }, contains() { return false; },
    addEventListener(type, callback) { listeners.set(type, callback); },
  };
  const location = { hash: '#shopping', reload() { throw new Error('Unexpected reload in a clipboard scenario.'); } };
  const windowObject = Object.assign(new EventTarget(), {
    isSecureContext: true, scrollY: 0, location, scrollTo() {},
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
  });
  const worker = (version, state) => Object.assign(new EventTarget(), {
    version, state,
    postMessage(message, ports) {
      // Production closes this port after handling the reply. Waiting for
      // close also drains the async refresh/start continuations, not merely
      // the moment the fake worker has queued its response.
      const settled = new Promise(resolve => ports[0].once('close', resolve));
      pendingWorkerMessages.add(settled);
      void settled.then(() => pendingWorkerMessages.delete(settled));
      assert.equal(message.type, 'GET_STATUS');
      ports[0].postMessage({ ready: true, version });
    },
  });
  const registration = Object.assign(new EventTarget(), {
    active: worker('clipboard-current', 'activated'), waiting: worker('clipboard-next', 'installed'),
    installing: null, update: async () => {},
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: registration.active,
    getRegistration: async () => registration, register: async () => registration,
  });
  const indexedDB = new IDBFactory();
  const nativeOpen = indexedDB.open.bind(indexedDB);
  indexedDB.open = (...args) => {
    const request = nativeOpen(...args);
    request.addEventListener('success', () => connections.add(request.result));
    return request;
  };
  for (const [key, value] of Object.entries({
    document: { activeElement: null, documentElement: { dataset: {} },
      querySelector: selector => selector === '#app' ? app : null },
    window: windowObject, location,
    history: { replaceState(_state, _title, hash) { location.hash = hash; },
      pushState(_state, _title, hash) { location.hash = hash; } },
    HTMLElement: Element, HTMLFormElement: Form, HTMLDialogElement: Dialog,
    CSS: { escape: value => value }, navigator: { onLine: false, clipboard, serviceWorker }, indexedDB,
  })) replace(key, value);

  const repository = createIndexedDBRepository({ indexedDB });
  await repository.load();
  const state = addManualItem(createAppState({ uiLanguage: 'en', now: NOW }), {
    name: 'Manual & original', quantity: 2, unit: 'box',
  }, { itemId: 'clipboard-fixture', now: NOW });
  state.ui.view = 'shopping';
  await repository.save(state);
  repository.close();

  const url = new URL('../src/main.js', import.meta.url);
  url.searchParams.set('clipboard-test', String(++controllerNumber));
  await import(url.href);
  await drainWorkerMessages();
  assert.match(app.html, /data-view="shopping"/u);
  assert.match(app.html, /data-storage-status="ready"/u);
  assert.match(pwaSlot.innerHTML, /pwa-update-banner/u);
  assert.match(pwaSlot.innerHTML, /pwa-offline-state--ready/u);
  assert.equal(pendingWorkerMessages.size, 0);
  return {
    app, textControl,
    click(action) { return listeners.get('click')({ target: new Element({ action }), preventDefault() {} }); },
    checkManual() {
      const target = new Element({ control: 'manual-check', itemId: 'clipboard-fixture' });
      target.checked = true;
      return listeners.get('change')({ target });
    },
  };
}

for (const outcome of ['success', 'rejection']) {
  for (const interruption of ['newer update dialog', 'pending local save']) {
    test(`late clipboard ${outcome} leaves a ${interruption} intact`, async t => {
      const clipboard = deferred();
      const h = await controller(t, { writeText: () => clipboard.promise });
      const pendingCopy = h.click('copy-shopping');
      let pendingSave;
      if (interruption === 'newer update dialog') {
        await h.click('open-update');
        assert.match(h.app.html, /Switch to the new version\?/u);
      } else {
        pendingSave = h.checkManual();
        assert.match(h.app.html, /data-storage-status="saving"/u);
      }
      const before = { html: h.app.html, renders: h.app.renders };
      try {
        if (outcome === 'success') clipboard.resolve();
        else clipboard.reject(new Error('Delayed clipboard permission rejection.'));
        await pendingCopy;
        assert.equal(h.app.renders, before.renders);
        assert.equal(h.app.html, before.html);
        assert.equal(h.textControl.selectCount, 0);
      } finally {
        if (pendingSave) await pendingSave;
      }
    });
  }
}

for (const availability of ['unavailable', 'denied']) {
  test(`normal ${availability} clipboard access still offers selectable escaped text`, async t => {
    const h = await controller(t, availability === 'unavailable' ? undefined : {
      writeText: async () => { throw new Error('Clipboard permission denied.'); },
    });
    await h.click('copy-shopping');
    assert.match(h.app.html, /Copy your list/u);
    assert.match(h.app.html, /id="shopping-copy-text"[^>]*readonly/u);
    assert.match(h.app.html, /Manual &amp; original/u);
    assert.match(h.app.html, /data-action="download-shopping"/u);
    assert.equal(h.textControl.focusCount, 1);
    assert.equal(h.textControl.selectCount, 1);
  });
}

test('a current successful clipboard request reports success and keeps the shopping view', async t => {
  const copied = [];
  const h = await controller(t, { writeText: async text => { copied.push(text); } });
  await h.click('copy-shopping');
  assert.equal(copied.length, 1);
  assert.match(copied[0], /Manual & original/u);
  assert.match(h.app.html, /Shopping list copied\./u);
  assert.doesNotMatch(h.app.html, /id="shopping-copy-text"/u);
  assert.match(h.app.html, /data-view="shopping"/u);
});
