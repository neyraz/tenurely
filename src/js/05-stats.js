/* ============================================================
   Statistics: plain calculations on the normalised records.
   No DOM in here, so every number can be tested on its own.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});

  const inWin = (t, win) => t !== null && t !== undefined && (!win || (t >= win.lo && t <= win.hi));

  /* Weekly counts (weeks start Monday), with empty weeks filled in. */
  A.weekly = function (times, win) {
    const t = times.filter(x => inWin(x, win));
    if (!t.length) return [];
    const c = A.count(t, x => A.weekStart(x));
    const first = Math.min(...c.keys());
    const last = Math.max(...c.keys(), A.weekStart(A.today()));
    const out = [];
    for (let w = first; w <= last; w += 7 * A.DAY) out.push({ t: w, v: c.get(w) || 0 });
    return out;
  };
  A.monthly = function (times, win) {
    const t = times.filter(x => inWin(x, win));
    if (!t.length) return [];
    const c = A.count(t, x => A.monthStart(x));
    const first = Math.min(...c.keys()), last = Math.max(...c.keys());
    const out = [];
    for (let d = new Date(first); d.getTime() <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) out.push({ t: d.getTime(), v: c.get(d.getTime()) || 0 });
    return out;
  };
  /* Running total by day: [{t, v}] */
  A.cumulative = function (times, win) {
    const t = times.filter(x => inWin(x, win)).sort((a, b) => a - b);
    if (!t.length) return [];
    const out = []; let n = 0;
    for (let i = 0; i < t.length; i++) {
      n++;
      if (i === t.length - 1 || t[i + 1] !== t[i]) out.push({ t: t[i], v: n });
    }
    return out;
  };

  A.RESP_ORDER = ['Remote interview', 'Onsite interview', 'Offer', 'Reference letters requested', 'Rejection', 'Other'];

  A.responseMix = function (apps) {
    const c = A.count(apps, a => a.kind);
    return A.RESP_ORDER.map(k => ({ kind: k, n: c.get(k) || 0 }));
  };

  A.responsesByMonth = function (apps, win) {
    const rows = apps.filter(a => a.kind !== 'No response logged').map(a => ({ t: a.respondedMs !== null && inWin(a.respondedMs, win) ? a.respondedMs : a.addedMs, kind: a.kind })).filter(r => inWin(r.t, win));
    if (!rows.length) return { months: [], byKind: {} };
    const first = A.monthStart(Math.min(...rows.map(r => r.t))), last = A.monthStart(Math.max(...rows.map(r => r.t)));
    const months = [];
    for (let d = new Date(first); d.getTime() <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(d.getTime());
    const byKind = {};
    A.RESP_ORDER.forEach(k => { byKind[k] = months.map(() => 0); });
    rows.forEach(r => { const i = months.indexOf(A.monthStart(r.t)); if (i >= 0 && byKind[r.kind]) byKind[r.kind][i]++; });
    return { months, byKind };
  };

  /* Institutions that sent the most interview invitations (remote or onsite). */
  A.topInterviewers = function (apps, n) {
    const m = new Map();
    apps.forEach(a => {
      if (a.kind !== 'Remote interview' && a.kind !== 'Onsite interview') return;
      const key = A.norm(a.institution).replace(/^the /, '');
      const cur = m.get(key) || { name: a.institution, n: 0 };
      cur.n++; m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, n);
  };

  A.keywordMatcher = function (keywords) {
    const k = (keywords || []).map(x => A.norm(x)).filter(x => x.length > 1);
    return item => k.length > 0 && k.some(w => item.text.indexOf(w) >= 0) && !(A.isExcluded && A.isExcluded(item));
  };

  A.kpis = function (db, prevVisitMs, keywords) {
    const today = A.today();
    const match = A.keywordMatcher(keywords);
    const isRecent = p => p.dateMs !== null && p.dateMs >= today - 7 * A.DAY && p.dateMs <= today + 2 * A.DAY;
    // "New" means the row was not in the sheet when you last left (see A.seen), not a date guess.
    const isNew = p => A.seen.isNew(p, 'post');
    const P = db.postings;
    const kinds = A.count(db.apps, a => a.kind);
    return {
      postings: P.length,
      postingsWeek: P.filter(isRecent).length,
      postingsNew: A.seen.ready ? P.filter(isNew).length : null,
      matching: P.filter(match).length,
      matchingWeek: P.filter(p => match(p) && isRecent(p)).length,
      apps: db.apps.length,
      interviews: (kinds.get('Remote interview') || 0) + (kinds.get('Onsite interview') || 0),
      remote: kinds.get('Remote interview') || 0,
      onsite: kinds.get('Onsite interview') || 0,
      offers: (kinds.get('Offer') || 0),
      acceptedOffers: db.offers.filter(o => /accept/i.test(o.status)).length,
      threads: db.comments.length,
      threadsWeek: db.comments.filter(c => c.dateMs !== null && c.dateMs >= today - 7 * A.DAY && c.dateMs <= today + 2 * A.DAY).length,
      isRecent, isNew, match,
    };
  };

  /* Self-reported applicant numbers from the stats tab. */
  A.benchmarks = function (stats) {
    const S = stats.filter(s => !s.example);
    const n = S.length;
    const share = f => (n ? S.filter(f).length / n : null);
    const bins = [[1, 10, '1–10'], [11, 25, '11–25'], [26, 50, '26–50'], [51, 75, '51–75'], [76, 99, '76–99'], [100, 1e9, '100 or more']];
    const hist = bins.map(([lo, hi, label]) => ({ label, v: S.filter(s => s.appsNum >= lo && s.appsNum <= hi).length }));
    const cycles = ['1st cycle', '2nd cycle', '3rd cycle or later'].map(c => {
      const g = S.filter(s => s.cycle === c);
      return { cycle: c, n: g.length, medApps: A.median(g.map(s => s.appsNum)), interview: g.length ? g.filter(s => s.interviews > 0).length / g.length : null, offer: g.length ? g.filter(s => s.offerNum > 0).length / g.length : null };
    });
    const types = A.count(S.flatMap(s => s.instTypes), t => t);
    return {
      n, ongoing: S.filter(s => s.ongoing).length,
      medApps: A.median(S.map(s => s.appsNum)),
      medInterviews: A.median(S.map(s => s.interviews)),
      withInterview: share(s => s.interviews > 0), withOnsite: share(s => s.onsiteNum > 0), withOffer: share(s => s.offerNum > 0), withReply: share(s => s.heardNum > 0),
      hist, cycles, types: [...types.entries()].sort((a, b) => b[1] - a[1]),
      points: S.map((s, i) => ({ x: s.appsNum, y: s.interviews, label: (s.discipline || 'Respondent ' + (i + 1)), sub: s.cycle + (s.instType ? ', ' + s.instType : '') })),
    };
  };

  /* Money rows for the dumbbell charts. */
  A.moneyRows = function (nego, offKey, grantKey) {
    return nego.filter(n => (n[offKey] !== null || n[grantKey] !== null) && (n[offKey] || n[grantKey])).map(n => ({
      label: n.label + (n.dateMs ? ' (' + A.MON[new Date(n.dateMs).getUTCMonth()] + ' ' + new Date(n.dateMs).getUTCFullYear() + ')' : ''),
      a: n[offKey], b: n[grantKey],
    }));
  };

  /* Day counts used in lists. */
  A.daysSince = t => (t === null || t === undefined ? null : Math.floor((A.today() - t) / A.DAY));
})();
