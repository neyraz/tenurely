/* ============================================================
   Screens, part 1: overview, statistics, search.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const h = A.h;
  A.views = A.views || {};

  const plural = A.plural;
  const byNewest = (a, b) => (b.dateMs || 0) - (a.dateMs || 0) || b.row - a.row;

  function statTile(label, value, note, onClick) {
    const el = h('div', { class: 'stat' + (onClick ? ' click' : ''), tabindex: onClick ? '0' : null, role: onClick ? 'link' : null },
      h('div', { class: 'lbl' }, label), h('div', { class: 'val' }, value), note ? h('div', { class: 'note' }, note) : null);
    if (onClick) { el.addEventListener('click', onClick); el.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(); }); }
    return el;
  }
  function fieldBars(items, onClickKey) {
    return A.hbars(items.map(([label, n]) => ({ label, value: n, sub: 'postings', onClick: onClickKey ? () => onClickKey(label) : null })), { unit: 'postings', labelName: 'Group', valueName: 'Postings' });
  }
  function miniPosting(p) {
    return h('div', { class: 'mini' },
      h('div', { class: 't' }, p.url ? A.link(p.url, p.university, 'ext') : p.university),
      h('time', null, A.fmtDate(p.dateMs, false)),
      h('div', { class: 's' }, [p.department, p.location].filter(Boolean).join(', ')));
  }
  function miniThread(c) {
    const first = c.messages[0];
    return h('div', { class: 'mini' },
      h('div', { class: 't' }, first.length > 150 ? first.slice(0, 149) + '…' : first),
      h('time', null, c.dateMs ? A.fmtDate(c.dateMs, false) : ''),
      h('div', { class: 's' }, c.messages.length > 1 ? plural(c.messages.length - 1, 'reply', 'replies') : 'No replies yet'));
  }

  /* ---------------- Overview ---------------- */
  A.views.overview = function () {
    const D = A.db, U = A.UI;
    const k = A.kpis(D, U.prevVisit, U.keywords);
    const root = h('div', null);
    root.appendChild(A.pageHead('The market this season', 'Read from the community spreadsheet: what is being advertised, who is hearing back, and what people are saying.'));

    root.appendChild(h('div', { class: 'hero' },
      h('div', { class: 'big' }, A.n(k.postings)),
      h('p', { class: 'words' }, 'job postings are on the board. ',
        h('span', null, plural(k.postingsWeek, 'was', 'were') + ' added in the past week' + (k.postingsNew !== null ? ', ' + k.postingsNew + ' since your last visit.' : '.')))));

    const kwOn = U.keywords.length > 0;
    root.appendChild(h('div', { class: 'stats' },
      kwOn ? statTile('Matching your keywords', A.n(k.matching), k.matchingWeek + ' added this week', () => A.go('postings', { kw: '1' })) : statTile('Keyword watch', 'Off', 'Add keywords in Settings to highlight postings', () => document.dispatchEvent(new CustomEvent('fma:settings'))),
      statTile('Interview invitations logged', A.n(k.interviews), k.remote + ' remote, ' + k.onsite + ' onsite', () => A.go('applications')),
      statTile('Offers in the application log', A.n(k.offers), k.acceptedOffers + ' accepted ' + (k.acceptedOffers === 1 ? 'offer is' : 'offers are') + ' listed on the offers page', () => A.go('offers')),
      statTile('Conversations', A.n(k.threads), k.threadsWeek + ' in the past week', () => A.go('community'))));

    // weekly postings + tile map
    const weekly = A.weekly(D.postings.map(p => p.dateMs), D.win);
    const stateCounts = A.count(D.postings, p => p.state);
    const noState = D.postings.filter(p => !p.state).length;
    const g1 = h('div', { class: 'grid g21', style: { marginTop: '16px' } });
    g1.appendChild(A.chartCard({
      title: 'Postings added each week', sub: 'Weeks start on Monday. The latest week is still in progress.',
      draw: w => A.columns(weekly.map(x => ({ label: A.fmtDate(x.t, false), v: x.v, tipTitle: 'Week of ' + A.fmtDate(x.t) })), w, { unit: 'postings', xName: 'Week starting', valueName: 'Postings added', aria: 'Postings added per week', height: 330 }),
    }));
    g1.appendChild(A.chartCard({
      title: 'Where the postings are', sub: 'One square per state. ' + A.n(noState) + ' postings are outside the US or have no state.',
      draw: w => A.tileMap(stateCounts, Math.min(w, 460), { unit: 'postings', onClick: code => A.go('postings', { state: code }), aria: 'US states by number of postings' }),
    }));
    root.appendChild(g1);

    // fields + response mix
    const fields = A.top(A.count(D.postings, p => (p.field === 'Not stated' ? null : p.field)), 10);
    const mix = A.responseMix(D.apps);
    const days = D.apps.map(a => a.daysToResponse).filter(x => x !== null);
    const g2 = h('div', { class: 'grid g2', style: { marginTop: '16px' } });
    g2.appendChild(A.chartCard({ title: 'Fields that are hiring', sub: 'Postings grouped by discipline wording. Select a bar to read those postings.', draw: () => fieldBars(fields, label => A.go('postings', { field: label })) }));
    g2.appendChild(A.chartCard({
      title: 'How applicants are hearing back', sub: 'Responses people have logged on the applications tab.',
      draw: () => {
        const seg = A.segBar(mix.map(m => ({ label: m.kind, value: m.n, color: A.RESP_COLOR[m.kind], ink: A.RESP_INK[m.kind], onClick: () => A.go('applications', { kind: m.kind }) })), { name: 'Response', onClick: true, aria: 'Response types' });
        const extra = h('p', { class: 'note-line', style: { marginTop: '14px' } }, days.length ? 'The median wait for a first reply is ' + Math.round(A.median(days)) + ' days (' + A.n(days.length) + ' applications with both dates).' : '');
        return { node: h('div', null, seg.node, extra), table: seg.table };
      },
    }));
    root.appendChild(g2);

    // newest postings + latest conversations
    const newest = D.postings.slice().sort(byNewest).slice(0, 7);
    const latest = D.comments.slice().sort((a, b) => b.row - a.row).slice(0, 5);
    const g3 = h('div', { class: 'grid g2', style: { marginTop: '16px' } });
    const p1 = h('section', { class: 'panel' }, h('header', null, h('h3', null, 'Newest postings'), h('a', { href: '#/postings' }, 'See all')), newest.map(miniPosting));
    const p2 = h('section', { class: 'panel' }, h('header', null, h('h3', null, 'Latest conversations'), h('a', { href: '#/community' }, 'Read more')), latest.map(miniThread));
    g3.appendChild(p1); g3.appendChild(p2);
    root.appendChild(g3);
    return root;
  };

  /* ---------------- Statistics ---------------- */
  A.views.statistics = function () {
    const D = A.db;
    const k = A.kpis(D, A.UI.prevVisit, A.UI.keywords);
    const root = h('div', null, A.pageHead('Statistics', 'Counts and trends drawn from every tab. Each chart has a Table button that shows the numbers behind it.'));

    /* Postings */
    const sec1 = h('section', { class: 'section' }, h('h2', null, 'Job postings'));
    const cum = A.cumulative(D.postings.map(p => p.dateMs), D.win);
    const g = h('div', { class: 'grid g2', style: { marginTop: '14px' } });
    g.appendChild(A.chartCard({ title: 'Postings collected so far', sub: 'Running total by the date each posting was added.' + (D.postings.some(p => p.dateMs === null) ? ' ' + A.plural(D.postings.filter(p => p.dateMs === null).length, 'posting') + ' without a date ' + (D.postings.filter(p => p.dateMs === null).length === 1 ? 'is' : 'are') + ' left out.' : ''), draw: w => (cum.length ? A.areaLine(cum, w, { unit: 'postings', valueName: 'Total postings', aria: 'Cumulative postings' }) : { node: A.emptyState('No dated postings yet'), table: { head: [], rows: [] } }) }));
    g.appendChild(A.chartCard({ title: 'Fields', sub: 'Every posting grouped by discipline wording.', draw: () => fieldBars(A.top(A.count(D.postings, p => p.field), 16), label => A.go('postings', { field: label })) }));
    g.appendChild(A.chartCard({ title: 'Position level', draw: () => fieldBars(A.top(A.count(D.postings, p => p.rankKind), 8), label => A.go('postings', { rank: label })) }));
    g.appendChild(A.chartCard({ title: 'States with the most postings', draw: () => A.hbars(A.top(A.count(D.postings, p => p.state), 12).map(([c, n]) => ({ label: A.STATES[c], value: n, sub: 'postings', onClick: () => A.go('postings', { state: c }) })), { unit: 'postings', labelName: 'State', valueName: 'Postings' }) }));
    g.appendChild(A.chartCard({ title: 'Institution type tag', sub: 'The category column, where editors filled it in.', draw: () => fieldBars(A.top(A.count(D.postings, p => p.categoryLabel), 8), label => A.go('postings', { cat: label })) }));
    sec1.appendChild(g);
    root.appendChild(sec1);

    /* Responses */
    const sec2 = h('section', { class: 'section' }, h('h2', null, 'Responses from search committees'),
      h('p', { class: 'lede' }, 'These come from the applications tab, where people log the replies they received. Because people choose what to post, this shows what is happening, not how likely an application is to succeed. For rates, see the applicant benchmarks below.'));
    const days = D.apps.map(a => a.daysToResponse).filter(x => x !== null);
    sec2.appendChild(h('div', { class: 'stats' },
      statTile('Median days to hear back', days.length ? String(Math.round(A.median(days))) : '–', A.n(days.length) + ' applications with both dates'),
      statTile('Interview invitations', A.n(k.interviews), k.remote + ' remote, ' + k.onsite + ' onsite'),
      statTile('Rejections logged', A.n((D.apps.filter(a => a.kind === 'Rejection')).length), 'Many rejections are never posted'),
      statTile('Offers logged', A.n(k.offers), 'Verbal and written')));
    const rbm = A.responsesByMonth(D.apps, D.win);
    const g2 = h('div', { class: 'grid g2', style: { marginTop: '16px' } });
    g2.appendChild(A.chartCard({
      title: 'Responses by month', sub: 'Counted by the date of the reply, or the date added when no reply date is given.',
      draw: w => A.stacked(rbm.months.map(t => ({ label: A.MON[new Date(t).getUTCMonth()], tipTitle: A.fmtMonth(t) })), A.RESP_ORDER.map(kind => ({ name: kind, color: A.RESP_COLOR[kind], values: rbm.byKind[kind] })), w, { xName: 'Month', aria: 'Responses by month and type' }),
    }));
    g2.appendChild(A.chartCard({
      title: 'Institutions sending the most interview invitations', sub: 'Remote and onsite invitations combined.',
      draw: () => A.hbars(A.topInterviewers(D.apps, 10).map(x => ({ label: x.name, value: x.n, sub: 'interview invitations' })), { unit: 'invitations', labelName: 'Institution', valueName: 'Invitations' }),
    }));
    sec2.appendChild(g2);
    root.appendChild(sec2);

    /* Applicant benchmarks */
    const B = A.benchmarks(D.stats);
    const sec3 = h('section', { class: 'section' }, h('h2', null, 'Applicant benchmarks'),
      h('p', { class: 'lede' }, 'Self-reported totals from the applicant stats tab (' + B.n + ' respondents, ' + B.ongoing + ' still applying). Small, voluntary samples lean toward people with news to share, so read these as context, not as odds.'));
    sec3.appendChild(h('div', { class: 'stats' },
      statTile('Median applications sent', B.medApps === null ? '–' : String(Math.round(B.medApps)), 'Half sent fewer, half sent more'),
      statTile('Median interviews reported', B.medInterviews === null ? '–' : String(Math.round(B.medInterviews)), 'Remote and onsite combined'),
      statTile('Reached any interview', A.pct(B.withInterview), 'of respondents'),
      statTile('Received an offer', A.pct(B.withOffer), 'of respondents')));
    const g3 = h('div', { class: 'grid g2', style: { marginTop: '16px' } });
    g3.appendChild(A.chartCard({
      title: 'How far respondents got', sub: 'Share of respondents reaching each stage.',
      draw: () => A.hbars([['Heard back from at least one department', B.withReply], ['Reached any interview', B.withInterview], ['Reached an onsite visit', B.withOnsite], ['Received an offer', B.withOffer]].map(([label, v]) => ({ label, value: Math.round((v || 0) * 100), sub: 'of respondents' })), { fmt: v => v + '%', labelName: 'Stage', valueName: 'Share of respondents' }),
    }));
    g3.appendChild(A.chartCard({
      title: 'Number of applications sent', sub: 'Respondents by applications sent.',
      draw: w => A.columns(B.hist.map(x => ({ label: x.label, v: x.v })), w, { unit: 'respondents', xName: 'Applications sent', valueName: 'Respondents', aria: 'Respondents by number of applications' }),
    }));
    g3.appendChild(A.chartCard({
      title: 'Applications sent against interviews', sub: 'Each dot is one respondent. Hover to see the details.',
      draw: w => A.scatter(B.points, w, { xName: 'Applications sent', yName: 'Interviews reported', aria: 'Applications sent versus interviews reported' }),
    }));
    g3.appendChild(A.chartCard({
      title: 'Institution types applied to', sub: 'Respondents can list more than one.',
      draw: () => A.hbars(B.types.map(([label, n]) => ({ label, value: n, sub: 'respondents' })), { unit: 'respondents', labelName: 'Type', valueName: 'Respondents' }),
    }));
    sec3.appendChild(g3);
    const cyc = h('section', { class: 'card', style: { marginTop: '16px' } },
      h('header', { class: 'card-head' }, h('div', null, h('h3', null, 'By search cycle'), h('p', { class: 'sub' }, 'How many times a respondent has been on the market.'))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'plain-table' },
        h('thead', null, h('tr', null, ['Cycle', 'Respondents', 'Median applications', 'Any interview', 'Any offer'].map((t, i) => h('th', { class: i ? 'num' : '' }, t)))),
        h('tbody', null, B.cycles.map(c => h('tr', null, h('td', null, c.cycle), h('td', { class: 'num' }, A.n(c.n)), h('td', { class: 'num' }, c.medApps === null ? '–' : String(Math.round(c.medApps))), h('td', { class: 'num' }, A.pct(c.interview)), h('td', { class: 'num' }, A.pct(c.offer))))))));
    sec3.appendChild(cyc);
    root.appendChild(sec3);

    /* Negotiations */
    const sRows = A.moneyRows(D.nego, 'startupOfferedNum', 'startupGrantedNum');
    const wRows = A.moneyRows(D.nego, 'salaryOfferedNum', 'salaryGrantedNum');
    const sec4 = h('section', { class: 'section' }, h('h2', null, 'Negotiated packages'),
      h('p', { class: 'lede' }, 'Free-text entries read on a best-effort basis (the first amount in each cell). Some startup figures include salary support, so check the original wording on the Negotiations page before comparing.'));
    const g4 = h('div', { class: 'grid g2' });
    const dumb = (rows, name) => w => A.dumbbell(rows, w, { fmt: A.money, aName: 'Offered', bName: 'Granted', aColor: 'var(--s1)', bColor: 'var(--s2)', aria: name });
    g4.appendChild(A.chartCard({ title: 'Startup packages', sub: 'First offer and final package, per entry.', draw: w => (sRows.length ? dumb(sRows, 'Startup offered and granted')(w) : { node: A.emptyState('No startup figures yet'), table: { head: [], rows: [] } }) }));
    g4.appendChild(A.chartCard({ title: 'Base salary', sub: 'First offer and final salary, per entry.', draw: w => (wRows.length ? dumb(wRows, 'Salary offered and granted')(w) : { node: A.emptyState('No salary figures yet'), table: { head: [], rows: [] } }) }));
    sec4.appendChild(g4);
    root.appendChild(sec4);

    /* Community */
    const weeklyC = A.weekly(D.comments.map(c => c.dateMs), D.win);
    const sec5 = h('section', { class: 'section' }, h('h2', null, 'Community activity'));
    sec5.appendChild(h('div', { class: 'grid', style: { marginTop: '14px' } }, A.chartCard({
      title: 'Conversations started each week', sub: 'From the anonymous comments tab.',
      draw: w => A.columns(weeklyC.map(x => ({ label: A.fmtDate(x.t, false), v: x.v, tipTitle: 'Week of ' + A.fmtDate(x.t) })), w, { unit: 'conversations', xName: 'Week starting', valueName: 'Conversations', aria: 'Conversations per week' }),
    })));
    root.appendChild(sec5);
    return root;
  };

  /* ---------------- Search across everything ---------------- */
  function snippet(text, terms, len) {
    len = len || 180;
    const low = text.toLowerCase();
    let at = -1;
    for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    if (at < 0 || text.length <= len) return text.length > len ? text.slice(0, len - 1) + '…' : text;
    const start = Math.max(0, at - 50);
    return (start > 0 ? '…' : '') + text.slice(start, start + len) + (start + len < text.length ? '…' : '');
  }
  A.views.search = function (params) {
    const D = A.db, q = (params.q || '').trim();
    const terms = A.norm(q).split(/\s+/).filter(Boolean);
    const re = A.termsRe(terms);
    const root = h('div', null, A.pageHead(q ? 'Results for “' + q + '”' : 'Search', q ? null : 'Type in the search box at the top to look across postings, applications, conversations, culture notes and locations.'));
    if (!terms.length) return root;
    const sections = [
      { title: 'Job postings', view: 'postings', items: D.postings, mini: p => h('div', { class: 'mini' }, h('div', { class: 't' }, p.url ? A.link(p.url, p.university, 'ext') : A.rich(p.university, re)), h('time', null, A.fmtDate(p.dateMs, false)), h('div', { class: 's' }, A.rich([p.department, p.location, p.discipline].filter(Boolean).join(', '), re))) },
      { title: 'Applications', view: 'applications', items: D.apps, mini: a => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(a.institution, re)), h('time', null, A.fmtDate(a.addedMs, false)), h('div', { class: 's' }, A.badge(a.kind, A.RESP_COLOR[a.kind] || 'var(--axis)')), a.noteList.length ? h('div', { class: 'q' }, A.rich(snippet(a.noteList.join(' '), terms), re)) : null) },
      { title: 'No-response reports', view: 'noresponse', items: D.noresp, mini: r => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(r.institution, re)), h('time', null, A.fmtDate(r.dateMs, false)), h('div', { class: 's' }, A.rich([r.department, r.location].filter(Boolean).join(', '), re))) },
      { title: 'Conversations', view: 'community', items: D.comments, mini: c => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(snippet(c.messages.join(' – '), terms, 200), re)), h('time', null, c.dateMs ? A.fmtDate(c.dateMs, false) : '')) },
      { title: 'Institutional culture', view: 'culture', items: D.culture, mini: c => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(c.institution, re)), h('time', null, ''), h('div', { class: 'q' }, A.rich(snippet([c.question].concat(c.notes).join(' '), terms), re))) },
      { title: 'Locations', view: 'locations', items: D.locs, mini: l => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(l.city, re)), h('time', null, ''), h('div', { class: 'q' }, A.rich(snippet([l.question, l.pros, l.cons].concat(l.notes).join(' '), terms), re))) },
      { title: 'Negotiated packages', view: 'negotiations', items: D.nego, mini: n => h('div', { class: 'mini' }, h('div', { class: 't' }, A.rich(n.label, re)), h('time', null, n.dateMs ? A.fmtDate(n.dateMs, false) : ''), h('div', { class: 's' }, A.rich(n.notes.join(' ').slice(0, 160), re))) },
    ];
    let total = 0;
    const out = h('div', { class: 'grid', style: { gap: '16px' } });
    sections.forEach(sec => {
      const hits = sec.items.filter(it => terms.every(t => it.text.indexOf(t) >= 0));
      if (!hits.length) return;
      total += hits.length;
      const ordered = hits.slice().sort((a, b) => (b.dateMs || b.addedMs || 0) - (a.dateMs || a.addedMs || 0) || b.row - a.row);
      out.appendChild(h('section', { class: 'panel' },
        h('header', null, h('h3', null, sec.title + ' (' + A.n(hits.length) + ')'), h('button', { class: 'linkbtn', type: 'button', onClick: () => A.go(sec.view, { q }) }, 'Show all in ' + sec.title.toLowerCase())),
        ordered.slice(0, 5).map(sec.mini)));
    });
    if (!total) out.appendChild(A.emptyState('No matches for “' + q + '”', 'Try a shorter word, or part of an institution name.'));
    root.appendChild(out);
    return root;
  };
})();
