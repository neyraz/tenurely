/* ============================================================
   Charts: hand-drawn SVG/HTML, no libraries.
   Rules followed: thin marks (<=24px), 4px rounded data ends,
   2px surface gaps, hairline solid grid, one axis, legend for
   2+ series, tooltips on hover and focus (textContent only),
   and a table view behind every chart.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h, s = A.s;

  /* ---------- Tooltip ---------- */
  let tipEl = null;
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = h('div', { class: 'tip', role: 'tooltip', hidden: true });
    document.body.appendChild(tipEl);
    window.addEventListener('scroll', () => A.tip.hide(), true);
    return tipEl;
  }
  A.tip = {
    /* anchor: PointerEvent-like {clientX, clientY} or an element */
    show(anchor, title, rows) {
      const el = ensureTip();
      A.clear(el);
      if (title) el.appendChild(h('div', { class: 'tip-title' }, title));
      (rows || []).forEach(r => {
        el.appendChild(h('div', { class: 'tip-row' },
          r.color ? h('i', { class: 'tip-key', style: { background: r.color } }) : null,
          h('strong', null, r.value),
          r.label ? h('span', null, r.label) : null));
      });
      el.hidden = false;
      let x, y;
      if (anchor && anchor.getBoundingClientRect) {
        const b = anchor.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top;
      } else { x = anchor.clientX; y = anchor.clientY; }
      const tw = el.offsetWidth, th = el.offsetHeight;
      let left = x + 14, top = y - th - 12;
      if (left + tw > window.innerWidth - 8) left = x - tw - 14;
      if (left < 8) left = 8;
      if (top < 8) top = y + 18;
      el.style.left = left + 'px'; el.style.top = top + 'px';
    },
    hide() { if (tipEl) tipEl.hidden = true; },
  };
  function wireTip(el, getContent, opts) {
    const show = e => { const c = getContent(); A.tip.show(opts && opts.focusAnchor && e.type === 'focus' ? opts.focusAnchor : e, c.title, c.rows); };
    el.addEventListener('pointermove', show);
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointerleave', () => A.tip.hide());
    el.addEventListener('focus', show);
    el.addEventListener('blur', () => A.tip.hide());
  }

  /* ---------- Scales ---------- */
  function niceScale(max, n) {
    n = n || 4;
    if (!(max > 0)) max = 1;
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { top, ticks };
  }
  const topRounded = (x, y, w, hh, r) => {
    r = Math.max(0, Math.min(r, w / 2, hh));
    return 'M' + x + ',' + (y + hh) + ' V' + (y + r) + ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y + ' H' + (x + w - r) + ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + ' V' + (y + hh) + ' Z';
  };

  /* ---------- Table view ---------- */
  A.dataTable = function (t) {
    const num = new Set(t.num || []);
    return h('div', { class: 'table-wrap' },
      h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, t.head.map((c, i) => h('th', { scope: 'col', class: num.has(i) ? 'num' : '' }, c)))),
        h('tbody', null, t.rows.map(r => h('tr', null, r.map((c, i) => h('td', { class: num.has(i) ? 'num' : '' }, c === null || c === undefined ? '' : String(c))))))));
  };

  /* ---------- Chart card: title, legend, table toggle, responsive redraw ---------- */
  A.chartCard = function (o) {
    const body = h('div', { class: 'chart-body' });
    const legend = h('div', { class: 'legend', hidden: true });
    const btn = h('button', { class: 'btn quiet sm', type: 'button', 'aria-pressed': 'false', title: 'Switch between the chart and its data table' }, 'Table');
    const card = h('section', { class: 'card chart-card' + (o.className ? ' ' + o.className : '') },
      h('header', { class: 'card-head' },
        h('div', null, h('h3', null, o.title), o.sub ? h('p', { class: 'sub' }, o.sub) : null),
        h('div', { class: 'card-tools' }, o.tools || null, btn)),
      body, legend);
    let showTable = false, lastW = 0, raf = 0, cur = null;
    function render() {
      const w = Math.floor(body.clientWidth);
      if (!w) return;
      lastW = w;
      try { cur = o.draw(w); } catch (e) { console.error(e); cur = { node: h('p', { class: 'empty' }, 'This chart could not be drawn.'), table: { head: [], rows: [] } }; }
      A.clear(body);
      body.appendChild(showTable ? A.dataTable(cur.table) : cur.node);
      A.clear(legend);
      const items = cur.legend || [];
      legend.hidden = items.length < 2 || showTable;
      items.forEach(it => legend.appendChild(h('span', { class: 'lg' }, h('i', { style: { background: it.color } }), it.label)));
    }
    btn.addEventListener('click', () => { showTable = !showTable; btn.setAttribute('aria-pressed', String(showTable)); btn.textContent = showTable ? 'Chart' : 'Table'; render(); });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        const w = Math.floor(body.clientWidth);
        if (w && Math.abs(w - lastW) > 6) { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
      }).observe(body);
    } else requestAnimationFrame(render);
    return card;
  };

  /* ---------- Horizontal bars (HTML) ---------- */
  /* items: [{label, value, sub?, onClick?}] */
  A.hbars = function (items, o) {
    o = o || {};
    const max = Math.max(1, ...items.map(i => i.value));
    const fmt = o.fmt || A.n;
    const wrap = h('div', { class: 'hbars', role: 'list' });
    items.forEach(it => {
      const bar = h('span', { class: 'hb-bar', style: { flexBasis: 'calc((100% - 56px) * ' + (it.value / max).toFixed(4) + ')', background: o.color || 'var(--s1)' } });
      const row = h('div', { class: 'hb-row' + (it.onClick ? ' click' : ''), role: 'listitem', tabindex: '0', 'aria-label': it.label + ': ' + fmt(it.value) },
        h('span', { class: 'hb-label', title: it.label }, it.label),
        h('span', { class: 'hb-track' }, bar, h('span', { class: 'hb-val' }, fmt(it.value))));
      wireTip(row, () => ({ title: it.label, rows: [{ value: fmt(it.value), label: it.sub || o.unit || '' }] }));
      if (it.onClick) {
        row.addEventListener('click', it.onClick);
        row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.onClick(); } });
      }
      wrap.appendChild(row);
    });
    return {
      node: wrap,
      table: { head: [o.labelName || 'Category', o.valueName || 'Count'], rows: items.map(i => [i.label, fmt(i.value)]), num: [1] },
    };
  };

  /* ---------- Columns (time or category), single series ---------- */
  /* data: [{label, v, tipTitle?}] */
  A.columns = function (data, w, o) {
    o = o || {};
    const H = o.height || 220, m = { l: 36, r: 6, t: 10, b: 26 };
    const pw = w - m.l - m.r, ph = H - m.t - m.b;
    const sc = niceScale(Math.max(1, ...data.map(d => d.v)), 4);
    const y = v => m.t + ph - (v / sc.top) * ph;
    const svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.aria || 'Column chart' });
    sc.ticks.forEach(t => {
      svg.appendChild(s('line', { x1: m.l, x2: w - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: m.l - 6, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, A.compact(t)));
    });
    const band = pw / Math.max(1, data.length);
    const bw = Math.max(1.5, Math.min(24, band - 2));
    const maxLen = Math.max(1, ...data.map(d => String(d.label).length));
    const every = Math.max(1, Math.ceil((maxLen * 6.4 + 12) / band));
    data.forEach((d, i) => {
      const cx = m.l + band * i + band / 2, x0 = cx - bw / 2;
      const bh = d.v > 0 ? Math.max(2, (d.v / sc.top) * ph) : 0;
      let bar = null;
      if (bh) { bar = s('path', { d: topRounded(x0, m.t + ph - bh, bw, bh, 4), class: 'mark', style: { fill: o.color || 'var(--s1)' } }); svg.appendChild(bar); }
      if (i % every === 0) svg.appendChild(s('text', { x: cx, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, d.label));
      const hit = s('rect', { x: m.l + band * i, y: m.t, width: band, height: ph + m.b, class: 'hit', tabindex: '0', role: 'img', 'aria-label': (d.tipTitle || d.label) + ': ' + d.v });
      wireTip(hit, () => ({ title: d.tipTitle || d.label, rows: [{ color: o.color || 'var(--s1)', value: A.n(d.v), label: o.unit || '' }] }), { focusAnchor: bar || hit });
      if (bar) { hit.addEventListener('pointerenter', () => bar.classList.add('hot')); hit.addEventListener('pointerleave', () => bar.classList.remove('hot')); hit.addEventListener('focus', () => bar.classList.add('hot')); hit.addEventListener('blur', () => bar.classList.remove('hot')); }
      svg.appendChild(hit);
    });
    return { node: svg, table: { head: [o.xName || 'Period', o.valueName || 'Count'], rows: data.map(d => [d.tipTitle || d.label, A.n(d.v)]), num: [1] } };
  };

  /* ---------- Stacked columns, several series (fixed colour per series) ---------- */
  /* cats: [{label, tipTitle?}], series: [{name, color, values:[]}] */
  A.stacked = function (cats, series, w, o) {
    o = o || {};
    const H = o.height || 240, m = { l: 36, r: 6, t: 10, b: 26 };
    const pw = w - m.l - m.r, ph = H - m.t - m.b;
    const totals = cats.map((c, i) => A.sum(series.map(sr => sr.values[i] || 0)));
    const sc = niceScale(Math.max(1, ...totals), 4);
    const y = v => m.t + ph - (v / sc.top) * ph;
    const svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.aria || 'Stacked column chart' });
    sc.ticks.forEach(t => {
      svg.appendChild(s('line', { x1: m.l, x2: w - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: m.l - 6, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, A.compact(t)));
    });
    const band = pw / Math.max(1, cats.length), bw = Math.max(2, Math.min(24, band - 2));
    const maxLen = Math.max(1, ...cats.map(c => String(c.label).length));
    const every = Math.max(1, Math.ceil((maxLen * 6.4 + 12) / band));
    cats.forEach((c, i) => {
      const cx = m.l + band * i + band / 2, x0 = cx - bw / 2;
      let acc = 0;
      const segs = series.map(sr => ({ sr, v: sr.values[i] || 0 })).filter(z => z.v > 0);
      segs.forEach((z, k) => {
        const yTop = y(acc + z.v), yBot = y(acc);
        const hh = Math.max(1, yBot - yTop - (k > 0 ? 2 : 0)); // 2px surface gap between segments
        const top = k === segs.length - 1;
        const yy = yTop; // the 2px gap sits at the bottom edge, between this segment and the one below
        const p = top ? s('path', { d: topRounded(x0, yy, bw, hh, 4), style: { fill: z.sr.color } }) : s('rect', { x: x0, y: yy, width: bw, height: hh, style: { fill: z.sr.color } });
        p.setAttribute('class', 'mark');
        svg.appendChild(p);
        acc += z.v;
      });
      if (i % every === 0) svg.appendChild(s('text', { x: cx, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, c.label));
      const hit = s('rect', { x: m.l + band * i, y: m.t, width: band, height: ph + m.b, class: 'hit', tabindex: '0', role: 'img', 'aria-label': (c.tipTitle || c.label) + ': ' + totals[i] });
      wireTip(hit, () => ({ title: (c.tipTitle || c.label) + ' – ' + A.n(totals[i]) + ' total', rows: series.filter(sr => (sr.values[i] || 0) > 0).reverse().map(sr => ({ color: sr.color, value: A.n(sr.values[i]), label: sr.name })) }));
      svg.appendChild(hit);
    });
    return {
      node: svg,
      legend: series.map(sr => ({ label: sr.name, color: sr.color })),
      table: { head: [o.xName || 'Period'].concat(series.map(sr => sr.name), ['Total']), rows: cats.map((c, i) => [c.tipTitle || c.label].concat(series.map(sr => A.n(sr.values[i] || 0)), [A.n(totals[i])])), num: series.map((_, i) => i + 1).concat([series.length + 1]) },
    };
  };

  /* ---------- Cumulative line + 10% area ---------- */
  /* pts: [{t (ms), v}] ascending */
  A.areaLine = function (pts, w, o) {
    o = o || {};
    const H = o.height || 220, m = { l: 40, r: 14, t: 10, b: 26 };
    const pw = w - m.l - m.r, ph = H - m.t - m.b;
    const sc = niceScale(Math.max(1, ...pts.map(p => p.v)), 4);
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const x = t => m.l + (t1 === t0 ? pw / 2 : ((t - t0) / (t1 - t0)) * pw);
    const y = v => m.t + ph - (v / sc.top) * ph;
    const svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.aria || 'Line chart' });
    sc.ticks.forEach(t => {
      svg.appendChild(s('line', { x1: m.l, x2: w - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: m.l - 6, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, A.compact(t)));
    });
    // month ticks on x
    let d = new Date(A.monthStart(t0)); const ticks = [];
    while (d.getTime() <= t1) { if (d.getTime() >= t0 - 2 * A.DAY) ticks.push(d.getTime()); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
    const every = Math.max(1, Math.ceil(46 / (pw / Math.max(1, ticks.length))));
    ticks.forEach((t, i) => { if (i % every === 0) svg.appendChild(s('text', { x: x(t), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, A.MON[new Date(t).getUTCMonth()])); });
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
    svg.appendChild(s('path', { d: line + ' L' + x(t1).toFixed(1) + ',' + y(0) + ' L' + x(t0).toFixed(1) + ',' + y(0) + ' Z', style: { fill: o.color || 'var(--s1)', opacity: '0.10' } }));
    svg.appendChild(s('path', { d: line, class: 'line', style: { stroke: o.color || 'var(--s1)' } }));
    const last = pts[pts.length - 1];
    svg.appendChild(s('circle', { cx: x(last.t), cy: y(last.v), r: 4.5, class: 'dot', style: { fill: o.color || 'var(--s1)' } }));
    svg.appendChild(s('text', { x: x(last.t) - 8, y: y(last.v) - 10, class: 'endlabel', 'text-anchor': 'end' }, A.n(last.v)));
    const cross = s('line', { y1: m.t, y2: m.t + ph, class: 'cross', visibility: 'hidden' });
    const dot = s('circle', { r: 4.5, class: 'dot', visibility: 'hidden', style: { fill: o.color || 'var(--s1)' } });
    svg.appendChild(cross); svg.appendChild(dot);
    const hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph + m.b, class: 'hit', tabindex: '0', role: 'img', 'aria-label': o.aria || 'Line chart' });
    function at(e) {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (w / r.width);
      let best = 0, bd = Infinity;
      pts.forEach((p, i) => { const dd = Math.abs(x(p.t) - px); if (dd < bd) { bd = dd; best = i; } });
      const p = pts[best];
      cross.setAttribute('x1', x(p.t)); cross.setAttribute('x2', x(p.t)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(p.t)); dot.setAttribute('cy', y(p.v)); dot.setAttribute('visibility', 'visible');
      A.tip.show(e, A.fmtDate(p.t), [{ color: o.color || 'var(--s1)', value: A.n(p.v), label: o.unit || '' }]);
    }
    hit.addEventListener('pointermove', at);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); A.tip.hide(); });
    svg.appendChild(hit);
    return { node: svg, table: { head: ['Date', o.valueName || 'Total'], rows: pts.map(p => [A.fmtDate(p.t), A.n(p.v)]), num: [1] } };
  };

  /* ---------- Scatter with nearest-point hover ---------- */
  /* pts: [{x, y, label, sub}] */
  A.scatter = function (pts, w, o) {
    o = o || {};
    const H = o.height || 280, m = { l: 40, r: 12, t: 12, b: 38 };
    const pw = w - m.l - m.r, ph = H - m.t - m.b;
    const sx = niceScale(Math.max(1, ...pts.map(p => p.x)), 5), sy = niceScale(Math.max(1, ...pts.map(p => p.y)), 4);
    const X = v => m.l + (v / sx.top) * pw, Y = v => m.t + ph - (v / sy.top) * ph;
    const svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.aria || 'Scatter plot' });
    sy.ticks.forEach(t => {
      svg.appendChild(s('line', { x1: m.l, x2: w - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: m.l - 6, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, A.compact(t)));
    });
    sx.ticks.forEach(t => svg.appendChild(s('text', { x: X(t), y: m.t + ph + 16, class: 'tick', 'text-anchor': 'middle' }, A.compact(t))));
    svg.appendChild(s('text', { x: m.l + pw / 2, y: H - 4, class: 'axis-title', 'text-anchor': 'middle' }, o.xName || ''));
    svg.appendChild(s('text', { x: 12, y: m.t + ph / 2, class: 'axis-title', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (m.t + ph / 2) + ')' }, o.yName || ''));
    // group identical coordinates
    const groups = new Map();
    pts.forEach(p => { const k = p.x + '|' + p.y; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    const G = [...groups.values()];
    G.forEach(g => svg.appendChild(s('circle', { cx: X(g[0].x), cy: Y(g[0].y), r: 5, class: 'dot', style: { fill: o.color || 'var(--s1)' } })));
    const ring = s('circle', { r: 9, class: 'ring', visibility: 'hidden' });
    svg.appendChild(ring);
    const hit = s('rect', { x: 0, y: 0, width: w, height: H, class: 'hit', tabindex: '0', role: 'img', 'aria-label': o.aria || 'Scatter plot' });
    hit.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (w / r.width), py = (e.clientY - r.top) * (H / r.height);
      let best = null, bd = 28 * 28;
      G.forEach(g => { const dx = X(g[0].x) - px, dy = Y(g[0].y) - py, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = g; } });
      if (!best) { ring.setAttribute('visibility', 'hidden'); A.tip.hide(); return; }
      ring.setAttribute('cx', X(best[0].x)); ring.setAttribute('cy', Y(best[0].y)); ring.setAttribute('visibility', 'visible');
      A.tip.show(e, best.length > 1 ? best.length + ' respondents' : (best[0].label || 'Respondent'), [{ color: o.color || 'var(--s1)', value: A.n(best[0].x), label: o.xName || 'x' }, { color: o.color || 'var(--s1)', value: A.n(best[0].y), label: o.yName || 'y' }].concat(best.length === 1 && best[0].sub ? [{ value: '', label: best[0].sub }] : []));
    });
    hit.addEventListener('pointerleave', () => { ring.setAttribute('visibility', 'hidden'); A.tip.hide(); });
    svg.appendChild(hit);
    return { node: svg, table: { head: ['Respondent', o.xName || 'x', o.yName || 'y'], rows: pts.map((p, i) => [p.label || '#' + (i + 1), A.n(p.x), A.n(p.y)]), num: [1, 2] } };
  };

  /* ---------- Dumbbell: two values per row on one money axis ---------- */
  /* rows: [{label, a, b}] */
  A.dumbbell = function (rows, w, o) {
    o = o || {};
    const rowH = 30, m = { l: Math.min(190, Math.max(96, w * 0.34)), r: 16, t: 8, b: 28 };
    const H = m.t + rows.length * rowH + m.b, pw = w - m.l - m.r;
    const vals = rows.flatMap(r => [r.a, r.b]).filter(v => v !== null && v !== undefined);
    const sc = niceScale(Math.max(1, ...vals), 4);
    const X = v => m.l + (v / sc.top) * pw;
    const svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.aria || 'Comparison chart' });
    sc.ticks.forEach(t => {
      svg.appendChild(s('line', { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: t === 0 ? 'axis' : 'grid' }));
      svg.appendChild(s('text', { x: X(t), y: H - 10, class: 'tick', 'text-anchor': 'middle' }, o.fmt ? o.fmt(t) : A.compact(t)));
    });
    const maxChars = Math.floor((m.l - 12) / 6.3);
    rows.forEach((r, i) => {
      const cy = m.t + i * rowH + rowH / 2;
      const lab = r.label.length > maxChars ? r.label.slice(0, maxChars - 1) + '…' : r.label;
      svg.appendChild(s('text', { x: m.l - 10, y: cy + 4, class: 'rowlabel', 'text-anchor': 'end' }, lab));
      if (r.a !== null && r.a !== undefined && r.b !== null && r.b !== undefined) svg.appendChild(s('line', { x1: X(r.a), x2: X(r.b), y1: cy, y2: cy, class: 'link' }));
      if (r.a !== null && r.a !== undefined) svg.appendChild(s('circle', { cx: X(r.a), cy, r: 5, class: 'dot', style: { fill: o.aColor } }));
      if (r.b !== null && r.b !== undefined) svg.appendChild(s('circle', { cx: X(r.b), cy, r: 5, class: 'dot', style: { fill: o.bColor } }));
      const hit = s('rect', { x: 0, y: cy - rowH / 2, width: w, height: rowH, class: 'hit', tabindex: '0', role: 'img', 'aria-label': r.label });
      wireTip(hit, () => ({ title: r.label, rows: [{ color: o.aColor, value: r.a === null || r.a === undefined ? 'n/a' : o.fmt(r.a), label: o.aName }, { color: o.bColor, value: r.b === null || r.b === undefined ? 'n/a' : o.fmt(r.b), label: o.bName }] }));
      svg.appendChild(hit);
    });
    return {
      node: svg,
      legend: [{ label: o.aName, color: o.aColor }, { label: o.bName, color: o.bColor }],
      table: { head: ['Entry', o.aName, o.bName], rows: rows.map(r => [r.label, r.a === null || r.a === undefined ? '' : o.fmt(r.a), r.b === null || r.b === undefined ? '' : o.fmt(r.b)]), num: [1, 2] },
    };
  };

  /* ---------- US tile map (each state is one square) ---------- */
  const TILES = { AK: [0, 0], ME: [10, 0], WI: [5, 1], VT: [9, 1], NH: [10, 1], WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2], OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], RI: [10, 3], CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4], AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5], OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6], HI: [0, 7], TX: [3, 7], FL: [8, 7] };
  A.tileMap = function (counts, w, o) {
    o = o || {};
    const gap = 3, cols = 11, rowsN = 8;
    const size = Math.max(22, Math.min(46, Math.floor((w - gap * (cols - 1)) / cols)));
    const W = cols * size + gap * (cols - 1), H = rowsN * size + gap * (rowsN - 1);
    const max = Math.max(1, ...Object.keys(TILES).map(k => counts.get(k) || 0));
    const bin = v => (v <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((v / max) * 5 - 1e-9))));
    const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'tilemap', role: 'group', 'aria-label': o.aria || 'Map of US states by count' });
    Object.keys(TILES).forEach(code => {
      const v = counts.get(code) || 0, b = bin(v), [cx, cy] = TILES[code];
      const x = cx * (size + gap), y = cy * (size + gap);
      const g = s('g', { class: 'tile b' + b + (o.onClick && v ? ' click' : ''), tabindex: '0', role: 'img', 'aria-label': A.STATES[code] + ': ' + v });
      g.appendChild(s('rect', { x, y, width: size, height: size, rx: 4 }));
      g.appendChild(s('text', { x: x + size / 2, y: y + size / 2 + 4, 'text-anchor': 'middle' }, code));
      wireTip(g, () => ({ title: A.STATES[code], rows: [{ value: A.n(v), label: o.unit || 'postings' }] }));
      if (o.onClick && v) { g.addEventListener('click', () => o.onClick(code)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onClick(code); } }); }
      svg.appendChild(g);
    });
    const rows = Object.keys(counts instanceof Map ? Object.fromEntries(counts) : {}).sort((a, b) => counts.get(b) - counts.get(a));
    const scale = h('div', { class: 'scale' },
      h('span', null, 'Fewer'),
      [1, 2, 3, 4, 5].map(i => h('i', { class: 'sw b' + i })),
      h('span', null, 'More (up to ' + A.n(max) + ')'));
    return { node: h('div', { class: 'tilemap-wrap' }, svg, scale), table: { head: ['State', o.unit || 'Postings'], rows: rows.map(k => [A.STATES[k] || k, A.n(counts.get(k))]), num: [1] } };
  };

  /* ---------- One whole split into parts (tall segmented bar) ---------- */
  /* parts: [{label, value, color, ink}] */
  A.segBar = function (parts, o) {
    o = o || {};
    parts = parts.filter(p => p.value > 0);
    const total = A.sum(parts.map(p => p.value)) || 1;
    const bar = h('div', { class: 'segbar', role: 'img', 'aria-label': (o.aria || 'Breakdown') + ': ' + parts.map(p => p.label + ' ' + p.value).join(', ') });
    parts.forEach(p => {
      const share = p.value / total;
      const seg = h('span', { class: 'seg', tabindex: '0', style: { flexGrow: String(p.value), background: p.color, color: p.ink || '#fff' } }, share >= 0.09 ? Math.round(share * 100) + '%' : '');
      wireTip(seg, () => ({ title: p.label, rows: [{ color: p.color, value: A.n(p.value), label: A.pct(share, 1) + ' of ' + A.n(total) }] }));
      if (o.onClick && p.onClick) { seg.classList.add('click'); seg.addEventListener('click', p.onClick); }
      bar.appendChild(seg);
    });
    const legend = h('div', { class: 'legend flush' }, parts.map(p => h('span', { class: 'lg' }, h('i', { style: { background: p.color } }), p.label + ' ' + A.n(p.value))));
    return { node: h('div', null, bar, legend), table: { head: [o.name || 'Category', 'Count', 'Share'], rows: parts.map(p => [p.label, A.n(p.value), A.pct(p.value / total, 1)]), num: [1, 2] } };
  };
})();
