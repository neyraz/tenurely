/* ============================================================
   Screens, part 2: the reading and browsing screens.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h;
  A.views = A.views || {};

  const newest = (a, b) => (b.dateMs || 0) - (a.dateMs || 0) || b.row - a.row;
  const oldest = (a, b) => (a.dateMs === null ? 1 : b.dateMs === null ? -1 : a.dateMs - b.dateMs) || a.row - b.row;
  const alpha = key => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''));
  const stateName = c => A.STATES[c] || c;
  const joinText = arr => arr.filter(Boolean).join(', ');

  /* ---------------- Job postings ---------------- */
  A.views.postings = function (params) {
    const D = A.db, U = A.UI;
    const k = A.kpis(D, U.prevVisit, U.keywords);
    const root = h('div', null, A.pageHead('Job postings', 'Faculty openings gathered by the community. Open a posting to read the ad. Comments left by other visitors appear under each entry.'));
    const kw = U.keywords.length ? 'Matches my keywords' : null;
    root.appendChild(A.listView({
      id: 'postings', items: D.postings, noun: 'postings', params,
      placeholder: 'Search institution, field, city or comment',
      filters: [
        { key: 'field', label: 'Fields', values: p => p.field },
        { key: 'rank', label: 'Levels', values: p => p.rankKind },
        { key: 'state', label: 'States', values: p => p.state || '', fmt: stateName },
        { key: 'cat', label: 'Types', values: p => p.categoryLabel },
        U.kwGroups.length > 1 ? { key: 'group', label: 'Keyword groups', values: p => A.kwGroupsOf(p) } : null,
      ].filter(Boolean),
      toggles: [
        { key: 'week', label: 'Added in the past 7 days', test: k.isRecent },
        A.seen.ready ? { key: 'new', label: 'New since my last visit', test: k.isNew } : null,
        kw ? { key: 'kw', label: kw, test: k.match } : null,
        { key: 'saved', label: 'Saved', test: p => U.saved.has(A.postKey(p)) },
        { key: 'mine', label: 'In my applications', test: p => !!(A.mine.forPosting(p) && (A.mine.forPosting(p).applied || A.mine.forPosting(p).status)) },
        { key: 'notes', label: 'Has comments', test: p => p.notes.length > 0 },
        (U.exclude || []).length ? { key: 'hideEx', label: 'Hide excluded words', test: p => !A.isExcluded(p) } : null,
      ].filter(Boolean),
      sorts: [{ key: 'new', label: 'Newest first', cmp: newest }, { key: 'old', label: 'Oldest first', cmp: oldest }, { key: 'az', label: 'Institution A to Z', cmp: alpha('university') }],
      csv: { name: 'faculty-postings.csv', cols: [['Date added', p => (p.dateMs ? new Date(p.dateMs).toISOString().slice(0, 10) : p.date)], ['Institution', p => p.university], ['Department', p => p.department], ['Location', p => p.location], ['Discipline', p => p.discipline], ['Level', p => p.rank], ['Type', p => p.category], ['Link', p => p.url], ['Comments', p => p.notes.join(' | ')]] },
      row: (p, ctx) => {
        const key = A.postKey(p);
        const tc = A.trackControls(p);
        const star = h('button', { class: 'star', type: 'button', 'aria-pressed': String(U.saved.has(key)), title: 'Save this posting (kept in this browser only)', 'aria-label': 'Save ' + p.university }, A.icon('star', 18, U.saved.has(key)));
        star.addEventListener('click', () => { A.toggleSaved(key); const on = U.saved.has(key); star.setAttribute('aria-pressed', String(on)); A.clear(star); star.appendChild(A.icon('star', 18, on)); });
        const chips = h('div', { class: 'chips' },
          ...(U.kwGroups.length > 1 ? A.kwGroupsOf(p).map(g => A.chip(g, 'accent')) : [k.match(p) ? A.chip('Matches your keywords', 'accent') : null]),
          p.field !== 'Not stated' ? A.chip(p.field, '', () => A.go('postings', { field: p.field })) : null,
          p.rankKind !== 'Not stated' ? A.chip(p.rank && p.rank.length < 34 ? p.rank : p.rankKind) : null,
          p.category ? A.chip(p.category) : null,
          p.location ? A.chip(p.location, '', p.state ? () => A.go('postings', { state: p.state }) : null) : null);
        return h('article', { class: 'row' },
          star,
          h('div', { class: 'row-main' },
            h('h4', { class: 'row-title' }, p.university ? A.instLink(p.university, ctx.re) : 'Untitled posting', k.isNew(p) ? h('span', { class: 'pill-new' }, 'New') : null),
            p.department ? h('p', { class: 'row-sub' }, A.rich(p.department, ctx.re)) : null,
            chips, A.notesBlock(p.notes, ctx.re, 2), tc.area),
          h('div', { class: 'row-side' }, h('time', null, A.fmtDate(p.dateMs)), tc.btn, p.url ? A.extButton(p.url) : h('span', null, 'No link')));
      },
    }));
    return root;
  };

  /* ---------------- Applications ---------------- */
  A.views.applications = function (params) {
    const D = A.db;
    const root = h('div', null, A.pageHead('Applications and replies', 'What people reported hearing back from each institution: interviews, rejections, requests for letters and offers. Entries are posted voluntarily and anonymously.'));
    const dayText = a => {
      const bits = [];
      if (a.submittedMs) bits.push('Submitted ' + A.fmtDate(a.submittedMs));
      else if (a.submitted) bits.push('Submitted ' + a.submitted);
      if (a.respondedMs) bits.push('heard back ' + A.fmtDate(a.respondedMs) + (a.daysToResponse !== null ? ' (after ' + A.plural(a.daysToResponse, 'day') + ')' : ''));
      else if (a.responseDate) bits.push('heard back ' + a.responseDate);
      return bits.join(', ');
    };
    root.appendChild(A.listView({
      id: 'applications', items: D.apps, noun: 'replies', params,
      placeholder: 'Search institution, department, field, city or note',
      filters: [
        { key: 'kind', label: 'Replies', values: a => a.kind, order: A.RESP_ORDER },
        { key: 'rank', label: 'Levels', values: a => a.rankKind },
        { key: 'state', label: 'States', values: a => a.state || '', fmt: stateName },
        { key: 'field', label: 'Fields', values: a => a.field },
      ],
      toggles: [A.newToggle('app'), { key: 'notes', label: 'Has notes', test: a => a.noteList.length > 0 }, { key: 'link', label: 'Has job ad link', test: a => !!a.url }].filter(Boolean),
      sorts: [
        { key: 'new', label: 'Newest first', cmp: (a, b) => (b.addedMs || 0) - (a.addedMs || 0) || b.row - a.row },
        { key: 'old', label: 'Oldest first', cmp: (a, b) => (a.addedMs === null ? 1 : b.addedMs === null ? -1 : a.addedMs - b.addedMs) || a.row - b.row },
        { key: 'fast', label: 'Fastest reply', cmp: (a, b) => (a.daysToResponse === null ? 1e9 : a.daysToResponse) - (b.daysToResponse === null ? 1e9 : b.daysToResponse) },
        { key: 'az', label: 'Institution A to Z', cmp: alpha('institution') },
      ],
      csv: { name: 'faculty-applications.csv', cols: [['Added', a => a.date], ['Institution', a => a.institution], ['Department', a => a.department], ['Specialty', a => a.specialty], ['Location', a => a.location], ['Level', a => a.position], ['Reply', a => a.response], ['Submitted', a => a.submitted], ['Reply date', a => a.responseDate], ['Notes', a => a.noteList.join(' | ')], ['Job ad', a => a.url]] },
      row: (a, ctx) => h('article', { class: 'row nostar' },
        h('div', { class: 'row-main' },
          h('h4', { class: 'row-title' }, A.instLink(a.institution, ctx.re), A.seen.isNew(a, 'app') ? h('span', { class: 'pill-new' }, 'New') : null),
          joinText([a.department, a.specialty]) ? h('p', { class: 'row-sub' }, A.rich(joinText([a.department, a.specialty]), ctx.re)) : null,
          h('div', { class: 'chips' },
            h('span', { class: 'badge' }, h('i', { style: { background: A.RESP_COLOR[a.kind] || 'var(--axis)' } }), a.response || a.kind),
            a.rankKind !== 'Not stated' ? A.chip(a.rankKind) : null,
            a.location ? A.chip(a.location) : null),
          dayText(a) ? h('p', { class: 'row-sub', style: { marginTop: '8px', fontSize: '13px' } }, dayText(a)) : null,
          A.notesBlock(a.noteList, ctx.re, 2)),
        h('div', { class: 'row-side' }, h('time', null, a.addedMs ? 'Added ' + A.fmtDate(a.addedMs) : ''), a.url ? A.extButton(a.url, 'Job ad') : null)),
    }));
    return root;
  };

  /* ---------------- No response ---------------- */
  A.views.noresponse = function (params) {
    const D = A.db;
    const root = h('div', null, A.pageHead('No response yet', 'Applications that have gone quiet. Use this to check whether silence from a department is normal this season.'));
    if (D.noRespHint) root.appendChild(h('div', { class: 'banner info' }, h('div', null, h('b', null, 'Posting etiquette. '), D.noRespHint.charAt(0) + D.noRespHint.slice(1).toLowerCase() + '.')));
    root.appendChild(A.listView({
      id: 'noresponse', items: D.noresp, noun: 'reports', params,
      placeholder: 'Search institution, department, city or comment',
      filters: [{ key: 'state', label: 'States', values: r => r.state || '', fmt: stateName }, { key: 'rank', label: 'Levels', values: r => A.rankBucket(r.rank) }],
      toggles: [A.newToggle('nores'), { key: 'notes', label: 'Has comments', test: r => r.notes.length > 0 }].filter(Boolean),
      sorts: [{ key: 'new', label: 'Newest first', cmp: newest }, { key: 'wait', label: 'Longest since deadline', cmp: (a, b) => (a.deadlineMs === null ? 1 : b.deadlineMs === null ? -1 : a.deadlineMs - b.deadlineMs) }, { key: 'az', label: 'Institution A to Z', cmp: alpha('institution') }],
      csv: { name: 'faculty-no-response.csv', cols: [['Date', r => r.date], ['Institution', r => r.institution], ['Deadline', r => r.deadline], ['Department', r => r.department], ['Level', r => r.rank], ['Location', r => r.location], ['Job ad', r => r.url], ['Comments', r => r.notes.join(' | ')]] },
      row: (r, ctx) => {
        const since = A.daysSince(r.deadlineMs);
        return h('article', { class: 'row nostar' },
          h('div', { class: 'row-main' },
            h('h4', { class: 'row-title' }, A.instLink(r.institution, ctx.re), A.seen.isNew(r, 'nores') ? h('span', { class: 'pill-new' }, 'New') : null),
            r.department ? h('p', { class: 'row-sub' }, A.rich(r.department, ctx.re)) : null,
            h('div', { class: 'chips' }, r.rank ? A.chip(r.rank) : null, r.location ? A.chip(r.location) : null,
              r.deadlineMs ? A.chip('Deadline ' + A.fmtDate(r.deadlineMs) + (since !== null && since >= 0 ? ' (' + A.plural(since, 'day') + ' ago)' : '')) : (r.deadline ? A.chip('Deadline: ' + r.deadline) : null)),
            A.notesBlock(r.notes, ctx.re, 2)),
          h('div', { class: 'row-side' }, h('time', null, r.dateMs ? 'Posted ' + A.fmtDate(r.dateMs) : ''), r.url ? A.extButton(r.url, 'Job ad') : null));
      },
    }));
    return root;
  };

  /* ---------------- Offers and searches (short lists, no controls) ---------------- */
  A.views.offers = function () {
    const D = A.db;
    const root = h('div', null, A.pageHead('Offers and search changes', 'Accepted offers reported by candidates, plus searches that have been frozen, cancelled or have failed.'));
    const block = (title, lede, items, row) => {
      const sec = h('section', { class: 'section', style: { marginTop: '28px' } }, h('h2', null, title + ' (' + items.length + ')'), lede ? h('p', { class: 'lede' }, lede) : null);
      if (!items.length) sec.appendChild(h('p', { class: 'note-line' }, 'Nothing reported yet.'));
      else sec.appendChild(h('div', { class: 'list' }, items.map(row)));
      return sec;
    };
    root.appendChild(block('Offers reported', 'Self-reported by candidates. The first entry is often a leftover example from the previous season.', D.offers, o => h('article', { class: 'row nostar' },
      h('div', { class: 'row-main' },
        h('h4', { class: 'row-title' }, A.instLink(o.institution), A.badge(o.status || 'Reported', o.status && /accept/i.test(o.status) ? 'var(--s3)' : 'var(--axis)')),
        o.department ? h('p', { class: 'row-sub' }, o.department) : null,
        h('div', { class: 'chips' }, o.position ? A.chip(o.position) : null, o.location ? A.chip(o.location) : null, o.lastCycle ? A.chip('Previous season') : null),
        A.notesBlock(o.notes, null, 2)),
      h('div', { class: 'row-side' }, h('time', null, o.dateMs ? A.fmtDate(o.dateMs) : o.date), o.url ? A.extButton(o.url, 'Source') : (o.source ? h('span', null, o.source) : null)))));
    root.appendChild(block('Frozen or cancelled searches', null, D.frozen, f => h('article', { class: 'row nostar' },
      h('div', { class: 'row-main' }, h('h4', { class: 'row-title' }, A.instLink(f.institution)), f.department ? h('p', { class: 'row-sub' }, f.department) : null, h('div', { class: 'chips' }, f.status ? A.chip(f.status, 'accent') : null), A.notesBlock(f.notes, null, 2)),
      h('div', { class: 'row-side' }, h('time', null, f.dateMs ? A.fmtDate(f.dateMs) : f.date)))));
    root.appendChild(block('Failed searches', null, D.failed, f => h('article', { class: 'row nostar' },
      h('div', { class: 'row-main' }, h('h4', { class: 'row-title' }, A.instLink(f.institution)), f.department ? h('p', { class: 'row-sub' }, f.department) : null,
        h('div', { class: 'chips' }, f.status ? A.chip(f.status, 'accent') : null, f.confirmed ? A.chip('Confirmed: ' + f.confirmed) : null, f.source ? A.chip('Source: ' + f.source) : null),
        f.info ? h('div', { class: 'notes' }, h('div', { class: 'note' }, A.rich(f.info))) : null),
      h('div', { class: 'row-side' }, h('time', null, f.dateMs ? A.fmtDate(f.dateMs) : f.date)))));
    return root;
  };

  /* ---------------- Negotiations ---------------- */
  A.views.negotiations = function (params) {
    const D = A.db;
    const root = h('div', null, A.pageHead('Negotiations', 'Salary, startup and teaching terms people were offered and what they finally agreed. The wording is kept as people typed it.'));
    const line = (label, vals) => {
      const parts = vals.filter(v => v[1]);
      if (!parts.length) return null;
      return h('div', null, h('dt', null, label), h('dd', null, parts.map(([k2, v]) => h('div', null, h('small', null, k2 + ' '), v))));
    };
    const single = (label, v) => (v ? h('div', null, h('dt', null, label), h('dd', null, v)) : null);
    root.appendChild(A.listView({
      id: 'negotiations', items: D.nego, noun: 'packages', params,
      placeholder: 'Search type, field, region or comment',
      filters: [{ key: 'type', label: 'Institution types', values: n => n.type }, { key: 'prior', label: 'Prior roles', values: n => n.prior }],
      toggles: [A.newToggle('nego'), { key: 'notes', label: 'Has comments', test: n => n.notes.length > 0 }].filter(Boolean),
      sorts: [{ key: 'new', label: 'Newest first', cmp: newest }, { key: 'old', label: 'Oldest first', cmp: oldest }],
      csv: { name: 'faculty-negotiations.csv', cols: [['Date', n => n.date], ['Type', n => n.type], ['Field', n => n.field], ['Region', n => n.region], ['Prior position', n => n.prior], ['Salary offered', n => n.salaryOffered], ['Salary asked', n => n.salaryAsked], ['Salary granted', n => n.salaryGranted], ['Startup offered', n => n.startupOffered], ['Startup asked', n => n.startupAsked], ['Startup granted', n => n.startupGranted], ['Salary type', n => n.salaryType], ['Teaching', n => n.teaching], ['Comments', n => n.notes.join(' | ')]] },
      row: (n, ctx) => h('article', { class: 'row nostar' },
        h('div', { class: 'row-main' },
          h('h4', { class: 'row-title' }, A.rich(n.label, ctx.re)),
          h('div', { class: 'chips' }, n.pubpriv ? A.chip(n.pubpriv) : null, n.region ? A.chip(n.region) : null, n.prior ? A.chip('From: ' + n.prior) : null),
          h('dl', { class: 'kv' },
            line('Base salary', [['Offered', n.salaryOffered], ['Asked', n.salaryAsked], ['Granted', n.salaryGranted]]),
            line('Startup', [['Offered', n.startupOffered], ['Asked', n.startupAsked], ['Granted', n.startupGranted]]),
            single('Salary support', n.salaryType), single('Appointment', n.appointment), single('Cost of living', n.cost), single('Relocation', n.relocation), single('Teaching load', n.teaching), single('Lab type', n.labType)),
          A.notesBlock(n.notes, ctx.re, 2)),
        h('div', { class: 'row-side' }, h('time', null, n.dateMs ? A.fmtDate(n.dateMs) : n.date))),
    }));
    return root;
  };

  /* ---------------- Institutional culture ---------------- */
  A.views.culture = function (params) {
    const D = A.db;
    const root = h('div', null, A.pageHead('Institutional culture', 'Questions about what a department is like to work in, with answers from people who know. Treat single anecdotes with care.'));
    root.appendChild(A.listView({
      id: 'culture', items: D.culture, noun: 'questions', params, pageSize: 25,
      placeholder: 'Search institution, department or comment',
      toggles: [A.newToggle('cult', 'New or newly answered'), { key: 'answered', label: 'Has answers', test: c => c.notes.length > 0 }, { key: 'open', label: 'Still unanswered', test: c => c.notes.length === 0 }].filter(Boolean),
      sorts: [{ key: 'new', label: 'Newest first', cmp: (a, b) => b.row - a.row }, { key: 'old', label: 'Oldest first', cmp: (a, b) => a.row - b.row }, { key: 'az', label: 'Institution A to Z', cmp: alpha('institution') }],
      row: (c, ctx) => A.thread(
        h('div', { class: 'thread-head' }, h('b', null, c.institution ? A.instLink(c.institution, ctx.re) : 'Unnamed institution'), A.seen.isNew(c, 'cult') ? h('span', { class: 'pill-new' }, 'New') : (A.seen.newReplies(c, 'cult') ? h('span', { class: 'pill-new' }, A.plural(A.seen.newReplies(c, 'cult'), 'new answer')) : null), c.department && c.department !== 'any' ? h('span', null, A.rich(c.department, ctx.re)) : null, c.dateMs ? h('span', null, A.fmtDate(c.dateMs)) : null),
        [c.question || '(no question text)'].concat(c.notes), ctx.re, 3),
    }));
    return root;
  };

  /* ---------------- Locations ---------------- */
  A.views.locations = function (params) {
    const D = A.db;
    const root = h('div', null, A.pageHead('Locations', 'What it is like to live in the towns and cities where jobs are advertised: housing, schools, nature, politics and community.'));
    root.appendChild(A.listView({
      id: 'locations', items: D.locs, noun: 'places', params, pageSize: 25,
      placeholder: 'Search a city, a question or a comment',
      filters: [{ key: 'state', label: 'States', values: l => l.state || '', fmt: stateName }],
      toggles: [A.newToggle('loc', 'New or newly answered'), { key: 'answered', label: 'Has answers', test: l => l.answered }, { key: 'open', label: 'Still unanswered', test: l => !l.answered }].filter(Boolean),
      sorts: [{ key: 'az', label: 'Place A to Z', cmp: alpha('city') }, { key: 'new', label: 'Newest first', cmp: (a, b) => b.row - a.row }, { key: 'most', label: 'Most replies', cmp: (a, b) => b.notes.length - a.notes.length }],
      row: (l, ctx) => {
        const el = h('article', { class: 'thread' },
          h('div', { class: 'thread-head' }, h('b', null, A.rich(l.city, ctx.re)), l.state ? A.chip(stateName(l.state), '', () => A.go('locations', { state: l.state })) : null),
          l.question ? h('div', { class: 'post' }, A.rich(l.question, ctx.re)) : null);
        if (l.pros || l.cons) el.appendChild(h('div', { class: 'cols2' }, h('div', null, h('h5', null, 'In favour'), h('p', null, A.rich(l.pros || '–', ctx.re))), h('div', null, h('h5', null, 'Against'), h('p', null, A.rich(l.cons || '–', ctx.re)))));
        if (l.notes.length) el.appendChild(h('div', { class: 'replies' }, l.notes.map(n => h('div', { class: 'reply' }, A.rich(n, ctx.re)))));
        return el;
      },
    }));
    return root;
  };

  /* ---------------- Community conversations ---------------- */
  A.views.community = function (params) {
    const D = A.db;
    const tabs = [{ id: 'comments', label: 'Conversations', items: D.comments, ph: 'Search the conversations' }, { id: 'visa', label: 'Visas and immigration', items: D.visa, ph: 'Search visa and immigration threads' }, { id: 'happy', label: 'Happy tab', items: D.happy, ph: 'Search the happy tab' }];
    const KIND = { comments: 'com', visa: 'visa', happy: 'joy' };
    const tabState = A.UI.state.communityTab || (A.UI.state.communityTab = { id: 'comments' });
    if (params.tab) tabState.id = params.tab;
    const root = h('div', null, A.pageHead('Community conversations', 'The anonymous comment board. Newest threads come first; replies are shown in the order they were posted.'));
    const body = h('div', null);
    const seg = h('div', { class: 'seg-tabs', role: 'group', 'aria-label': 'Conversation boards', style: { marginBottom: '14px' } });
    function show() {
      A.clear(body);
      const t = tabs.find(x => x.id === tabState.id) || tabs[0];
      const today = A.today();
      body.appendChild(A.listView({
        id: 'community-' + t.id, items: t.items, noun: 'threads', params: params.tab ? Object.assign({}, params, { tab: undefined }) : params, pageSize: 30,
        placeholder: t.ph,
        toggles: [A.newToggle(KIND[t.id], 'New or with new replies'), { key: 'week', label: 'Past 7 days', test: c => c.dateMs !== null && c.dateMs >= today - 7 * A.DAY && c.dateMs <= today + 2 * A.DAY }, { key: 'replies', label: 'Has replies', test: c => c.messages.length > 1 }].filter(Boolean),
        sorts: [{ key: 'new', label: 'Newest first', cmp: (a, b) => b.row - a.row }, { key: 'old', label: 'Oldest first', cmp: (a, b) => a.row - b.row }, { key: 'busy', label: 'Most replies', cmp: (a, b) => b.messages.length - a.messages.length || b.row - a.row }],
        row: (c, ctx) => A.thread(h('div', { class: 'thread-head' }, c.dateMs ? h('span', null, A.fmtDate(c.dateMs)) : (c.date ? h('span', null, c.date) : null), A.seen.isNew(c, KIND[t.id]) ? h('span', { class: 'pill-new' }, 'New thread') : (A.seen.newReplies(c, KIND[t.id]) ? h('span', { class: 'pill-new' }, A.plural(A.seen.newReplies(c, KIND[t.id]), 'new reply', 'new replies')) : null)), c.messages, ctx.re, 3),
      }));
      [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === t.id)));
    }
    tabs.forEach(t => {
      const b = h('button', { type: 'button', 'data-id': t.id, 'aria-pressed': 'false' }, t.label + ' (' + t.items.length + ')');
      b.addEventListener('click', () => { tabState.id = t.id; show(); });
      seg.appendChild(b);
    });
    root.appendChild(seg); root.appendChild(body);
    show();
    return root;
  };

  /* ---------------- Resources ---------------- */
  // A resource line is "label: https://..." in one cell. Show the label as the link and the site name beside it.
  function resItem(it) {
    const text = it.text || '';
    const url = it.url || (text.match(/https?:\/\/[^\s)]+/) || [])[0];
    if (!url) return A.rich(text);
    const label = text.replace(/https?:\/\/[^\s)]+/g, '').replace(/[\s:\u2013-]+$/, '').replace(/\s{2,}/g, ' ').trim();
    return h('span', null, A.link(url, label || A.shortUrl(url), 'ext'), ' ', h('small', { style: { color: 'var(--ink3)' } }, A.host(url)));
  }

  A.views.resources = function () {
    const D = A.db;
    const root = h('div', null, A.pageHead('Resources', 'The glossary, reading list and house rules from the spreadsheet, with every link made clickable.'));
    const g = h('div', { class: 'grid g3' });
    D.glossary.forEach(col => {
      g.appendChild(h('section', { class: 'card' },
        h('header', { class: 'card-head' }, h('h3', null, col.title || 'Links')),
        h('div', { class: 'notes', style: { marginTop: 0 } }, col.items.map(it => h('div', { class: 'note' }, resItem(it))))));
    });
    root.appendChild(g);
    if (D.welcome.length) {
      root.appendChild(h('section', { class: 'section' }, h('h2', null, 'House rules from the sheet'),
        h('div', { class: 'notes' }, D.welcome.slice(0, 14).map(t => h('div', { class: 'note' }, A.rich(t))))));
    }
    return root;
  };
})();
