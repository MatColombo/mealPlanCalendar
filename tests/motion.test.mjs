import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionController } from '../src/ui/motion.js';

function events(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    listeners,
    addEventListener(type, callback, options) {
      const list = listeners.get(type) ?? [];
      list.push({ callback, options });
      listeners.set(type, list);
    },
    removeEventListener(type, callback) {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry.callback !== callback));
    },
    emit(type, event = {}) {
      for (const { callback } of [...(listeners.get(type) ?? [])]) callback(event);
    },
  });
}

class Card {
  constructor({ top = 20, height = 150 } = {}) {
    this.box = { top, bottom: top + height, left: 20, right: 340, width: 320, height };
    this.calls = [];
    this.isConnected = true;
  }
  getBoundingClientRect() { return this.box; }
  matches() { return false; }
  closest() { return null; }
  animate(keyframes, options) {
    const animation = events({ cancelled: false });
    animation.cancel = () => { animation.cancelled = true; animation.emit('cancel'); };
    animation.finish = () => animation.emit('finish');
    this.calls.push({ keyframes, options, animation });
    return animation;
  }
}

function environment(cards = [new Card()]) {
  const frames = new Map();
  const observers = [];
  const media = events({ matches: false });
  let now = 0;
  let nextFrame = 0;
  const document = { documentElement: { clientHeight: 800 } };
  const hostWindow = events({
    document, Element: Card, innerHeight: 800, scrollY: 0,
    performance: { now: () => now },
    matchMedia: () => media,
    getComputedStyle: () => ({ transform: 'none' }),
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollTo() { throw new Error('Motion must never change the native scroll position.'); },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
      observe(element) { this.targets.add(element); }
      unobserve(element) { this.targets.delete(element); }
      disconnect() { this.targets.clear(); }
    },
  });
  document.defaultView = hostWindow;
  const root = events({
    dataset: {}, ownerDocument: document, cards,
    querySelectorAll(selector) { return selector.startsWith('.page-intro') ? this.cards : []; },
    querySelector(selector) { return selector === '.people' ? this.cards[0] : null; },
  });
  return {
    root, hostWindow, media, frames, observers, document,
    advance(ms = 100) { now += ms; },
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(now));
    },
  };
}

test('motion is optional when DOM and animation APIs are unavailable', () => {
  const motion = createMotionController({ window: {} });
  assert.doesNotThrow(() => motion.sync({ pageChanged: true }));
  assert.equal(motion.feedback('.people'), false);
  assert.doesNotThrow(() => motion.setReducedMotion(true));
  assert.doesNotThrow(() => { motion.destroy(); motion.destroy(); });
});

test('page entrances settle neutrally and are not replayed by an ordinary save', () => {
  const env = environment();
  const card = env.root.cards[0];
  const motion = createMotionController({ root: env.root });
  motion.sync({ pageChanged: true });
  assert.equal(card.calls.length, 1);
  const entrance = card.calls[0];
  assert.equal(entrance.keyframes.at(-1).opacity, 1);
  assert.match(entrance.keyframes.at(-1).transform, /rotate\(0deg\).*scale\(1\)/);
  assert.notEqual(entrance.options.fill, 'forwards');
  motion.sync({ pageChanged: false });
  assert.equal(card.calls.length, 1);
  assert.equal(entrance.animation.cancelled, true);
  motion.destroy();
});

test('either app or system reduced motion immediately cancels and blocks effects', () => {
  const env = environment();
  const card = env.root.cards[0];
  const motion = createMotionController({ root: env.root });
  motion.sync({ pageChanged: true });
  motion.setReducedMotion(true);
  assert.equal(card.calls[0].animation.cancelled, true);
  assert.equal(motion.feedback(card), false);
  motion.setReducedMotion(false);
  assert.equal(motion.feedback(card), true);
  const feedback = card.calls.at(-1);
  env.media.matches = true;
  env.media.emit('change');
  assert.equal(feedback.animation.cancelled, true);
  assert.equal(motion.feedback(card), false);
  motion.setReducedMotion(false);
  assert.equal(motion.feedback(card), false, 'the app cannot override the system preference');
  env.media.matches = false;
  env.media.emit('change');
  assert.equal(motion.feedback(card, { direction: -1 }), true);
  motion.destroy();
});

test('native scroll is passive, batched, bounded to visible cards and returns neutral', () => {
  const visible = new Card();
  const hidden = new Card({ top: 1200 });
  const env = environment([visible, hidden]);
  const motion = createMotionController({ root: env.root });
  motion.sync();
  assert.equal(env.hostWindow.listeners.get('scroll')[0].options.passive, true);
  assert.equal(env.root.listeners.get('scroll')[0].options.passive, true);
  env.advance();
  env.hostWindow.scrollY = 20;
  env.hostWindow.emit('scroll', { target: env.document });
  env.hostWindow.scrollY = 45;
  env.hostWindow.emit('scroll', { target: env.document });
  assert.equal(env.frames.size, 1);
  env.flush();
  assert.equal(visible.calls.length, 1);
  assert.equal(hidden.calls.length, 0);
  assert.match(visible.calls[0].keyframes.at(-1).transform, /translate3d\(0, 0, 0\) rotate\(0deg\)/);
  assert.equal(visible.calls[0].options.fill, 'none');
  env.hostWindow.scrollY = 70;
  env.hostWindow.emit('scroll', { target: env.document });
  env.flush();
  assert.equal(visible.calls[0].animation.cancelled, true);
  assert.equal(env.hostWindow.scrollY, 70);
  motion.destroy();
});

test('offscreen cards reveal once on entry without being hidden before observation', () => {
  const card = new Card({ top: 1200 });
  const env = environment([card]);
  const motion = createMotionController({ root: env.root });
  motion.sync({ pageChanged: true });
  assert.equal(card.calls.length, 0);
  const observer = env.observers.at(-1);
  assert.equal(observer.targets.has(card), true);
  observer.callback([{ target: card, isIntersecting: true }]);
  observer.callback([{ target: card, isIntersecting: true }]);
  assert.equal(card.calls.length, 1);
  assert.equal(observer.targets.has(card), false);
  motion.destroy();
});

test('replacing markup and destroying the controller release animations and listeners', () => {
  const env = environment();
  const oldCard = env.root.cards[0];
  const motion = createMotionController({ root: env.root });
  motion.sync({ pageChanged: true });
  env.root.cards = [new Card()];
  motion.sync();
  assert.equal(oldCard.calls[0].animation.cancelled, true);
  assert.equal(motion.feedback('.people'), true);
  env.advance();
  env.hostWindow.scrollY = 40;
  env.hostWindow.emit('scroll', { target: env.document });
  assert.equal(env.frames.size, 1);
  motion.destroy();
  assert.equal(env.frames.size, 0);
  assert.equal(env.root.cards[0].calls[0].animation.cancelled, true);
  assert.equal(env.hostWindow.listeners.get('scroll').length, 0);
  assert.equal(env.root.listeners.get('scroll').length, 0);
  assert.equal(env.media.listeners.get('change').length, 0);
  assert.equal(env.root.dataset.motionEnhanced, undefined);
  assert.equal(motion.feedback('.people'), false);
});
