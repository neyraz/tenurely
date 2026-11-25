/* ============================================================
   Your own layer on top of the sheet. Everything here is kept in
   this browser only: the applications you track, private notes,
   what you have already seen, and your keyword groups.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});

  /* ---------- Institution names ----------
     People type the same place in many ways ("UCSF", "University of California, San Francisco").
     A key keeps only the distinctive words, after expanding common abbreviations. */
  const STOP = new Set(['the', 'of', 'at', 'and', 'in', 'a', 'for', 's', 'university', 'univ', 'u', 'college', 'institute', 'school', 'campus', 'main']);
  const UNIT = new Set(['medicine', 'medical', 'center', 'centre', 'health', 'hospital', 'system', 'langone', 'grossman', 'sciences', 'science', 'research', 'graduate']);
  const ALIAS = [
    [/\bbaylor college of medicine\b/g, 'bcm'], [/\boregon health (and )?sciences? university\b/g, 'ohsu'],
    [/\bwashington university\b/g, 'washu'], [/\bwustl\b/g, 'washu'], [/\bwashu( in)? st louis\b/g, 'washu'], [/\buniversity of washington\b/g, 'uwash'],
    [/\buva\b/g, 'virginia'], [/\butsw\b/g, 'texas southwestern'], [/\but\b/g, 'texas'], [/\butmb\b/g, 'texas medical branch'],
    [/\bucsf\b/g, 'california san francisco'], [/\bucla\b/g, 'california los angeles'], [/\bucsd\b/g, 'california san diego'],
    [/\bucsb\b/g, 'california santa barbara'], [/\buci\b/g, 'california irvine'], [/\bucr\b/g, 'california riverside'],
    [/\bucsc\b/g, 'california santa cruz'], [/\bucb\b/g, 'california berkeley'], [/\buc\b/g, 'california'],
    [/\bunc\b(?!\s*(charlotte|greensboro|wilmington|asheville|pembroke))/g, 'north carolina chapel hill'],
    [/\buab\b/g, 'alabama birmingham'], [/\bu ?chicago\b/g, 'chicago'], [/\bu ?penn\b/g, 'pennsylvania'],
    [/\bu ?mass\b/g, 'massachusetts'], [/\bmusc\b/g, 'medical south carolina'], [/\bnyu\b/g, 'new york'],
    [/\buw madison\b/g, 'wisconsin madison'], [/\bu ?mich\b/g, 'michigan'], [/\buiuc\b/g, 'illinois urbana champaign'],
    [/\bmit\b/g, 'massachusetts technology'], [/\bcaltech\b/g, 'california technology'], [/\bcshl\b/g, 'cold spring harbor laboratory'],
    [/\bcmu\b/g, 'carnegie mellon'], [/\busc\b/g, 'southern california'], [/\bucf\b/g, 'central florida'], [/\busf\b/g, 'south florida'],
    [/\blsu\b/g, 'louisiana state'], [/\bpsu\b/g, 'penn state'], [/\buconn\b/g, 'connecticut'], [/\bjhu\b/g, 'johns hopkins'],
    [/\bupitt\b/g, 'pittsburgh'], [/\bumn\b/g, 'minnesota'], [/\bumd\b/g, 'maryland'], [/\bunm\b/g, 'new mexico'],
    [/\bunl\b/g, 'nebraska lincoln'], [/\bunmc\b/g, 'nebraska medical center'], [/\bvu\b/g, 'vanderbilt'], [/\bsaint\b/g, 'st'],
  ];
  const memo = new Map();
  A.instKey = function (name) {
    const raw = String(name || '');
    if (memo.has(raw)) return memo.get(raw);
    let s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/https?:\S+/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    ALIAS.forEach(([re, to]) => { s = s.replace(re, to); });
    const set = new Set(s.split(' ').filter(w => w && !STOP.has(w)));
    const low = raw.toLowerCase();
    const type = /\buniv(ersity|\.)?\b/.test(low) ? 'u' : (/\bcollege\b(?!\s+of\b)/.test(low) ? 'c' : '');
    const core = [...set].filter(w => !UNIT.has(w)).sort().join(' ');
    const k = { key: [...set].sort().join(' '), core, type };
    memo.set(raw, k);
    return k;
  };
  function osa(a, b) { // edit distance where swapping two neighbouring letters counts as one edit
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  /* Same institution? Same key, or the same core words once "medical center"-type words are set aside,
     or one long word with a single typo. "Boston College" and "Boston University" stay apart. */
  A.sameInst = function (a, b) {
    const x = A.instKey(a), y = A.instKey(b);
    if (!x.key || !y.key) return false;
    if (x.type && y.type && x.type !== y.type) return false;
    if (x.key === y.key) return true;
    if (x.core && x.core === y.core) return true;
    const ax = x.core.split(' '), ay = y.core.split(' ');
    if (!x.core || ax.length !== ay.length) return false;
    const diff = ax.map((w, i) => [w, ay[i]]).filter(([p, q]) => p !== q);
    return diff.length === 1 && diff[0][0].length >= 7 && osa(diff[0][0], diff[0][1]) <= 1;
  };

  /* Do two department descriptions share a real subject word? 'same' | 'other' | 'unknown' */
  const DSTOP = new Set(['department', 'dept', 'school', 'program', 'programs', 'division', 'and', 'the', 'of', 'for', 'in', 'sciences', 'science', 'studies', 'faculty', 'college', 'institute', 'center', 'centre']);
  const dwords = s => new Set(A.norm(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !DSTOP.has(w)).map(w => w.replace(/(ies|y|s)$/, '')));
  A.deptMatch = function (a, b) {
    const x = dwords(a), y = dwords(b);
    if (!x.size || !y.size) return 'unknown';
    for (const w of x) if (y.has(w)) return 'same';
    return 'other';
  };

  /* ---------- What you have already seen ----------
     Each row gets a short fingerprint. Whatever was in the sheet when you last left is "seen";
     anything else is new. Threads and Q&A rows also remember how many replies they had. */
  function fnv(str) {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); }
    return (x >>> 0).toString(36);
  }
  const N = A.norm;
  const FP = {
    post: p => A.postKey(p),
    app: a => [N(a.institution), N(a.department), a.response, a.date, a.submitted].join('|'),
    nores: r => [N(r.institution), N(r.department), r.date, r.deadline].join('|'),
    offer: o => [N(o.institution), N(o.department), o.date, o.status].join('|'),
    froz: o => [N(o.institution), N(o.department), o.date, o.status].join('|'),
    fail: o => [N(o.institution), N(o.department), o.date, o.status].join('|'),
    cult: c => [N(c.institution), N(c.department), N(c.question)].join('|'),
    loc: l => [N(l.city), N(l.question)].join('|'),
    nego: n => [n.label, n.date, n.salaryOffered, n.startupOffered].join('|'),
    com: t => N(t.messages[0]), visa: t => N(t.messages[0]), joy: t => N(t.messages[0]),
  };
  const COUNT = { cult: c => c.notes.length, loc: l => l.notes.length + (l.pros ? 1 : 0) + (l.cons ? 1 : 0), com: t => t.messages.length, visa: t => t.messages.length, joy: t => t.messages.length };
  const TABS = { post: 'postings', app: 'apps', nores: 'noresp', offer: 'offers', froz: 'frozen', fail: 'failed', cult: 'culture', loc: 'locs', nego: 'nego', com: 'comments', visa: 'visa', joy: 'happy' };
  A.KIND_OF_TAB = Object.fromEntries(Object.entries(TABS).map(([k, v]) => [v, k]));

  A.seen = {
    key: null, base: null,
    get ready() { return !!this.base; },
    init(key) { if (this.key === key) return; this.key = key; this.base = A.store.get('seen:' + key, null); },
    fp(kind, item) { return item.__fp || (item.__fp = kind[0] + fnv(kind + '|' + FP[kind](item))); },
    isNew(item, kind) { return this.ready && !(this.fp(kind, item) in this.base); },
    newReplies(item, kind) {
      if (!this.ready || !COUNT[kind]) return 0;
      const f = this.fp(kind, item);
      return f in this.base ? Math.max(0, COUNT[kind](item) - this.base[f]) : 0;
    },
    changed(item, kind) { return this.isNew(item, kind) || this.newReplies(item, kind) > 0; },
    snapshot(db) {
      const m = {};
      Object.entries(TABS).forEach(([kind, tab]) => (db[tab] || []).forEach(it => { m[this.fp(kind, it)] = COUNT[kind] ? COUNT[kind](it) : 1; }));
      return m;
    },
    commit(db) { if (db && this.key) A.store.set('seen:' + this.key, this.snapshot(db)); },
    markAll(db) { this.base = this.snapshot(db); this.commit(db); },
    forget(key) { A.store.del('seen:' + key); if (this.key === key) this.base = null; },
  };

  /* ---------- Keyword groups ----------
     Settings text, one group per line: "Microbiology: microbiolog, bacteri, pathogen". A line without a
     name joins the first group. Excluded words stop a posting from counting as a match. */
  A.parseKeywords = function (text) {
    const groups = []; let plain = null;
    String(text || '').split(/\n+/).forEach(line => {
      line = line.trim(); if (!line) return;
      const m = line.match(/^([^:,]{1,40}):\s*(.*)$/);
      const words = (m ? m[2] : line).split(/[,;]/).map(w => w.trim()).filter(w => w.length > 1);
      if (!words.length) return;
      if (m) groups.push({ name: m[1].trim(), words });
      else { if (!plain) plain = { name: 'My keywords', words: [] }; plain.words.push(...words); }
    });
    return (plain ? [plain] : []).concat(groups).map(g => ({ name: g.name, words: [...new Set(g.words)] }));
  };
  A.keywordText = groups => groups.map(g => (groups.length > 1 || g.name !== 'My keywords' ? g.name + ': ' : '') + g.words.join(', ')).join('\n');
  A.kwGroupsOf = function (item) {
    const U = A.UI;
    if (!U.kwGroups || !U.kwGroups.length) return [];
    if (A.isExcluded(item)) return [];
    return U.kwGroups.filter(g => g.words.some(w => item.text.indexOf(A.norm(w)) >= 0)).map(g => g.name);
  };
  A.isExcluded = item => (A.UI.exclude || []).some(w => w.length > 1 && item.text.indexOf(A.norm(w)) >= 0);

  /* A list filter for rows that are new, or have new replies, since your last visit. */
  A.newToggle = (kind, label) => (A.seen.ready ? { key: 'new', label: label || 'New since my last visit', test: it => A.seen.changed(it, kind) } : null);

  /* ---------- Your applications ---------- */
  A.STATUS = ['Applied', 'Remote interview', 'Onsite interview', 'Offer', 'Rejected', 'Withdrawn'];
  A.mine = {
    data: null,
    load() { this.data = A.store.get('mine', {}) || {}; return this; },
    save() { A.store.set('mine', this.data); },
    all() { return Object.values(this.data || {}); },
    tracked() { return this.all().filter(e => e.applied || (e.status && e.status !== '')); },
    get(id) { return (this.data || {})[id] || null; },
    forPosting(p) { return this.get('p:' + A.postKey(p)); },
    put(e) { e.updated = Date.now(); if (!e.created) e.created = e.updated; this.data[e.id] = e; this.save(); },
    del(id) { delete this.data[id]; this.save(); },
    fromPosting(p) {
      return { id: 'p:' + A.postKey(p), post: A.postKey(p), institution: p.university || '', department: p.department || '', location: p.location || '', url: p.url || '', field: p.field || '', rank: p.rank || '', applied: '', deadline: '', status: '', note: '' };
    },
    manual(fields) { return Object.assign({ id: 'm:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), post: '', location: '', url: '', field: A.fieldBucket(fields.department || ''), rank: '', applied: '', deadline: '', status: '', note: '' }, fields); },
  };
  A.isoDay = t => new Date(t).toISOString().slice(0, 10);

  /* Everything the sheet reports from the places you applied. */
  const SOURCES = [
    ['apps', 'app', a => a.kind, a => a.respondedMs || a.addedMs, a => [a.department, a.specialty].filter(Boolean).join(' ')],
    ['noresp', 'nores', () => 'No response yet', r => r.dateMs, r => r.department],
    ['offers', 'offer', o => 'Offer ' + (o.status ? '(' + o.status.toLowerCase() + ')' : 'reported'), o => o.dateMs, o => o.department],
    ['frozen', 'froz', o => 'Search ' + (o.status || 'frozen or cancelled').toLowerCase(), o => o.dateMs, o => o.department],
    ['failed', 'fail', o => 'Search failed', o => o.dateMs, o => o.department],
  ];
  A.reportsAt = function (db, institution, department) {
    const out = [];
    if (!db) return out;
    SOURCES.forEach(([tab, kind, label, when, dept]) => (db[tab] || []).forEach(it => {
      if (!A.sameInst(institution, it.institution)) return;
      out.push({ item: it, tab, kind, label: label(it), when: when(it), dept: department === undefined ? 'unknown' : A.deptMatch(department, dept(it)), isNew: A.seen.isNew(it, kind) });
    }));
    return out.sort((a, b) => (b.when || 0) - (a.when || 0));
  };
  A.myAlerts = function (db) {
    const out = [];
    A.mine.tracked().forEach(e => A.reportsAt(db, e.institution, e.department).forEach(r => out.push(Object.assign({ entry: e }, r))));
    return out.sort((a, b) => (b.isNew - a.isNew) || (a.dept === 'other') - (b.dept === 'other') || (b.when || 0) - (a.when || 0));
  };

  /* ---------- Timing: is this silence normal? ---------- */
  A.fieldTiming = function (db, field) {
    const d = (db.apps || []).filter(a => a.daysToResponse !== null && (!field || a.field === field)).map(a => a.daysToResponse);
    if (d.length < 5) return null;
    return { n: d.length, median: A.median(d), p75: A.quantile(d, 0.75), field };
  };
  /* Last season: when did this institution first report each kind of reply? */
  A.seasonFirsts = function (db, institution) {
    if (!db) return [];
    const by = new Map();
    (db.apps || []).forEach(a => {
      if (!A.sameInst(institution, a.institution)) return;
      const t = a.respondedMs || a.addedMs;
      if (!t || (db.win && (t < db.win.lo || t > db.win.hi))) return;
      const cur = by.get(a.kind);
      if (!cur || t < cur.t) by.set(a.kind, { kind: a.kind, t, n: (cur ? cur.n : 0) + 1 }); else cur.n++;
    });
    return A.RESP_ORDER.filter(k => by.has(k)).map(k => by.get(k));
  };
  /* Share of last season's interview reports that had come in by this calendar date. */
  A.seasonPace = function (prev) {
    if (!prev) return null;
    const t = (prev.apps || []).filter(a => a.kind === 'Remote interview' || a.kind === 'Onsite interview').map(a => a.respondedMs || a.addedMs).filter(x => x && (!prev.win || (x >= prev.win.lo && x <= prev.win.hi)));
    if (t.length < 20) return null;
    const d = new Date(A.today()); d.setUTCFullYear(d.getUTCFullYear() - 1);
    return { n: t.length, share: t.filter(x => x <= d.getTime()).length / t.length, asOf: d.getTime() };
  };

  /* ---------- Backup ---------- */
  const SETTINGS = ['sheetId', 'prevSheetId', 'kwGroups', 'exclude', 'keywords', 'refreshHours', 'theme'];
  A.backup = {
    make() {
      const settings = {};
      SETTINGS.forEach(k => { const v = A.store.get(k, undefined); if (v !== undefined && v !== null) settings[k] = v; });
      return { app: 'faculty-market-atlas', version: 1, exported: new Date().toISOString(), settings, saved: A.store.get('saved', []), mine: A.store.get('mine', {}) };
    },
    download() {
      const blob = new Blob([JSON.stringify(this.make(), null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = A.h('a', { href: url, download: 'faculty-market-atlas-backup-' + A.isoDay(Date.now()) + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    parse(text) {
      let j;
      try { j = JSON.parse(text); } catch (e) { throw new Error('This is not a backup file from this app.'); }
      if (!j || j.app !== 'faculty-market-atlas') throw new Error('This is not a backup file from this app.');
      return { data: j, apps: Object.values(j.mine || {}).filter(e => e.applied || e.status).length, notes: Object.values(j.mine || {}).filter(e => e.note).length, saved: (j.saved || []).length, exported: j.exported };
    },
    restore(j) {
      SETTINGS.forEach(k => A.store.del(k));
      Object.entries(j.settings || {}).forEach(([k, v]) => { if (SETTINGS.includes(k)) A.store.set(k, v); });
      A.store.set('saved', Array.isArray(j.saved) ? j.saved : []);
      A.store.set('mine', j.mine && typeof j.mine === 'object' ? j.mine : {});
    },
  };

  /* ---------- App icon badge (installed app in Chrome or Edge) ---------- */
  A.updateBadge = function (n) {
    try {
      if (!('setAppBadge' in navigator)) return;
      if (n > 0) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {});
    } catch (e) { /* not supported */ }
  };
})();
