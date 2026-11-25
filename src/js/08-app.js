/* ============================================================
   App shell: layout, routing, loading, daily refresh, settings.
   Network use: one request to docs.google.com for the workbook.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h;

  // The build decides whether a sheet is built in. The hosted (GitHub) build has none: each person connects their own.
  const CFG = globalThis.ATLAS_CONFIG || {};
  const DEFAULT_ID = CFG.sheetId || '';
  const DEFAULT_KEYWORDS = ['microbiolog', 'bacteri', 'pathogen', 'infect', 'host-microbe'];
  A.status = { source: 'none', at: null, busy: false, error: null, progress: '' };
  A.db = null;
  const el = {};
  // A page opened from disk has the "null" origin, and Google does not allow that origin to read the sheet.
  const FILE_MODE = location.protocol === 'file:' || location.origin === 'null';
  A.fileMode = FILE_MODE;
  // Installing as an app needs a web address (not a file) and the manifest that the hosted build includes.
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const canInstall = () => !FILE_MODE && /^https?:$/.test(location.protocol) && !!document.querySelector('link[rel="manifest"]') && !standalone();
  A.installPrompt = null;
  function installField() {
    if (!canInstall()) return null;
    const isSafari = /^((?!chrome|chromium|android|edg).)*safari/i.test(navigator.userAgent);
    let btn = null;
    if (A.installPrompt) {
      btn = h('button', { class: 'btn', type: 'button' }, A.icon('download', 15), 'Install on this computer');
      btn.addEventListener('click', async () => { try { A.installPrompt.prompt(); await A.installPrompt.userChoice; } catch (e) { /* closed */ } A.installPrompt = null; syncInstallBtn(); buildDrawer(); });
    }
    const how = A.installPrompt ? 'It opens in its own window with its own icon, and shows your last copy when you are offline.'
      : isSafari ? 'In Safari on macOS Sonoma or later, choose File, then Add to Dock.'
      : 'In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose Install.';
    return h('div', { class: 'field' }, h('span', { class: 'lab' }, 'Install as an app'), btn, h('p', { class: 'hint' }, how));
  }
  function syncInstallBtn() { if (el.installBtn) el.installBtn.style.display = A.installPrompt && canInstall() ? '' : 'none'; }

  // Read a workbook the person downloaded (File, Download, Microsoft Excel) and keep it for next time.
  async function loadFile(f) {
    if (!f) return { ok: false, message: 'No file was chosen.' };
    try {
      const wb = await A.parseXlsx(await f.arrayBuffer());
      const db = A.buildDB(wb);
      if (!db.postings.length && !db.apps.length) throw new Error('None of the expected tabs were found in that file. Download the sheet as Microsoft Excel (.xlsx) and try again.');
      A.status.error = null; A.status.dismissed = false;
      const now = Date.now();
      A.setData(db, { source: 'file', at: now });
      A.idb.set(cacheKey(), { savedAt: now, sheets: wb.sheets });
      return { ok: true };
    } catch (e) { return { ok: false, message: 'That file could not be read. ' + describe(e) }; }
  }
  // The two steps that update the data when live reading is not possible.
  function updateSteps(onDone) {
    const input = h('input', { type: 'file', accept: '.xlsx', class: 'sr', id: 'filePick' });
    const msg = h('p', { class: 'hint', role: 'status' });
    input.addEventListener('change', async () => { const r = await loadFile(input.files[0]); if (r.ok) { if (onDone) onDone(); } else msg.textContent = r.message; input.value = ''; });
    return h('div', { class: 'steps' },
      sheetId() ? h('div', null, h('a', { class: 'btn', href: 'https://docs.google.com/spreadsheets/d/' + sheetId() + '/export?format=xlsx', target: '_blank', rel: 'noopener noreferrer' }, A.icon('download', 15), '1. Download the sheet as Excel')) : null,
      h('div', null, h('label', { class: 'btn', for: 'filePick', tabindex: '0' }, A.icon('file', 15), sheetId() ? '2. Choose the downloaded file' : 'Choose a downloaded Excel file'), input),
      h('p', { class: 'hint' }, 'You can also drag the downloaded file onto this page. The app keeps it for next time.'), msg);
  }

  function sheetId() { return A.store.get('sheetId', DEFAULT_ID) || ''; }
  function cacheKey() { return 'wb:' + (sheetId() || 'file'); }
  function parseSheetId(str) {
    str = String(str || '').trim();
    const m = str.match(/\/d\/([A-Za-z0-9_-]{20,})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{25,}$/.test(str) ? str : '';
  }
  function sheetLabel() { return !sheetId() ? 'No sheet connected' : (sheetId() === DEFAULT_ID && CFG.label ? CFG.label : 'Your spreadsheet'); }

  /* ---------------- Theme ---------------- */
  function applyTheme() {
    const t = A.store.get('theme', 'auto');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    if (el.themeBtn) { A.clear(el.themeBtn); el.themeBtn.appendChild(A.icon(isDark() ? 'sun' : 'moon', 17)); }
  }
  function isDark() {
    const t = A.store.get('theme', 'auto');
    return t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /* ---------------- Navigation ---------------- */
  const NAV = [
    { group: '', items: [['overview', 'Overview'], ['statistics', 'Statistics']] },
    { group: 'Browse', items: [['postings', 'Job postings', d => d.postings.length], ['applications', 'Applications', d => d.apps.length], ['noresponse', 'No response', d => d.noresp.length], ['offers', 'Offers and changes', d => d.offers.length + d.frozen.length + d.failed.length], ['negotiations', 'Negotiations', d => d.nego.length]] },
    { group: 'Community', items: [['community', 'Conversations', d => d.comments.length + d.visa.length + d.happy.length], ['culture', 'Institutional culture', d => d.culture.length], ['locations', 'Locations', d => d.locs.length]] },
    { group: '', items: [['resources', 'Resources']] },
  ];
  const TITLES = { overview: 'Overview', statistics: 'Statistics', postings: 'Job postings', applications: 'Applications', noresponse: 'No response', offers: 'Offers and changes', negotiations: 'Negotiations', community: 'Conversations', culture: 'Institutional culture', locations: 'Locations', resources: 'Resources', search: 'Search' };

  function buildRail() {
    const rail = h('aside', { class: 'rail', id: 'rail', 'aria-label': 'Sections' });
    rail.appendChild(h('div', { class: 'brand' }, A.brandMark(), h('div', null, h('b', null, 'Faculty Market Atlas'), h('small', { id: 'sheetLabel' }, sheetLabel()))));
    el.navLinks = {};
    NAV.forEach(g => {
      const grp = h('nav', { class: 'navgroup', 'aria-label': g.group || 'Main' }, g.group ? h('h6', null, g.group) : null);
      g.items.forEach(([id, label, count]) => {
        const ct = h('span', { class: 'ct' }, '');
        const a = h('a', { class: 'nav', href: '#/' + id }, label, ct);
        el.navLinks[id] = { a, ct, count };
        grp.appendChild(a);
      });
      rail.appendChild(grp);
    });
    el.status = h('div', { class: 'row' }); el.statusSub = h('div', { style: { color: 'var(--ink3)' } });
    el.openSheet = h('a', { href: '#', target: '_blank', rel: 'noopener noreferrer' }, 'Open the original sheet');
    rail.appendChild(h('div', { class: 'railfoot' }, el.status, el.statusSub, el.openSheet));
    return rail;
  }
  function updateCounts() {
    if (!A.db) return;
    Object.values(el.navLinks).forEach(n => { n.ct.textContent = n.count ? A.n(n.count(A.db)) : ''; });
  }
  function updateStatus() {
    A.clear(el.status);
    const st = A.status;
    const dot = h('span', { class: 'dot-live' + (st.busy ? ' busy' : (st.error || !sheetId() && !st.at ? ' off' : '')) });
    let text;
    if (st.busy) text = st.progress || 'Refreshing from Google Sheets';
    else if (st.at) text = 'Updated ' + A.stamp(st.at);
    else text = sheetId() ? 'No data loaded' : 'Not connected yet';
    el.status.appendChild(dot); el.status.appendChild(h('span', null, text));
    const src = FILE_MODE && st.source !== 'file' ? 'Opened from a file, so it cannot read the sheet directly.' : { live: 'Read live from the sheet.', cache: 'Saved copy from your last refresh.', builtin: 'Built-in copy. A fresh one is fetched when online.', file: 'Loaded from a file you chose.', none: '' }[st.source] || '';
    const hrs = A.store.get('refreshHours', 24);
    el.statusSub.textContent = !sheetId() && !st.at ? '' : FILE_MODE ? (src ? src + ' ' : '') + 'Update it by loading a downloaded workbook.' : (src ? src + ' ' : '') + 'Checks again every ' + (hrs === 24 ? 'day' : hrs + ' hours') + '.';
    el.openSheet.href = 'https://docs.google.com/spreadsheets/d/' + sheetId() + '/edit';
    el.openSheet.style.display = sheetId() ? '' : 'none';
    document.getElementById('sheetLabel').textContent = sheetLabel();
  }

  /* ---------------- Routing ---------------- */
  function parseRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const params = {};
    if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); });
    return { name: path || 'overview', params };
  }
  function render() {
    const { name, params } = parseRoute();
    const view = A.views[name] ? name : 'overview';
    Object.keys(el.navLinks).forEach(id => { if (id === view) el.navLinks[id].a.setAttribute('aria-current', 'page'); else el.navLinks[id].a.removeAttribute('aria-current'); });
    document.title = (TITLES[view] || 'Atlas') + ' | Faculty Market Atlas';
    if (view === 'search') el.search.value = params.q || ''; else if (document.activeElement !== el.search) el.search.value = '';
    A.clear(el.page);
    if (!A.db) { el.page.appendChild(sheetId() ? loadingView() : setupView()); return; }
    if (A.status.error) el.page.appendChild(errorBanner());
    else if (staleBanner()) el.page.appendChild(staleBanner());
    try { el.page.appendChild(A.views[view](params)); }
    catch (e) { console.error(e); el.page.appendChild(A.emptyState('This screen could not be drawn', 'Something in the sheet did not look as expected. ' + (e && e.message ? e.message : ''))); }
    if (A.db.warnings.length) el.page.appendChild(h('p', { class: 'note-line', style: { marginTop: '28px' } }, 'Reading notes: ' + A.db.warnings.join(' ')));
    closeRail();
    window.scrollTo(0, 0);
  }
  function staleBanner() {
    if (!FILE_MODE || !A.status.at || A.status.dismissed) return null;
    const hrs = A.store.get('refreshHours', 24);
    if (Date.now() - A.status.at < hrs * 3600e3) return null;
    const x = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Dismiss', onClick: () => { A.status.dismissed = true; render(); } }, A.icon('x', 16));
    return h('div', { class: 'banner info' }, h('div', { style: { flex: '1' } },
      h('b', null, 'This copy is from ' + A.stamp(A.status.at) + '. '),
      'A page opened from your computer is not allowed to read Google Sheets directly, so it updates when you load a fresh workbook. ',
      h('div', { class: 'acts' }, updateSteps())), x);
  }
  // First run of the hosted build: no sheet is built in, so ask for the link. It is kept in this browser only.
  function connect(raw, msg) {
    const id = parseSheetId(raw);
    if (!id) { msg.textContent = 'That does not look like a Google Sheets link. Open the sheet, then copy the whole address from the address bar.'; return; }
    A.store.set('sheetId', id); A.status.error = null; updateStatus(); render(); loadInitial();
  }
  function setupView() {
    const input = h('input', { class: 'input', type: 'text', placeholder: 'https://docs.google.com/spreadsheets/d/…', spellcheck: 'false', 'aria-label': 'Link to your Google Sheet', style: { flex: '1 1 320px' } });
    const msg = h('p', { class: 'hint', role: 'status' }, 'The sheet must be shared as “Anyone with the link can view”.');
    const go = h('button', { class: 'btn primary', type: 'button' }, 'Connect');
    go.addEventListener('click', () => connect(input.value, msg));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') connect(input.value, msg); });
    return h('div', { class: 'setup' },
      A.pageHead('Connect your spreadsheet', 'Paste the link to your Google Sheet (the Future PI Slack job-market layout). This browser reads it directly from Google. The link and the data stay on this computer.'),
      h('section', { class: 'card', style: { maxWidth: '720px' } },
        h('div', { class: 'toolbar', style: { marginBottom: '6px' } }, input, go), msg),
      h('p', { class: 'note-line', style: { marginTop: '22px' } }, 'No link, or no internet? Open a downloaded Excel copy of the sheet instead.'),
      h('div', { style: { marginTop: '10px' } }, updateSteps()));
  }
  function loadingView() {
    return h('div', null, A.pageHead('Opening the market', A.status.busy ? (A.status.progress || 'Fetching the spreadsheet.') : 'Preparing your data.'),
      A.status.error ? errorBanner(true) : h('p', { class: 'note-line' }, 'This takes a few seconds the first time. Later visits open instantly from a saved copy.'));
  }
  function errorBanner(noCopy) {
    const isFile = /^That file/.test(A.status.error || '');
    const acts = h('div', { class: 'acts' },
      isFile ? null : h('button', { class: 'btn sm', type: 'button', onClick: () => A.refresh({ manual: true }) }, 'Try again'),
      h('button', { class: 'btn sm', type: 'button', onClick: () => openDrawer() }, isFile ? 'Choose another file' : 'Open settings or load a file'));
    return h('div', { class: 'banner' }, h('div', null,
      isFile ? null : h('b', null, 'Could not refresh the data. '), A.status.error,
      noCopy || !A.status.at ? '' : ' Showing the copy saved ' + A.stamp(A.status.at) + '.', acts));
  }
  function openRail() { el.rail.classList.add('open'); el.scrim.classList.add('on'); }
  function closeRail() { el.rail.classList.remove('open'); if (!el.drawer.classList.contains('open')) el.scrim.classList.remove('on'); }

  /* ---------------- Data ---------------- */
  A.setData = function (db, meta) {
    A.db = db;
    Object.assign(A.status, meta);
    updateCounts(); updateStatus();
    const y = window.scrollY;
    render();
    if (meta.keepScroll) window.scrollTo(0, y);
  };
  function describe(e) {
    const m = String(e && e.message || e);
    if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(m)) return 'Google Sheets could not be reached. Check your connection, or whether your network blocks docs.google.com.';
    return m;
  }
  A.refresh = async function (opts) {
    opts = opts || {};
    if (A.status.busy) return;
    if (FILE_MODE) { if (opts.manual) openDrawer(); return; }
    const id = sheetId();
    if (!id) { if (opts.manual) openDrawer(); return; }
    A.status.busy = true; A.status.progress = 'Fetching the spreadsheet'; updateStatus();
    if (opts.manual && A.db) el.main.classList.add('busy');
    try {
      const res = await fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx', { cache: 'no-store' });
      if (!res.ok) throw new Error('Google Sheets answered with status ' + res.status + (res.status === 404 || res.status === 403 ? '. The sheet may no longer be shared with anyone who has the link.' : '.'));
      if (/text\/html/i.test(res.headers.get('content-type') || '')) throw new Error('Google returned a web page instead of the workbook. The sheet may require signing in.');
      const buf = await res.arrayBuffer();
      A.status.progress = 'Reading the workbook'; updateStatus();
      const wb = await A.parseXlsx(buf, (d, t) => { A.status.progress = 'Reading tab ' + d + ' of ' + t; updateStatus(); });
      const db = A.buildDB(wb);
      if (!db.postings.length && !db.apps.length) throw new Error('The workbook opened, but none of the expected tabs were found.');
      A.status.error = null; A.status.busy = false;
      A.setData(db, { source: 'live', at: Date.now(), keepScroll: true });
      A.idb.set(cacheKey(), { savedAt: Date.now(), sheets: wb.sheets });
    } catch (e) {
      console.warn('Refresh failed:', e);
      A.status.error = describe(e);
      if (A.db) { A.status.busy = false; render(); }
    } finally {
      A.status.busy = false; el.main.classList.remove('busy'); updateStatus();
      if (!A.db) render();
    }
  };
  function due() {
    if (FILE_MODE || !sheetId()) return false;
    if (A.status.source === 'builtin') return true; // the embedded copy is only a starting point
    const hrs = A.store.get('refreshHours', 24);
    return !A.status.at || (Date.now() - A.status.at) > hrs * 3600e3 - 60e3;
  }

  /* ---------------- Settings drawer ---------------- */
  function openDrawer() { buildDrawer(); el.drawer.classList.add('open'); el.scrim.classList.add('on'); }
  function closeDrawer() { el.drawer.classList.remove('open'); if (!el.rail.classList.contains('open')) el.scrim.classList.remove('on'); }
  function buildDrawer() {
    A.clear(el.drawer);
    const idInput = h('input', { class: 'input', type: 'text', value: sheetId() ? 'https://docs.google.com/spreadsheets/d/' + sheetId() + '/edit' : '', placeholder: 'Paste the link of your Google Sheet', spellcheck: 'false', 'aria-label': 'Spreadsheet link' });
    const idMsg = h('p', { class: 'hint', role: 'status' }, 'The sheet must be shared so anyone with the link can view it.');
    const kwInput = h('textarea', { class: 'input', rows: '3', spellcheck: 'false', 'aria-label': 'Keywords' }, A.UI.keywords.join(', '));
    const hoursSel = h('select', { class: 'input', 'aria-label': 'Refresh interval' }, [[6, 'Every 6 hours'], [12, 'Every 12 hours'], [24, 'Once a day'], [48, 'Every 2 days']].map(([v, l]) => h('option', { value: String(v) }, l)));
    hoursSel.value = String(A.store.get('refreshHours', 24));
    const theme = A.store.get('theme', 'auto');
    const themeBtns = h('div', { class: 'seg-tabs', role: 'group', 'aria-label': 'Theme' }, [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(theme === v) }, l);
      b.addEventListener('click', () => { A.store.set('theme', v); applyTheme(); [...themeBtns.children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); });
      return b;
    }));
    const save = h('button', { class: 'btn primary', type: 'button' }, 'Save settings');
    save.addEventListener('click', () => {
      const raw = idInput.value.trim();
      const id = raw ? parseSheetId(raw) : sheetId();
      if (raw && !id) { idMsg.textContent = 'That does not look like a Google Sheets link. Paste the full address from your browser.'; idInput.focus(); return; }
      const changed = id !== sheetId();
      if (id && id === DEFAULT_ID) A.store.del('sheetId'); else if (id) A.store.set('sheetId', id);
      A.UI.keywords = kwInput.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      A.store.set('keywords', A.UI.keywords);
      A.store.set('refreshHours', +hoursSel.value);
      closeDrawer();
      if (changed) { A.status.at = null; A.db = null; A.status.source = 'none'; loadInitial(); } else { updateStatus(); render(); }
    });
    const clear = h('button', { class: 'btn', type: 'button' }, 'Clear saved data');
    clear.addEventListener('click', async () => {
      await A.idb.del(cacheKey());
      ['saved', 'lastVisit', 'keywords', 'sheetId', 'refreshHours', 'theme'].forEach(k => A.store.del(k));
      location.reload();
    });
    el.drawer.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('h2', null, 'Settings'), h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Close settings', onClick: closeDrawer }, A.icon('x', 18))));
    el.drawer.appendChild(h('div', { class: 'field' }, h('label', null, 'Spreadsheet'), idInput, idMsg, h('p', { class: 'hint' }, 'Next season, paste the new sheet’s link here and the app will follow it.')));
    el.drawer.appendChild(h('div', { class: 'field' }, h('label', null, 'Refresh'), hoursSel, h('p', { class: 'hint' }, 'The app checks while it is open and again whenever you come back to the tab. The Refresh button always fetches right away.')));
    el.drawer.appendChild(h('div', { class: 'field' }, h('label', null, 'My keywords'), kwInput, h('p', { class: 'hint' }, 'Separate with commas. Postings whose text contains any of these get a highlight and appear under the keyword filter. Parts of words work: “microbiolog” finds microbiology and microbiologist.')));
    el.drawer.appendChild(h('div', { class: 'field' }, h('span', { class: 'lab' }, 'Appearance'), themeBtns));
    const inst = installField(); if (inst) el.drawer.appendChild(inst);
    el.drawer.appendChild(h('div', { class: 'field' }, h('span', { class: 'lab' }, FILE_MODE ? 'Update the data' : 'Or load a downloaded workbook'), updateSteps(closeDrawer)));
    el.drawer.appendChild(h('div', { class: 'field', style: { display: 'flex', gap: '8px', flexDirection: 'row', marginTop: '26px' } }, save, clear));
    el.drawer.appendChild(h('p', { class: 'hint', style: { marginTop: '26px' } }, 'Privacy: this page talks only to docs.google.com, to read the sheet. Saved postings, keywords and the cached workbook stay in this browser.'));
  }

  /* ---------------- Boot ---------------- */
  async function loadInitial() {
    const id = sheetId();
    const cached = await A.idb.get(cacheKey());
    if (cached && cached.sheets) {
      try { A.setData(A.buildDB(cached), { source: 'cache', at: cached.savedAt }); } catch (e) { console.warn('Cached copy unreadable', e); }
    }
    if (!A.db && id && id === DEFAULT_ID) {
      const node = document.getElementById('snapshot');
      const b64 = node ? node.textContent.trim() : '';
      if (b64 && b64.length > 100) {
        try { const snap = await A.unpackSnapshot(b64); A.setData(A.buildDB(snap), { source: 'builtin', at: snap.savedAt }); } catch (e) { console.warn('Built-in copy unreadable', e); }
      }
    }
    if (!A.db) render();
    if (due()) A.refresh({ manual: false });
  }

  A.boot = function () {
    A.UI.keywords = A.store.get('keywords', DEFAULT_KEYWORDS);
    A.UI.saved = new Set(A.store.get('saved', []));
    A.UI.prevVisit = A.store.get('lastVisit', null);
    const root = document.getElementById('app');
    el.rail = buildRail();
    el.scrim = h('div', { class: 'scrim', onClick: () => { closeRail(); closeDrawer(); } });
    el.drawer = h('aside', { class: 'drawer', 'aria-label': 'Settings' });
    el.search = h('input', { class: 'input', type: 'text', placeholder: 'Search all tabs  ( / )', 'aria-label': 'Search all tabs', autocomplete: 'off', spellcheck: 'false' });
    const searchBox = h('div', { class: 'search' }, A.icon('search', 16), el.search);
    el.refreshBtn = h('button', { class: 'btn', type: 'button', title: 'Fetch the latest data from the sheet now' }, A.icon('refresh', 15), 'Refresh');
    el.themeBtn = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Switch between light and dark', title: 'Switch between light and dark' });
    const gear = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Settings', title: 'Settings' }, A.icon('sliders', 17));
    el.installBtn = h('button', { class: 'btn hide-sm', type: 'button', style: { display: 'none' }, title: 'Install this as an app on your computer' }, A.icon('download', 15), 'Install app');
    const menu = h('button', { class: 'btn quiet icon menu-btn', type: 'button', 'aria-label': 'Open the menu' }, A.icon('menu', 19));
    el.page = h('main', { class: 'page', id: 'page', tabindex: '-1' });
    el.main = h('div', { class: 'main' }, h('header', { class: 'topbar' }, menu, searchBox, h('span', { class: 'spacer' }), el.installBtn, el.refreshBtn, el.themeBtn, gear), el.page);
    root.appendChild(h('div', { class: 'app' }, el.rail, el.main));
    root.appendChild(el.scrim); root.appendChild(el.drawer);

    applyTheme();
    menu.addEventListener('click', openRail);
    gear.addEventListener('click', openDrawer);
    document.addEventListener('fma:settings', openDrawer);
    el.refreshBtn.addEventListener('click', () => A.refresh({ manual: true }));
    el.installBtn.addEventListener('click', async () => { if (!A.installPrompt) return; try { A.installPrompt.prompt(); await A.installPrompt.userChoice; } catch (e) { /* closed */ } A.installPrompt = null; syncInstallBtn(); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); A.installPrompt = e; syncInstallBtn(); });
    window.addEventListener('appinstalled', () => { A.installPrompt = null; syncInstallBtn(); });
    el.themeBtn.addEventListener('click', () => { A.store.set('theme', isDark() ? 'light' : 'dark'); applyTheme(); render(); });
    el.search.addEventListener('input', A.debounce(() => { const q = el.search.value.trim(); if (q) A.go('search', { q }); else if (parseRoute().name === 'search') A.go('overview'); }, 260));
    el.search.addEventListener('keydown', e => { if (e.key === 'Escape') { el.search.value = ''; el.search.blur(); } });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); el.search.focus(); el.search.select(); }
      if (e.key === 'Escape') { closeDrawer(); closeRail(); }
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', async e => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      const r = await loadFile(f);
      if (!r.ok) { A.status.error = r.message; render(); }
    });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (A.store.get('theme', 'auto') === 'auto') { applyTheme(); render(); } });

    // remember when you were last here, for "new since your last visit"
    const stamp = () => A.store.set('lastVisit', Date.now());
    window.addEventListener('pagehide', stamp);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stamp(); else if (due() && !A.status.busy) A.refresh({ manual: false }); });
    setInterval(() => { if (document.visibilityState === 'visible' && due() && !A.status.busy) A.refresh({ manual: false }); }, 10 * 60e3);

    updateStatus();
    loadInitial();
  };
})();
