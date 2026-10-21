/**
 * Small, optional movements for the static UI. Native scrolling always owns the
 * gesture: this module only animates visible cards, never scroll positions.
 *
 * Call sync after replacing the root's markup and restoring focus/scroll. A
 * regular save can replace markup without replaying the page's entrance.
 */
const CARD_SELECTOR = '.page-intro, .nutrition-stat, .meal-card, .shopping-group, .recipe-card, .empty-state, .panel, .recipe-filters';
const NESTED_CARD_SELECTOR = '.nutrition-stat, .meal-card, .shopping-group, .recipe-card, .empty-state';
const NEUTRAL = 'translate3d(0, 0, 0) rotate(0deg) scale(1)';
const SPRING = 'cubic-bezier(.2, .75, .3, 1)';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createMotionController({ root, window: suppliedWindow } = {}) {
  const hostWindow = suppliedWindow ?? root?.ownerDocument?.defaultView ?? globalThis.window;
  const document = root?.ownerDocument ?? hostWindow?.document;
  const media = hostWindow?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const framesAvailable = typeof hostWindow?.requestAnimationFrame === 'function';
  const animations = new Map();
  const records = new Map();
  const scrollPositions = new WeakMap();
  const supportsAnimation = typeof hostWindow?.Element?.prototype?.animate === 'function';
  let observer;
  let appReduced = false;
  let destroyed = false;
  let pendingFrame = null;
  let pendingScroll = null;
  let ignoreScrollUntil = 0;

  const clock = () => hostWindow?.performance?.now?.() ?? Date.now();
  const disabled = () => destroyed || appReduced || Boolean(media?.matches) || Boolean(root?.querySelector?.('.view-content[data-view="today"]'));
  const queryAll = (selector) => Array.from(root?.querySelectorAll?.(selector) ?? []);

  function cancelAnimation(element) {
    const active = animations.get(element);
    if (!active) return;
    animations.delete(element);
    active.animation.cancel?.();
  }

  function cancelAll() {
    for (const element of animations.keys()) cancelAnimation(element);
    if (pendingFrame !== null) hostWindow?.cancelAnimationFrame?.(pendingFrame);
    pendingFrame = null;
    pendingScroll = null;
  }

  function play(element, keyframes, options, kind) {
    if (disabled() || typeof element?.animate !== 'function' || element.isConnected === false) return null;
    cancelAnimation(element);
    let animation;
    try {
      animation = element.animate(keyframes, { duration: 380, easing: SPRING, fill: 'none', ...options });
    } catch {
      // Older engines may lack WAAPI options. Content remains visible and usable.
      return null;
    }
    if (!animation) return null;
    animations.set(element, { animation, kind });
    const release = () => {
      if (animations.get(element)?.animation === animation) animations.delete(element);
    };
    animation.addEventListener?.('finish', release, { once: true });
    animation.addEventListener?.('cancel', release, { once: true });
    return animation;
  }

  function viewportHeight() {
    return finite(hostWindow?.innerHeight, finite(document?.documentElement?.clientHeight));
  }

  function visible(element, container = null) {
    if (typeof element?.getBoundingClientRect !== 'function') return false;
    const box = element.getBoundingClientRect();
    if (!box || finite(box.width) <= 0 || finite(box.height) <= 0) return false;
    const bounds = container?.getBoundingClientRect?.();
    const top = bounds ? Math.max(0, bounds.top) : 0;
    const bottom = bounds ? Math.min(viewportHeight(), bounds.bottom) : viewportHeight();
    if (box.bottom <= top || box.top >= bottom) return false;
    return !bounds || (box.right > bounds.left && box.left < bounds.right);
  }

  function reveal(element, index = 0) {
    const direction = index % 2 ? -1 : 1;
    const height = finite(element.getBoundingClientRect?.()?.height, 100);
    // A tall shopping group must not rotate outside its parent's side gutters.
    const angle = Math.min(1.05, 600 / Math.max(1, height));
    return play(element, [
      { opacity: .25, transform: `translate3d(0, 12px, 0) rotate(${direction * angle}deg) scale(.983)` },
      { opacity: 1, transform: `translate3d(0, -2px, 0) rotate(${direction * angle * -.2}deg) scale(1)`, offset: .72 },
      { opacity: 1, transform: NEUTRAL },
    ], { duration: 420, delay: Math.min(index * 28, 140), fill: 'backwards' }, 'reveal');
  }

  function registerObserver() {
    const IntersectionObserver = hostWindow?.IntersectionObserver;
    if (typeof IntersectionObserver !== 'function' || disabled()) return;
    observer = new IntersectionObserver((entries) => {
      if (disabled()) return;
      let index = 0;
      for (const entry of entries) {
        const record = records.get(entry.target);
        if (!record || record.seen || !entry.isIntersecting) continue;
        record.seen = true;
        reveal(entry.target, index++);
        observer?.unobserve?.(entry.target);
      }
    }, { threshold: .08 });
    for (const [element, record] of records) {
      if (!record.seen && record.axis !== 'x') observer.observe(element);
    }
  }

  function sync({ reducedMotion = appReduced, pageChanged = false, dialogChanged = false } = {}) {
    appReduced = Boolean(reducedMotion);
    cancelAll();
    observer?.disconnect?.();
    observer = null;
    records.clear();
    if (destroyed) return;
    if (root?.dataset && supportsAnimation) root.dataset.motionEnhanced = 'true';
    if (disabled()) return;

    const dialog = root?.querySelector?.('dialog[open]');
    const candidates = queryAll(CARD_SELECTOR).filter((element) => {
      // A panel containing cards must not double the movement of its children.
      return !(element.matches?.('.panel') && element.querySelector?.(NESTED_CARD_SELECTOR));
    });
    let entranceIndex = 0;
    for (const element of candidates) {
      const inDialog = Boolean(dialog?.contains?.(element));
      const currentlyVisible = visible(element, inDialog ? dialog?.querySelector?.('.modal-body') : null);
      records.set(element, { seen: currentlyVisible, axis: 'y' });
      if (currentlyVisible && ((pageChanged && !inDialog) || (dialogChanged && inDialog))) {
        reveal(element, entranceIndex++);
      }
    }
    for (const element of queryAll('.mobile-date-strip .calendar-day')) {
      records.set(element, { seen: true, axis: 'x' });
    }
    if (dialogChanged && dialog) {
      // Sheets keep a straight edge; their content carries the smaller tilt.
      play(dialog, [
        { opacity: .4, transform: 'translate3d(0, 14px, 0) scale(.99)' },
        { opacity: 1, transform: 'translate3d(0, -1px, 0) scale(1)', offset: .75 },
        { opacity: 1, transform: NEUTRAL },
      ], { duration: 320 }, 'reveal');
    }
    if (hostWindow && typeof hostWindow === 'object') {
      scrollPositions.set(hostWindow, finite(hostWindow.scrollY));
    }
    for (const scroller of queryAll('.mobile-date-strip, .modal-body')) {
      scrollPositions.set(scroller, scroller.matches?.('.mobile-date-strip') ? finite(scroller.scrollLeft) : finite(scroller.scrollTop));
    }
    // A render restores scroll programmatically; it is not a new user gesture.
    ignoreScrollUntil = clock() + 40;
    registerObserver();
  }

  function animateScroll() {
    pendingFrame = null;
    const scroll = pendingScroll;
    pendingScroll = null;
    if (!scroll || disabled()) return;
    const { source, axis, delta } = scroll;
    const strength = clamp(delta / 42, -1, 1);
    if (Math.abs(strength) < .035) return;
    const container = source === hostWindow ? null : source;
    const candidates = [];
    for (const [element, record] of records) {
      if (record.axis !== axis || animations.get(element)?.kind === 'reveal') continue;
      if (container && !container.contains?.(element)) continue;
      if (!container && element.closest?.('dialog')) continue;
      if (visible(element, container)) candidates.push(element);
      if (candidates.length === 12) break;
    }
    // Read before writing, and animate only a bounded set of visible cards.
    const starts = candidates.map((element) => ({
      transform: hostWindow?.getComputedStyle?.(element)?.transform || NEUTRAL,
      maxAngle: Math.min(.65, 600 / Math.max(1, finite(element.getBoundingClientRect?.()?.height, 100))),
    }));
    candidates.forEach((element, index) => {
      const tilt = (index % 2 ? -1 : 1) * strength * starts[index].maxAngle;
      const distance = strength * -2.5;
      const impulse = axis === 'x'
        ? `translate3d(${distance}px, 0, 0) rotate(${tilt}deg) scale(1)`
        : `translate3d(0, ${distance}px, 0) rotate(${tilt}deg) scale(1)`;
      play(element, [
        { transform: starts[index].transform },
        { transform: impulse, offset: .22 },
        { transform: NEUTRAL },
      ], { duration: 340 }, 'scroll');
    });
  }

  function onScroll(event) {
    if (disabled() || !framesAvailable) return;
    const target = event?.target;
    const source = !target || target === document || target === hostWindow ? hostWindow : target;
    if (!source || typeof source !== 'object') return;
    const axis = source.matches?.('.mobile-date-strip') ? 'x' : 'y';
    const position = source === hostWindow ? finite(source.scrollY) : finite(axis === 'x' ? source.scrollLeft : source.scrollTop);
    const previous = scrollPositions.get(source) ?? position;
    scrollPositions.set(source, position);
    if (clock() < ignoreScrollUntil) return;
    const delta = position - previous;
    if (!delta) return;
    pendingScroll = {
      source, axis,
      delta: pendingScroll?.source === source ? pendingScroll.delta + delta : delta,
    };
    if (pendingFrame === null) pendingFrame = hostWindow.requestAnimationFrame(animateScroll);
  }

  function feedback(target, { direction = 1 } = {}) {
    const element = typeof target === 'string' ? root?.querySelector?.(target) : target;
    const sign = direction < 0 ? -1 : 1;
    return Boolean(play(element, [
      { transform: `translate3d(0, 1px, 0) rotate(${-sign * 1.5}deg) scale(.96)` },
      { transform: `translate3d(0, -1px, 0) rotate(${sign * .65}deg) scale(1.025)`, offset: .45 },
      { transform: NEUTRAL },
    ], { duration: 350 }, 'feedback'));
  }

  function setReducedMotion(value) {
    sync({ reducedMotion: Boolean(value) });
  }

  function onPreferenceChange() {
    sync();
  }

  hostWindow?.addEventListener?.('scroll', onScroll, { passive: true });
  root?.addEventListener?.('scroll', onScroll, { passive: true, capture: true });
  if (typeof media?.addEventListener === 'function') media.addEventListener('change', onPreferenceChange);
  else media?.addListener?.(onPreferenceChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAll();
    observer?.disconnect?.();
    records.clear();
    hostWindow?.removeEventListener?.('scroll', onScroll);
    root?.removeEventListener?.('scroll', onScroll, true);
    if (typeof media?.removeEventListener === 'function') media.removeEventListener('change', onPreferenceChange);
    else media?.removeListener?.(onPreferenceChange);
    if (root?.dataset && supportsAnimation) delete root.dataset.motionEnhanced;
  }

  return { sync, setReducedMotion, feedback, destroy };
}
