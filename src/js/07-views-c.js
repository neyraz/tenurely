/* ============================================================
   Screens, part 3: Today, My applications, institution profiles,
   and the Track button that sits on every job posting.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h;
  A.views = A.views || {};

  const DAY = A.DAY;
  const tracked = e => !!(e && (e.applied || e.status));
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dayMs = s => (s ? A.parseDate(s) : null);
  const plural = A.plural;
  const rerender = () => { if (A.rerender) A.rerender(true); };

  function statTile(label, value, note, onClick) {
    const el = h('div', { class: 'stat' + (onClick ? ' click' : ''), tabindex: onClick ? '0' : null, role: onClick ? 'link' : null },
      h('div', { class: 'lbl' }, label), h('div', { class: 'val' }, value), note ? h('div', { class: 'note' }, note) : null);
    if (onClick) { el.addEventListener('click', onClick); el.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(); }); }
    return el;
  }
  const panel = (title, link, body) => h('section', { class: 'panel' }, h('header', null, h('h3', null, title), link || null), body);
  const go = (view, params, label) => h('button', { class: 'linkbtn', type: 'button', onClick: () => A.go(view, params) }, label);
  const empty = text => h('p', { class: 'note-line', style: { padding: '8px 0 12px' } }, text);

  /* ---------- Institution names open a profile ---------- */
  A.instHref = name => '#/institution?name=' + encodeURIComponent(name);
  A.instLink = (name, re) => h('a', { class: 'inst-link', href: A.instHref(name), title: 'Everything the sheet says about ' + name }, A.rich(name, re));

  /* ---------- Tracking a posting: applied date, deadline, status, private note ---------- */
  A.trackEditor = function (entry, opts) {
    opts = opts || {};
    const e = Object.assign({}, entry);
    const isManual = !!opts.manual;
    const inp = (type, value, extra) => h('input', Object.assign({ class: 'input', type, value: value || '' }, extra || {}));
    const fInst = isManual ? inp('text', e.institution, { placeholder: 'For example: University of Iowa', required: true }) : null;
    const fDept = isManual ? inp('text', e.department, { placeholder: 'Department or program' }) : null;
    const fUrl = isManual ? inp('url', e.url, { placeholder: 'https://… (optional)' }) : null;
    const fApplied = inp('date', e.applied || (opts.fresh ? localDay() : ''));
    const fDeadline = inp('date', e.deadline);
    const fStatus = h('select', { class: 'input' }, h('option', { value: '' }, 'Not applied yet'), A.STATUS.map(s => h('option', { value: s }, s)));
    fStatus.value = e.status || (opts.fresh ? 'Applied' : '');
    const fNote = h('textarea', { class: 'input', rows: '3', placeholder: 'Private note: contacts, what to emphasise, reminders. Only you see this.' }, e.note || '');
    const msg = h('p', { class: 'hint', role: 'status' });
    const lab = (text, field) => h('label', null, text, field);

    const save = h('button', { class: 'btn primary sm', type: 'button' }, 'Save');
    const cancel = h('button', { class: 'btn sm', type: 'button' }, 'Cancel');
    const exists = !!A.mine.get(e.id);
    const remove = exists ? h('button', { class: 'btn quiet sm', type: 'button' }, 'Remove from my list') : null;

    save.addEventListener('click', () => {
      if (isManual) {
        e.institution = fInst.value.trim(); e.department = fDept.value.trim(); e.url = A.safeUrl(fUrl.value.trim()) || '';
        if (!e.institution) { msg.textContent = 'Add the institution name.'; fInst.focus(); return; }
        e.field = A.fieldBucket(e.department);
      }
      e.applied = fApplied.value; e.deadline = fDeadline.value; e.status = fStatus.value; e.note = fNote.value.trim();
      if (e.applied && !e.status) e.status = 'Applied';
      if (!tracked(e) && !e.note && !e.deadline) { if (exists) A.mine.del(e.id); }
      else A.mine.put(e);
      if (A.refreshCounts) A.refreshCounts();
      if (opts.onDone) opts.onDone(true);
    });
    cancel.addEventListener('click', () => { if (opts.onDone) opts.onDone(false); });
    if (remove) remove.addEventListener('click', () => { A.mine.del(e.id); if (A.refreshCounts) A.refreshCounts(); if (opts.onDone) opts.onDone(true); });

    return h('div', { class: 'editor' },
      isManual ? h('div', { class: 'ed-grid' }, lab('Institution', fInst), lab('Department', fDept), lab('Link to the ad', fUrl)) : null,
      h('div', { class: 'ed-grid' }, lab('Applied on', fApplied), lab('Deadline', fDeadline), lab('Status', fStatus)),
      lab('Note', fNote), msg,
      h('div', { class: 'acts' }, save, cancel, remove));
  };

  /* One line about your own entry: applied, deadline, status, and your note. */
  A.mySummary = function (e) {
    if (!e) return null;
    const bits = [];
    const ap = dayMs(e.applied), dl = dayMs(e.deadline);
    if (e.status && e.status !== 'Applied') bits.push(h('b', null, e.status));
    if (ap) bits.push('You applied ' + A.fmtDate(ap) + ' (' + plural(A.daysSince(ap), 'day') + ' ago)');
    if (dl) { const d = Math.round((dl - A.today()) / DAY); bits.push('deadline ' + A.fmtDate(dl) + (d > 0 ? ' (in ' + plural(d, 'day') + ')' : d === 0 ? ' (today)' : ' (passed)')); }
    const line = bits.length ? h('div', { class: 'mine-line' }, bits.reduce((acc, b, i) => acc.concat(i ? [', ', b] : [b]), [])) : null;
    return h('div', null, line, e.note ? h('div', { class: 'mine-note' }, A.rich(e.note)) : null);
  };

  A.trackControls = function (p) {
    const btn = h('button', { class: 'btn sm', type: 'button' });
    const area = h('div', { class: 'track-area' });
    let open = false;
    function paint() {
      const e = A.mine.forPosting(p);
      A.clear(btn);
      const on = tracked(e);
      btn.classList.toggle('on', on);
      btn.appendChild(A.icon(on ? 'check' : 'plus', 13));
      btn.appendChild(document.createTextNode(on ? (e.status && e.status !== 'Applied' ? e.status : 'Applied') : (e && e.note ? 'My note' : 'Track')));
      btn.title = on ? 'Edit your application details' : 'Mark as applied, add a deadline or a private note';
      btn.setAttribute('aria-expanded', String(open));
      A.clear(area);
      if (open) area.appendChild(A.trackEditor(e || A.mine.fromPosting(p), { fresh: !e, onDone: () => { open = false; paint(); } }));
      else if (e) area.appendChild(A.mySummary(e));
    }
    btn.addEventListener('click', () => { open = !open; paint(); });
    paint();
    return { btn, area };
  };

  /* ---------- Shared pieces for alerts ---------- */
  const COLOR = r => (r.tab === 'apps' ? A.RESP_COLOR[r.item.kind] || 'var(--axis)' : r.tab === 'offers' ? 'var(--s3)' : 'var(--axis)');
  const deptNote = { same: 'Matches your department', other: 'A different department', unknown: '' };
  function reportRow(r, showMine) {
    const it = r.item;
    const dept = [it.department, it.specialty].filter(Boolean).join(', ');
    const notes = it.noteList || it.notes || [];
    const extra = r.tab === 'apps' && it.daysToResponse !== null ? 'Heard back ' + plural(it.daysToResponse, 'day') + ' after applying' : '';
    return h('div', { class: 'mini alert' },
      h('div', { class: 't' }, A.badge(r.label, COLOR(r)), ' ', A.instLink(it.institution), r.isNew ? h('span', { class: 'pill-new' }, 'New') : null),
      h('time', null, r.when ? A.fmtDate(r.when, false) : ''),
      h('div', { class: 's' }, [dept, extra].filter(Boolean).join('. '),
        showMine && deptNote[r.dept] ? h('span', { class: 'dept-' + r.dept }, (dept || extra ? '. ' : '') + deptNote[r.dept] + (r.entry && r.entry.department ? ' (' + r.entry.department + ')' : '') + '.') : null),
      notes.length ? h('div', { class: 'q' }, notes.join(' | ').slice(0, 220) + (notes.join(' | ').length > 220 ? '…' : '')) : null);
  }
  function showMore(list, n, build) {
    const box = h('div', null, list.slice(0, n).map(build));
    if (list.length > n) {
      const b = h('button', { class: 'linkbtn', type: 'button', style: { margin: '8px 0 10px' } }, 'Show ' + (list.length - n) + ' more');
      b.addEventListener('click', () => { list.slice(n).forEach(x => box.insertBefore(build(x), b)); b.remove(); });
      box.appendChild(b);
    }
    return box;
  }

  /* Counts that drive the Today page, the menu and the app icon badge. */
  A.todayCounts = function (db) {
    if (!db || !A.seen.ready) return { total: 0, badge: 0 };
    const k = A.kpis(db, A.UI.prevVisit, A.UI.keywords);
    const alerts = A.myAlerts(db).filter(a => a.isNew).length;
    const posts = db.postings.filter(p => k.isNew(p) && k.match(p)).length;
    return { alerts, posts, badge: alerts + posts, total: alerts + posts };
  };

  /* ---------------- Today ---------------- */
  A.views.today = function () {
    const D = A.db, U = A.UI, S = A.seen;
    const k = A.kpis(D, U.prevVisit, U.keywords);
    const today = A.today();
    const recent = t => t !== null && t !== undefined && t >= today - 7 * DAY && t <= today + 2 * DAY;
    // Before the first comparison is possible, "new" falls back to the past seven days.
    const fresh = (it, kind, t) => (S.ready ? S.changed(it, kind) : recent(t));
    const when = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    const root = h('div', null, A.pageHead('Today, ' + when,
      S.ready ? 'What changed in the sheet since you last left' + (U.prevVisit ? ' (' + A.stamp(U.prevVisit) + ')' : '') + '.'
        : 'Your first look. From your next visit, this page lists only what changed in between. For now it shows the past seven days.'));
    if (S.ready) {
      const mark = h('button', { class: 'btn sm', type: 'button' }, A.icon('check', 14), 'Mark everything as seen');
      mark.addEventListener('click', () => { S.markAll(D); A.UI.prevVisit = Date.now(); if (A.refreshCounts) A.refreshCounts(); rerender(); });
      root.appendChild(h('div', { style: { margin: '-6px 0 20px' } }, mark));
    }

    // 1. Places you applied
    const mine = A.mine.tracked();
    const alerts = A.myAlerts(D);
    const myNew = S.ready ? alerts.filter(a => a.isNew) : alerts.filter(a => recent(a.when));
    let p1body;
    if (!mine.length) p1body = h('div', null, empty('Mark the postings you apply to (the Track button on each posting). Replies that others report from those places will show up here.'), go('postings', U.keywords.length ? { kw: '1' } : null, 'Find postings to track'));
    else if (!myNew.length) p1body = empty('Nothing new from your ' + plural(mine.length, 'application') + '. ' + (alerts.length ? alerts.length + ' earlier ' + (alerts.length === 1 ? 'report is' : 'reports are') + ' on My applications.' : ''));
    else p1body = showMore(myNew, 6, r => reportRow(r, true));
    const g = h('div', { class: 'grid g2' });
    g.appendChild(panel('At places you applied', mine.length ? h('a', { href: '#/mine' }, 'My applications') : null, p1body));

    // 2. Deadlines and waits
    const soon = mine.concat(A.mine.all().filter(e => !tracked(e) && e.deadline)).map(e => ({ e, t: dayMs(e.deadline) })).filter(x => x.t && x.t >= today && x.t <= today + 21 * DAY).sort((a, b) => a.t - b.t);
    const dl = soon.length ? soon.map(({ e, t }) => h('div', { class: 'mini' },
      h('div', { class: 't' }, A.instLink(e.institution)), h('time', null, A.fmtDate(t, false)),
      h('div', { class: 's' }, [e.department, t === today ? 'Due today' : 'In ' + plural(Math.round((t - today) / DAY), 'day'), tracked(e) ? 'applied' : 'not applied yet'].filter(Boolean).join(', '))))
      : empty('No deadlines in the next three weeks. Add one with the Track button on a posting.');
    g.appendChild(panel('Deadlines in the next three weeks', null, dl));

    // 3. Postings
    const newPosts = D.postings.filter(p => fresh(p, 'post', p.dateMs)).sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0) || b.row - a.row);
    const forYou = newPosts.filter(k.match);
    const others = newPosts.length - forYou.length;
    const postMini = p => h('div', { class: 'mini' },
      h('div', { class: 't' }, A.instLink(p.university || 'Untitled posting'), ' ', A.kwGroupsOf(p).map(n => A.chip(n, 'accent'))),
      h('time', null, A.fmtDate(p.dateMs, false)),
      h('div', { class: 's' }, [p.department, p.location, p.rank].filter(Boolean).join(', ')),
      p.url ? h('div', { class: 'q' }, A.link(p.url, 'Open posting', 'ext')) : null);
    g.appendChild(panel(U.keywords.length ? 'New postings matching your keywords' : 'New postings',
      newPosts.length ? go('postings', S.ready ? { new: '1' } : { week: '1' }, 'All ' + newPosts.length + ' new') : null,
      U.keywords.length ? (forYou.length ? showMore(forYou, 6, postMini) : empty('None matched your keywords' + (others ? '. ' + plural(others, 'other posting') + ' arrived.' : '.')))
        : (newPosts.length ? showMore(newPosts, 6, postMini) : empty('No new postings.'))));

    // 4. Replies reported by everyone
    const newApps = D.apps.filter(a => fresh(a, 'app', a.addedMs)).sort((a, b) => (b.addedMs || 0) - (a.addedMs || 0) || b.row - a.row);
    const kinds = A.RESP_ORDER.map(kd => [kd, newApps.filter(a => a.kind === kd).length]).filter(x => x[1]);
    g.appendChild(panel('Replies reported by others', newApps.length ? go('applications', S.ready ? { new: '1' } : {}, 'See all') : null,
      newApps.length ? h('div', null,
        h('div', { class: 'chips', style: { margin: '2px 0 8px' } }, kinds.map(([kd, n]) => h('span', { class: 'badge' }, h('i', { style: { background: A.RESP_COLOR[kd] } }), n + ' ' + kd.toLowerCase()))),
        showMore(newApps, 5, a => reportRow({ item: a, tab: 'apps', label: a.kind, when: a.respondedMs || a.addedMs, isNew: false }, false)))
        : empty('No new replies reported.')));
    root.appendChild(g);

    // 5. Conversations
    const tNew = D.comments.filter(t => (S.ready ? S.isNew(t, 'com') : recent(t.dateMs)));
    const tMore = S.ready ? D.comments.filter(t => S.newReplies(t, 'com') > 0) : [];
    const threads = tNew.concat(tMore).sort((a, b) => b.row - a.row);
    const tMini = t => {
      const first = t.messages[0];
      const nr = S.newReplies(t, 'com');
      return h('div', { class: 'mini' },
        h('div', { class: 't', style: { fontWeight: 500 } }, first.length > 180 ? first.slice(0, 179) + '…' : first),
        h('time', null, t.dateMs ? A.fmtDate(t.dateMs, false) : ''),
        h('div', { class: 's' }, S.isNew(t, 'com') ? h('span', { class: 'pill-new' }, 'New thread') : (nr ? h('span', { class: 'pill-new' }, plural(nr, 'new reply', 'new replies')) : null), ' ', plural(t.messages.length - 1, 'reply', 'replies')));
    };
    root.appendChild(h('div', { class: 'grid g2', style: { marginTop: '16px' } },
      panel('Conversations', threads.length ? go('community', S.ready ? { new: '1' } : { week: '1' }, 'Read them') : null,
        threads.length ? showMore(threads, 5, tMini) : empty('Nothing new on the comment board.')),
      (() => {
        const rows = [
          ['No-response reports', 'noresponse', D.noresp.filter(r => fresh(r, 'nores', r.dateMs)).length],
          ['Institutional culture', 'culture', D.culture.filter(c => fresh(c, 'cult', c.dateMs)).length],
          ['Locations', 'locations', S.ready ? D.locs.filter(l => S.changed(l, 'loc')).length : 0],
          ['Negotiations', 'negotiations', D.nego.filter(n => fresh(n, 'nego', n.dateMs)).length],
          ['Offers and search changes', 'offers', D.offers.filter(o => fresh(o, 'offer', o.dateMs)).length + D.frozen.filter(o => fresh(o, 'froz', o.dateMs)).length + D.failed.filter(o => fresh(o, 'fail', o.dateMs)).length],
          ['Visa and happy-tab threads', 'community', (S.ready ? D.visa.filter(t => S.changed(t, 'visa')).length + D.happy.filter(t => S.changed(t, 'joy')).length : 0)],
        ];
        return panel('Elsewhere in the sheet', null, rows.map(([label, view, n]) => h('div', { class: 'mini' },
          h('div', { class: 't', style: { fontWeight: 500 } }, n ? h('a', { href: '#/' + view + (S.ready && view !== 'offers' ? '?new=1' : '') }, label) : label),
          h('time', null, n ? h('b', { class: 'newcount' }, n + ' new') : 'nothing new'))));
      })()));
    return root;
  };

  /* ---------------- My applications ---------------- */
  A.views.mine = function () {
    const D = A.db, P = A.prev;
    const root = h('div', null, A.pageHead('My applications', 'The places you applied, with every reply that others have reported from them, and how your wait compares. Kept in this browser only. Back it up from Settings.'));
    const all = A.mine.tracked();
    const addArea = h('div');
    const addBtn = h('button', { class: 'btn', type: 'button' }, A.icon('plus', 14), 'Add one that is not on the sheet');
    addBtn.addEventListener('click', () => {
      A.clear(addArea);
      addArea.appendChild(A.trackEditor(A.mine.manual({ institution: '', department: '' }), { manual: true, fresh: true, onDone: saved => { A.clear(addArea); if (saved) rerender(); } }));
    });
    const csv = h('button', { class: 'btn quiet', type: 'button' }, A.icon('download', 14), 'Export CSV');
    csv.addEventListener('click', () => A.downloadCsv('my-applications.csv', ['Institution', 'Department', 'Applied', 'Deadline', 'Status', 'Reports from this institution', 'Note', 'Link'],
      all.map(e => [e.institution, e.department, e.applied, e.deadline, e.status, A.reportsAt(D, e.institution).length, e.note, e.url])));
    root.appendChild(h('div', { class: 'toolbar' }, addBtn, all.length ? csv : null));
    root.appendChild(addArea);

    if (!all.length) {
      root.appendChild(A.emptyState('No applications tracked yet', 'On Job postings, press Track on a posting you applied to. Replies others report from that place then appear here and on Today.'));
      root.appendChild(h('div', { style: { textAlign: 'center' } }, h('button', { class: 'btn primary', type: 'button', onClick: () => A.go('postings', A.UI.keywords.length ? { kw: '1' } : null) }, 'Go to job postings')));
      return root;
    }

    const alerts = A.myAlerts(D);
    const interviews = alerts.filter(a => a.tab === 'apps' && /interview/i.test(a.item.kind));
    const today = A.today();
    const deadlines = all.filter(e => { const t = dayMs(e.deadline); return t && t >= today && t <= today + 14 * DAY; });
    const info = e => {
      const ap = dayMs(e.applied);
      const rep = alerts.filter(a => a.entry === e && a.tab === 'apps');
      const tm = A.fieldTiming(D, e.field) || A.fieldTiming(D, null);
      const wait = ap ? A.daysSince(ap) : null;
      return { ap, rep, tm, wait, long: !rep.length && wait !== null && tm && wait > tm.p75 };
    };
    const infos = new Map(all.map(e => [e, info(e)]));
    const longWaits = all.filter(e => infos.get(e).long);
    root.appendChild(h('div', { class: 'stats', style: { marginTop: '14px' } },
      statTile('Applications tracked', A.n(all.length), plural(all.filter(e => A.reportsAt(D, e.institution).length).length, 'place') + ' with reports in the sheet'),
      statTile('Interviews reported at your places', A.n(interviews.length), 'by anyone, any department'),
      statTile('Deadlines in the next 14 days', A.n(deadlines.length), deadlines.length ? 'Next: ' + deadlines.map(e => e.institution).slice(0, 2).join(', ') : 'none coming up'),
      statTile('Waiting longer than most', A.n(longWaits.length), 'No reply here, and longer than 3 in 4 reported waits in that field')));
    const pace = A.seasonPace(P);
    if (pace) root.appendChild(h('p', { class: 'note-line', style: { marginTop: '12px' } }, 'Season pace: by ' + A.fmtDate(pace.asOf) + ' last season, ' + A.pct(pace.share) + ' of that season’s ' + pace.n + ' reported interview invitations had come in.'));

    const sec1 = h('section', { class: 'section' }, h('h2', null, 'Reported at places you applied'),
      h('p', { class: 'lede' }, 'Replies, silences and search changes that others posted for the same institutions. Departments are compared by their wording, so check the details before reading too much into one.'));
    sec1.appendChild(alerts.length ? h('div', { class: 'panel' }, showMore(alerts, 12, r => reportRow(r, true))) : empty('Nothing reported from your places yet this season.'));
    root.appendChild(sec1);

    const sec2 = h('section', { class: 'section' }, h('h2', null, 'Your list'));
    const sortSel = h('select', { class: 'input', 'aria-label': 'Sort' }, [['applied', 'Applied, newest first'], ['deadline', 'Deadline, soonest first'], ['wait', 'Longest wait first'], ['az', 'Institution A to Z']].map(([v, l]) => h('option', { value: v }, l)));
    sortSel.value = (A.UI.state.mineSort || 'applied');
    const list = h('div', { class: 'list' });
    function draw() {
      A.UI.state.mineSort = sortSel.value;
      const cmp = {
        applied: (a, b) => (b.applied || '').localeCompare(a.applied || ''),
        deadline: (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'),
        wait: (a, b) => (infos.get(b).wait || -1) - (infos.get(a).wait || -1),
        az: (a, b) => a.institution.localeCompare(b.institution),
      }[sortSel.value];
      A.clear(list);
      all.slice().sort(cmp).forEach(e => list.appendChild(card(e)));
    }
    sortSel.addEventListener('change', draw);
    sec2.appendChild(h('div', { class: 'toolbar' }, sortSel));
    sec2.appendChild(list);
    root.appendChild(sec2);

    function card(e) {
      const I = infos.get(e);
      const lines = [];
      if (I.rep.length) lines.push(h('div', null, h('b', null, 'This season here: '), I.rep.slice(0, 4).map(r => r.item.kind.toLowerCase() + ' ' + A.fmtDate(r.when, false) + (r.dept === 'same' ? ' (your department)' : r.dept === 'other' ? ' (other department)' : '')).join('; ') + (I.rep.length > 4 ? '; and ' + (I.rep.length - 4) + ' more' : '') + '.'));
      else lines.push(h('div', null, h('b', null, 'This season here: '), 'no replies reported yet.'));
      if (I.tm) {
        const where = I.tm.field ? 'In ' + I.tm.field.toLowerCase() : 'Across all fields';
        let t = where + ', half of the reported replies came within ' + plural(Math.round(I.tm.median), 'day') + ' of applying, three in four within ' + plural(Math.round(I.tm.p75), 'day') + ' (' + I.tm.n + ' reports).';
        if (!I.rep.length && I.wait !== null) t += I.wait > I.tm.p75 ? ' Your wait of ' + plural(I.wait, 'day') + ' is longer than most, which often means a slow committee rather than a decision.' : (I.wait > I.tm.median ? ' Your wait of ' + plural(I.wait, 'day') + ' is longer than half of them.' : ' Your wait of ' + plural(I.wait, 'day') + ' is still within the usual range.');
        lines.push(h('div', null, h('b', null, 'Timing: '), t));
      }
      if (P) {
        const firsts = A.seasonFirsts(P, e.institution);
        lines.push(h('div', null, h('b', null, 'Last season here: '), firsts.length ? firsts.map(f => 'first ' + f.kind.toLowerCase() + ' ' + A.fmtDate(f.t)).join('; ') + '.' : 'nothing reported.'));
      }
      const area = h('div', { class: 'track-area' }, A.mySummary(e));
      const edit = h('button', { class: 'btn sm', type: 'button' }, 'Edit');
      edit.addEventListener('click', () => { A.clear(area); area.appendChild(A.trackEditor(e, { onDone: saved => { if (saved) rerender(); else { A.clear(area); area.appendChild(A.mySummary(e)); } } })); });
      const hasNew = I.rep.some(r => r.isNew) || alerts.some(a => a.entry === e && a.isNew);
      return h('article', { class: 'row nostar' },
        h('div', { class: 'row-main' },
          h('h4', { class: 'row-title' }, A.instLink(e.institution), hasNew ? h('span', { class: 'pill-new' }, 'New report') : null),
          e.department ? h('p', { class: 'row-sub' }, e.department) : null,
          h('div', { class: 'chips' }, e.location ? A.chip(e.location) : null, e.field ? A.chip(e.field) : null, e.post ? null : A.chip('Added by you')),
          area, h('div', { class: 'timing' }, lines)),
        h('div', { class: 'row-side' }, edit, e.url ? A.extButton(e.url, 'Job ad') : null));
    }
    draw();
    return root;
  };

  /* ---------------- Institution profile ---------------- */
  A.views.institution = function (params) {
    const D = A.db, P = A.prev, name = (params.name || '').trim();
    if (!name) return A.emptyState('No institution chosen', 'Click an institution name anywhere in the app to open its profile.');
    const same = n => A.sameInst(name, n);
    const posts = D.postings.filter(p => same(p.university)).sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
    const reps = A.reportsAt(D, name);
    const apps = reps.filter(r => r.tab === 'apps');
    const nores = reps.filter(r => r.tab === 'noresp');
    const changes = reps.filter(r => r.tab !== 'apps' && r.tab !== 'noresp');
    const cult = D.culture.filter(c => c.institution && same(c.institution));
    const raw = [name].concat(posts.map(p => p.university), apps.map(r => r.item.institution));
    const display = (() => { const c = A.count(raw.filter(Boolean), x => x); return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]; })();
    const cities = [...new Set(posts.map(p => A.norm(String(p.location || '').split(',')[0])).filter(c => c.length > 2))];
    const locs = D.locs.filter(l => cities.some(c => A.norm(l.city).indexOf(c) >= 0));
    const names = [...new Set(raw.map(x => A.norm(x)).filter(x => x.length >= 4 && !/^(the )?university$/.test(x)))];
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRe = names.length ? new RegExp('(^|[^a-z0-9])(' + names.map(esc).join('|') + ')([^a-z0-9]|$)') : null;
    const mentions = mentionRe ? D.comments.filter(t => mentionRe.test(t.text)).sort((a, b) => b.row - a.row) : [];
    const firstsNow = A.seasonFirsts(D, name);
    const firstsPrev = P ? A.seasonFirsts(P, name) : [];
    const prevReps = P ? A.reportsAt(P, name).filter(r => r.tab === 'apps') : [];

    const root = h('div', null, A.pageHead(display, 'Everything the sheet says about this institution. Spellings are matched loosely, so “UCSF” and “University of California, San Francisco” count as the same place.'));
    const mine = A.mine.all().filter(e => same(e.institution));
    if (mine.length) root.appendChild(h('div', { class: 'banner info' }, h('div', null, h('b', null, 'Your list: '), mine.map(e => (e.department || 'a position') + (e.applied ? ', applied ' + A.fmtDate(dayMs(e.applied)) : '') + (e.status && e.status !== 'Applied' ? ' (' + e.status.toLowerCase() + ')' : '')).join('; ') + '. ', h('a', { href: '#/mine' }, 'My applications'))));

    const kindsLine = A.RESP_ORDER.map(k => [k, apps.filter(r => r.item.kind === k).length]).filter(x => x[1]).map(([k, n]) => n + ' ' + k.toLowerCase()).join(', ');
    root.appendChild(h('div', { class: 'stats' },
      statTile('Postings this season', A.n(posts.length), posts[0] ? 'Latest added ' + A.fmtDate(posts[0].dateMs) : null),
      statTile('Replies reported', A.n(apps.length), kindsLine || 'none yet'),
      statTile('No-response reports', A.n(nores.length), nores.length ? 'people still waiting' : null),
      P ? statTile('Replies last season', A.n(prevReps.length), firstsPrev.length ? 'First: ' + firstsPrev[0].kind.toLowerCase() + ', ' + A.fmtDate(firstsPrev[0].t) : 'none reported')
        : statTile('Culture questions', A.n(cult.length), 'Add last season’s sheet in Settings to compare timing')));

    const sec = (title, lede, body) => h('section', { class: 'section' }, h('h2', null, title), lede ? h('p', { class: 'lede' }, lede) : null, body);
    if (firstsNow.length || firstsPrev.length) {
      const rowsT = A.RESP_ORDER.filter(k => firstsNow.some(f => f.kind === k) || firstsPrev.some(f => f.kind === k)).map(k => {
        const a = firstsNow.find(f => f.kind === k), b = firstsPrev.find(f => f.kind === k);
        return h('div', null, h('dt', null, k), h('dd', null, a ? A.fmtDate(a.t) : 'not yet', P ? h('small', null, '  last season: ' + (b ? A.fmtDate(b.t) : 'none')) : null));
      });
      root.appendChild(sec('When replies came', 'The first report of each kind of reply' + (P ? ', this season and last.' : '. Add last season’s sheet in Settings to compare with a year ago.'), h('dl', { class: 'kv' }, rowsT)));
    }
    if (posts.length) root.appendChild(sec('Job postings', null, h('div', { class: 'panel' }, posts.map(p => h('div', { class: 'mini' },
      h('div', { class: 't' }, p.department || p.discipline || 'Posting', ' ', A.kwGroupsOf(p).map(n => A.chip(n, 'accent'))),
      h('time', null, A.fmtDate(p.dateMs, false)),
      h('div', { class: 's' }, [p.rank, p.location, p.category].filter(Boolean).join(', ')),
      h('div', { class: 'q' }, p.url ? A.link(p.url, 'Open posting', 'ext') : null, p.notes.length ? ' ' + p.notes.slice(0, 2).join(' | ') : ''))))));
    if (apps.length) root.appendChild(sec('Replies this season', null, h('div', { class: 'panel' }, showMore(apps, 10, r => reportRow(r, false)))));
    if (nores.length || changes.length) root.appendChild(sec('Still waiting, and search changes', null, h('div', { class: 'panel' }, nores.concat(changes).map(r => reportRow(r, false)))));
    if (prevReps.length) root.appendChild(sec('Last season', 'Replies reported from here in last season’s sheet.', h('div', { class: 'panel' }, showMore(prevReps, 6, r => reportRow(Object.assign({}, r, { isNew: false }), false)))));
    if (cult.length) root.appendChild(sec('Institutional culture', null, h('div', { class: 'list' }, cult.map(c => A.thread(h('div', { class: 'thread-head' }, c.department ? h('b', null, c.department) : null, c.dateMs ? h('span', null, A.fmtDate(c.dateMs)) : null), [c.question || '(no question text)'].concat(c.notes), null, 3)))));
    if (locs.length) root.appendChild(sec('Living there', null, h('div', { class: 'list' }, locs.map(l => A.thread(h('div', { class: 'thread-head' }, h('b', null, l.city)), [l.question || 'Notes'].concat(l.pros ? ['In favour: ' + l.pros] : [], l.cons ? ['Against: ' + l.cons] : [], l.notes), null, 3)))));
    if (mentions.length) root.appendChild(sec('Mentioned in conversations', plural(mentions.length, 'thread') + ' on the comment board mention this name.', h('div', { class: 'list' }, showMore(mentions, 5, t => A.thread(h('div', { class: 'thread-head' }, t.dateMs ? h('span', null, A.fmtDate(t.dateMs)) : null), t.messages, null, 2)))));
    if (!posts.length && !reps.length && !cult.length && !mentions.length && !prevReps.length) root.appendChild(A.emptyState('Nothing found for “' + name + '”', 'Try the search box with part of the name.'));
    return root;
  };

  /* Search: list matching institution profiles above the results. */
  const baseSearch = A.views.search;
  A.views.search = function (params) {
    const root = baseSearch(params);
    const terms = A.norm(params.q || '').split(/\s+/).filter(Boolean);
    if (!terms.length || !A.db) return root;
    const seen = new Map();
    A.db.postings.map(p => p.university).concat(A.db.apps.map(a => a.institution)).forEach(n => {
      if (!n || !terms.every(t => A.norm(n).indexOf(t) >= 0)) return;
      const k = A.instKey(n).core || A.norm(n);
      if (!seen.has(k)) seen.set(k, n);
    });
    if (seen.size) {
      const box = h('div', { class: 'chips', style: { margin: '-4px 0 16px' } }, h('span', { class: 'note-line', style: { marginRight: '4px' } }, 'Institution profiles:'),
        [...seen.values()].slice(0, 10).map(n => h('a', { class: 'chip link', href: A.instHref(n) }, n)));
      const head = root.querySelector('.pagehead');
      if (head && head.nextSibling) root.insertBefore(box, head.nextSibling); else root.appendChild(box);
    }
    return root;
  };
})();
