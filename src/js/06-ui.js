/* ============================================================
   Shared UI: icons, remembered state, and the reusable
   search + filter + sort list used by most screens.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h, s = A.s;

  /* ---------- Icons (stroke, 24px grid) ---------- */
  const ICON = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    file: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/>',
  };
  A.icon = function (name, size, filled) {
    const svg = s('svg', { viewBox: '0 0 24 24', width: size || 16, height: size || 16, fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
    svg.innerHTML = ICON[name] || ''; // static, trusted markup only
    return svg;
  };
  A.brandMark = function () {
    const svg = s('svg', { viewBox: '0 0 30 30', width: 30, height: 30, 'aria-hidden': 'true' });
    const o = [[0, 0, .28], [1, 0, .55], [2, 0, 1], [0, 1, .55], [1, 1, 1], [2, 1, .4], [0, 2, 1], [1, 2, .4], [2, 2, .75]];
    o.forEach(([cx, cy, op]) => svg.appendChild(s('rect', { x: cx * 10 + 1, y: cy * 10 + 1, width: 8, height: 8, rx: 2, style: { fill: 'var(--accent)', opacity: String(op) } })));
    return svg;
  };

  /* ---------- Shared state ---------- */
  A.UI = { state: {}, prevVisit: null, keywords: [], saved: new Set() };
  A.postKey = p => (A.norm(p.university) + '|' + A.norm(p.department) + '|' + (p.url || '')).slice(0, 220);
  A.toggleSaved = function (key) {
    if (A.UI.saved.has(key)) A.UI.saved.delete(key); else A.UI.saved.add(key);
    A.store.set('saved', [...A.UI.saved]);
  };

  /* ---------- Small builders ---------- */
  A.go = function (view, params) {
    const q = params ? Object.keys(params).filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&') : '';
    location.hash = '#/' + view + (q ? '?' + q : '');
  };
  A.chip = (text, cls, onClick) => {
    const c = h('span', { class: 'chip' + (cls ? ' ' + cls : '') + (onClick ? ' link' : ''), title: text }, text);
    if (onClick) { c.setAttribute('role', 'link'); c.tabIndex = 0; c.addEventListener('click', onClick); c.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(); }); }
    return c;
  };
  A.extButton = (url, label) => h('a', { class: 'btn sm', href: A.safeUrl(url), target: '_blank', rel: 'noopener noreferrer', title: url }, label || 'Open posting', A.icon('ext', 13));
  A.pageHead = (title, lede) => h('div', { class: 'pagehead' }, h('h1', null, title), lede ? h('p', { class: 'lede' }, lede) : null);
  A.emptyState = (title, text) => h('div', { class: 'empty' }, h('b', null, title), text || '');
  A.badge = (label, color) => h('span', { class: 'badge' }, h('i', { style: { background: color } }), label);
  A.RESP_COLOR = { 'Remote interview': 'var(--s1)', 'Onsite interview': 'var(--s2)', 'Offer': 'var(--s3)', 'Reference letters requested': 'var(--s4)', 'Rejection': 'var(--s5)', 'Other': 'var(--s6)', 'No response logged': 'var(--axis)' };
  A.RESP_INK = { 'Reference letters requested': '#0b0b0b' };

  /* A few notes shown, the rest behind a toggle. */
  A.notesBlock = function (notes, re, keep) {
    keep = keep || 2;
    if (!notes || !notes.length) return null;
    const box = h('div', { class: 'notes' });
    const mk = n => h('div', { class: 'note' }, A.rich(n, re));
    notes.slice(0, keep).forEach(n => box.appendChild(mk(n)));
    if (notes.length > keep) {
      const rest = notes.slice(keep);
      const btn = h('button', { class: 'linkbtn', type: 'button' }, 'Show ' + rest.length + ' more ' + (rest.length === 1 ? 'comment' : 'comments'));
      let open = false; const extra = [];
      btn.addEventListener('click', () => {
        open = !open;
        if (open) { rest.forEach(n => { const e = mk(n); extra.push(e); box.insertBefore(e, btn); }); btn.textContent = 'Show fewer'; }
        else { extra.splice(0).forEach(e => e.remove()); btn.textContent = 'Show ' + rest.length + ' more ' + (rest.length === 1 ? 'comment' : 'comments'); }
      });
      box.appendChild(btn);
    }
    return box;
  };

  A.thread = function (head, messages, re, keepReplies) {
    keepReplies = keepReplies || 3;
    const el = h('article', { class: 'thread' }, head, h('div', { class: 'post' }, A.rich(messages[0], re)));
    if (messages.length > 1) {
      const rep = h('div', { class: 'replies' });
      const mk = m => h('div', { class: 'reply' }, A.rich(m, re));
      messages.slice(1, 1 + keepReplies).forEach(m => rep.appendChild(mk(m)));
      if (messages.length - 1 > keepReplies) {
        const rest = messages.slice(1 + keepReplies);
        let open = false; const extra = [];
        const label = () => 'Show ' + rest.length + ' more ' + (rest.length === 1 ? 'reply' : 'replies');
        const btn = h('button', { class: 'linkbtn', type: 'button' }, label());
        btn.addEventListener('click', () => {
          open = !open;
          if (open) { rest.forEach(m => { const e = mk(m); extra.push(e); rep.insertBefore(e, btn); }); btn.textContent = 'Show fewer replies'; }
          else { extra.splice(0).forEach(e => e.remove()); btn.textContent = label(); }
        });
        rep.appendChild(btn);
      }
      el.appendChild(rep);
    }
    return el;
  };

  /* ---------- CSV export ---------- */
  A.downloadCsv = function (name, head, rows) {
    const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const csv = '﻿' + [head].concat(rows).map(r => r.map(q).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /* ---------- The reusable list ---------- */
  /* cfg: {id, items, placeholder, noun, filters:[{key,label,values(item),order?}],
           toggles:[{key,label,test(item)}], sorts:[{key,label,cmp}], row(item,ctx), csv:{name,cols:[[label,fn]]},
           params, pageSize, emptyText} */
  A.listView = function (cfg) {
    const page = cfg.pageSize || 40;
    const st = A.UI.state[cfg.id] || (A.UI.state[cfg.id] = { q: '', f: {}, sort: cfg.sorts[0].key, on: {}, shown: page });
    const P = {};
    Object.keys(cfg.params || {}).forEach(k => { if (cfg.params[k] !== undefined && cfg.params[k] !== '') P[k] = cfg.params[k]; });
    if (Object.keys(P).length) { st.q = ''; st.f = {}; st.on = {}; } // arriving from a link starts a fresh view
    if (P.q !== undefined) st.q = P.q;
    (cfg.filters || []).forEach(f => { if (P[f.key] !== undefined) st.f[f.key] = P[f.key]; });
    (cfg.toggles || []).forEach(t => { if (P[t.key] !== undefined) st.on[t.key] = P[t.key] === '1'; });
    if (P.sort) st.sort = P.sort;
    if (Object.keys(P).length) st.shown = page;
    if (!cfg.sorts.some(x => x.key === st.sort)) st.sort = cfg.sorts[0].key;

    const arr = v => (Array.isArray(v) ? v : [v]).filter(x => x !== '' && x !== null && x !== undefined);
    const root = h('div', { class: 'listview' });
    const input = h('input', { class: 'input', type: 'text', placeholder: cfg.placeholder || 'Search', value: st.q, 'aria-label': cfg.placeholder || 'Search', autocomplete: 'off', spellcheck: 'false' });
    const clearQ = h('button', { class: 'btn quiet icon sm clear', type: 'button', 'aria-label': 'Clear search', hidden: !st.q }, A.icon('x', 14));
    const toolbar = h('div', { class: 'toolbar' }, h('div', { class: 'search' }, A.icon('search', 16), input, clearQ));

    const selects = {};
    (cfg.filters || []).forEach(f => {
      const counts = new Map();
      cfg.items.forEach(it => arr(f.values(it)).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
      if (st.f[f.key] && !counts.has(st.f[f.key])) counts.set(st.f[f.key], 0);
      const rank = v => { const i = f.order ? f.order.indexOf(v) : -1; return i < 0 ? 999 : i; };
      const opts = [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
      const sel = h('select', { class: 'input', 'aria-label': f.label }, h('option', { value: '' }, 'All ' + f.label.toLowerCase()), opts.map(([v, n]) => h('option', { value: v }, (f.fmt ? f.fmt(v) : v) + ' (' + n + ')')));
      sel.value = st.f[f.key] || '';
      sel.addEventListener('change', () => { st.f[f.key] = sel.value; st.shown = page; draw(); });
      selects[f.key] = sel;
      toolbar.appendChild(sel);
    });
    const sortSel = h('select', { class: 'input', 'aria-label': 'Sort order' }, cfg.sorts.map(x => h('option', { value: x.key }, x.label)));
    sortSel.value = st.sort;
    sortSel.addEventListener('change', () => { st.sort = sortSel.value; st.shown = page; draw(); });
    toolbar.appendChild(sortSel);
    root.appendChild(toolbar);

    const toggleBtns = {};
    if ((cfg.toggles || []).length) {
      const bar = h('div', { class: 'togglebar' });
      cfg.toggles.forEach(t => {
        const b = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': String(!!st.on[t.key]) }, t.label);
        b.addEventListener('click', () => { st.on[t.key] = !st.on[t.key]; b.setAttribute('aria-pressed', String(!!st.on[t.key])); st.shown = page; draw(); });
        toggleBtns[t.key] = b; bar.appendChild(b);
      });
      root.appendChild(bar);
    }

    const count = h('span', null);
    const tools = h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } });
    const resetBtn = h('button', { class: 'linkbtn', type: 'button', hidden: true }, 'Clear filters');
    const csvBtn = cfg.csv ? h('button', { class: 'btn quiet sm', type: 'button', title: 'Download the rows currently shown as a CSV file' }, A.icon('download', 14), 'Export CSV') : null;
    tools.appendChild(resetBtn); if (csvBtn) tools.appendChild(csvBtn);
    root.appendChild(h('div', { class: 'countline' }, count, tools));
    const list = h('div', { class: 'list' });
    const more = h('div', { class: 'more', hidden: true });
    root.appendChild(list); root.appendChild(more);

    function terms() { return A.norm(st.q).split(/\s+/).filter(Boolean); }
    function result() {
      const T = terms();
      let items = cfg.items;
      if (T.length) items = items.filter(it => T.every(t => it.text.indexOf(t) >= 0));
      (cfg.filters || []).forEach(f => { const v = st.f[f.key]; if (v) items = items.filter(it => arr(f.values(it)).includes(v)); });
      (cfg.toggles || []).forEach(t => { if (st.on[t.key]) items = items.filter(t.test); });
      const cmp = cfg.sorts.find(x => x.key === st.sort).cmp;
      return items.slice().sort(cmp);
    }
    function active() { return !!(st.q || Object.values(st.f).some(Boolean) || Object.values(st.on).some(Boolean)); }
    let current = [];
    function draw() {
      current = result();
      const T = terms(); const re = A.termsRe(T);
      A.clear(list);
      const ctx = { re, terms: T };
      current.slice(0, st.shown).forEach(it => list.appendChild(cfg.row(it, ctx)));
      if (!current.length) list.appendChild(A.emptyState('Nothing matches', cfg.emptyText || 'Try fewer words or clear a filter.'));
      const total = cfg.items.length;
      count.textContent = current.length === total ? 'Showing ' + A.n(Math.min(st.shown, current.length)) + ' of ' + A.n(total) + ' ' + cfg.noun : A.n(current.length) + ' of ' + A.n(total) + ' ' + cfg.noun + ' match' + (current.length === 1 ? 'es' : '');
      resetBtn.hidden = !active();
      clearQ.hidden = !st.q;
      A.clear(more);
      if (current.length > st.shown) {
        const b = h('button', { class: 'btn', type: 'button' }, 'Show ' + Math.min(page, current.length - st.shown) + ' more (' + A.n(current.length - st.shown) + ' left)');
        b.addEventListener('click', () => { st.shown += page; draw(); });
        more.appendChild(b); more.hidden = false;
      } else more.hidden = true;
    }
    input.addEventListener('input', A.debounce(() => { st.q = input.value; st.shown = page; draw(); }, 120));
    clearQ.addEventListener('click', () => { input.value = ''; st.q = ''; st.shown = page; draw(); input.focus(); });
    resetBtn.addEventListener('click', () => {
      st.q = ''; st.f = {}; st.on = {}; st.shown = page; input.value = '';
      Object.values(selects).forEach(x => { x.value = ''; });
      Object.values(toggleBtns).forEach(b => b.setAttribute('aria-pressed', 'false'));
      draw();
    });
    if (csvBtn) csvBtn.addEventListener('click', () => A.downloadCsv(cfg.csv.name, cfg.csv.cols.map(c => c[0]), current.map(it => cfg.csv.cols.map(c => c[1](it)))));
    draw();
    return root;
  };
})();
