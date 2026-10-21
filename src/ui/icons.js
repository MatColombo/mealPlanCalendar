/** A single rounded, hand-drawn-inspired SVG language for the interface. */
const paths = {
  book: '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15M6 8h2m8 0h2M6 12h2m8 0h2"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  work: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 13c5 3 13 3 18 0m-9 0v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h1m6 0h1m-8 4h1"/>',
  basket: '<path d="m3 9 2 11h14l2-11H3Zm4 0 5-7 5 7M9 13v3m6-3v3"/><path d="M2 9h20"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  arrowRight: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
  leaf: '<path d="M20 3C7 2 1 8 5 16s16 4 15-13ZM5 19 16 8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  warning: '<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2.3 2.3 0 0 0-4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h6"/>',
  restore: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l3 2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0Zm3-4h12M8 4h8M9 21h6"/>',
  heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 7 17 12 21c5-4 13-11 8-16Z"/>',
  motion: '<path d="M3 8h7M2 12h5M4 16h6m4-11 7 7-7 7"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.bowl}</svg>`;
}

/** Decorative food illustrations; these are not photographs or recipe claims. */
export function foodArt(type = 'lunch') {
  const colors = { breakfast: '#ffe5a5', lunch: '#d2eaca', dinner: '#ddd2ef', snack: '#f9c8b6' };
  const fill = Object.hasOwn(colors, type) ? colors[type] : colors.lunch;
  const food = type === 'breakfast'
    ? '<ellipse cx="70" cy="79" rx="38" ry="13" fill="#d59145"/><ellipse cx="70" cy="70" rx="38" ry="13" fill="#f6bf65"/><ellipse cx="70" cy="60" rx="37" ry="12" fill="#ffe099"/><path d="M55 52q15-8 30 0v11q-8 6-16 0t-14 0Z" fill="#c17b46"/><path d="m65 44 19 2-2 12-18-2Z" fill="#fff5bb"/><circle cx="40" cy="66" r="5" fill="#637aab"/><circle cx="94" cy="80" r="5" fill="#637aab"/>'
    : type === 'snack'
      ? '<path d="M67 49c-20-18-45 6-34 33 11 27 27 24 36 18 12 7 26 8 37-18 12-30-15-51-34-33Z" fill="#ee856c"/><path d="M70 51q-3-16 8-22" fill="none" stroke="#53674a" stroke-width="5" stroke-linecap="round"/><path d="M75 34q19-15 31 0-19 9-31 0Z" fill="#77a472"/><path d="M44 61q-9 11-3 22" fill="none" stroke="#ffb2a0" stroke-width="5" stroke-linecap="round"/>'
      : type === 'dinner'
        ? '<path d="M30 61h82q-3 43-40 43T30 61Z" fill="#f7f0de" stroke="#59725b" stroke-width="3"/><ellipse cx="71" cy="62" rx="41" ry="14" fill="#e7b963"/><path d="M43 59q10-20 22 0t25-1m-37 9q10-19 23-2t24-4" fill="none" stroke="#f9de96" stroke-width="6" stroke-linecap="round"/><circle cx="83" cy="54" r="7" fill="#dc7d67"/><path d="m52 42 15-2-7 13Zm37 25 16 3-12 10Z" fill="#6c986d"/>'
        : '<path d="M29 68h85q-5 40-42 40T29 68Z" fill="#f8eedb" stroke="#59725b" stroke-width="3"/><path d="M33 65q-10-26 10-23 3-23 23-10 14-18 25 3 23-8 24 16l-6 18Z" fill="#83ad75"/><path d="M49 58q-1-20 18-14 7-13 22-3l11 24Z" fill="#aec891"/><circle cx="47" cy="60" r="9" fill="#ec9278"/><circle cx="86" cy="56" r="9" fill="#ec9278"/><path d="m62 54 16 5-6 13-16-5Z" fill="#ffe2a7"/>';
  return `<svg class="food-art food-art--${Object.hasOwn(colors, type) ? type : 'lunch'}" viewBox="0 0 140 140" aria-hidden="true" focusable="false"><circle cx="70" cy="70" r="65" fill="${fill}"/><ellipse cx="72" cy="110" rx="43" ry="5" fill="#3c5238" opacity=".09"/>${food}<circle cx="63" cy="88" r="2" fill="#385741"/><circle cx="79" cy="88" r="2" fill="#385741"/><path d="M66 94q5 4 10 0" fill="none" stroke="#385741" stroke-width="2" stroke-linecap="round"/><path d="M113 27v10m-5-5h10M24 37v6m-3-3h6" stroke="#5d7451" stroke-width="2" stroke-linecap="round"/></svg>`;
}
