/** Native, bounded scroll regions; never hijack wheel/touch gestures. */
export function createScrollMemory(root) {
  const positions = new Map();
  const expanded = new Map();
  let pending = 0;
  function remember() {
    for (const node of root.querySelectorAll('[data-open-memory]')) expanded.set(node.dataset.openMemory, node.open);
    for (const node of root.querySelectorAll('[data-scroll-memory]')) {
      positions.set(node.dataset.scrollMemory, { left: node.scrollLeft, top: node.scrollTop });
    }
    // The calendar can contain years of days; session scroll memory is bounded.
    while (positions.size > 80) positions.delete(positions.keys().next().value);
  }
  function restore() {
    for (const node of root.querySelectorAll('[data-open-memory]')) {
      if (expanded.has(node.dataset.openMemory)) node.open = expanded.get(node.dataset.openMemory);
    }
    for (const node of root.querySelectorAll('[data-scroll-memory]')) {
      const position = positions.get(node.dataset.scrollMemory);
      if (!position) continue;
      node.scrollLeft = position.left;
      node.scrollTop = position.top;
    }
    updateCategoryTab();
  }
  function updateCategoryTab() {
    const scroller = root.querySelector('#shopping-categories');
    if (!scroller) return;
    const left = scroller.getBoundingClientRect().left;
    const pages = [...scroller.children];
    let selected = 0, distance = Infinity;
    pages.forEach((page,index) => {
      const delta = Math.abs(page.getBoundingClientRect().left - left);
      if (delta < distance) { distance = delta; selected = index; }
    });
    for (const button of root.querySelectorAll('[data-action="scroll-category"]')) {
      const active = Number(button.dataset.categoryIndex) === selected;
      button.classList.toggle('is-active',active);
      if (active) button.setAttribute('aria-current','true');
      else button.removeAttribute('aria-current');
    }
  }
  function toPage(scroller, index, smooth) {
    const page = scroller?.children?.[index];
    if (!page) return;
    const left = page.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }
  function handle(control, reduced = false) {
    const action = control.dataset.action;
    if (!['scroll-section','scroll-category'].includes(action)) return false;
    const scroller = root.querySelector(action === 'scroll-category' ? '#shopping-categories' : '#' + control.dataset.scroller);
    if (!scroller) return true;
    const noMotion = reduced || root.querySelector('.view-content[data-view="today"]') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (action === 'scroll-category') toPage(scroller, Number(control.dataset.categoryIndex), !noMotion);
    else {
      const pages = [...scroller.children];
      let current = 0, distance = Infinity;
      pages.forEach((page,index) => { const d = Math.abs(page.getBoundingClientRect().left - scroller.getBoundingClientRect().left); if (d < distance) {current=index;distance=d;} });
      toPage(scroller, Math.max(0,Math.min(pages.length-1,current+Number(control.dataset.direction))), !noMotion);
    }
    return true;
  }
  root.addEventListener('scroll', event => {
    if (event.target.id !== 'shopping-categories' || pending) return;
    pending = requestAnimationFrame(() => {pending=0; updateCategoryTab();});
  }, { capture:true, passive:true });
  return { remember, restore, handle };
}
