/* ============================================================
   Data layer: tab grids -> clean records.
   Columns are found by header wording, not position, so the
   app keeps working when editors add or move columns.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});

  function sheetsByNumber(sheets) {
    const m = {};
    for (const s of sheets) {
      const mm = s.name.match(/^\s*\((\d+)\)/);
      if (mm) m[+mm[1]] = s;
      else if (/welcome/i.test(s.name)) m[0] = s;
    }
    return m;
  }

  /* Find the header row, map named fields to columns, return one record per data row. */
  function mapTable(sheet, spec, warnings) {
    const rows = sheet.rows;
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const joined = rows[i].map(A.norm).join(' | ').replace(/\s+/g, ' ');
      if (spec.header.every(re => re.test(joined))) { hi = i; break; }
    }
    if (hi < 0) {
      warnings.push('Could not find the header row in "' + sheet.name.trim() + '". That tab was skipped.');
      return { records: [], cols: {} };
    }
    const head = rows[hi].map(c => A.norm(c).replace(/\s+/g, ' '));
    const cols = {}, used = new Set();
    for (const [key, re] of spec.fields) {
      const idx = head.findIndex((h, i) => !used.has(i) && re.test(h));
      if (idx >= 0) { cols[key] = idx; used.add(idx); }
    }
    for (const key of Object.keys(spec.fallback || {})) {
      const idx = spec.fallback[key];
      if (cols[key] === undefined && !used.has(idx)) { cols[key] = idx; used.add(idx); }
    }
    const multi = [];
    if (spec.multi) head.forEach((h, i) => { if (!used.has(i) && spec.multi.test(h)) multi.push(i); });
    if (spec.multiAfter && cols[spec.multiAfter] !== undefined) {
      for (let i = cols[spec.multiAfter] + 1; i < head.length; i++) if (!used.has(i) && !multi.includes(i)) multi.push(i);
    }
    const records = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r];
      const rec = { id: spec.id + ':' + r, row: r, cellLinks: {} };
      let any = false;
      for (const key of Object.keys(cols)) {
        rec[key] = A.clean(row[cols[key]]);
        if (rec[key]) any = true;
        const l = sheet.links[r + ',' + cols[key]];
        if (l) rec.cellLinks[key] = l;
      }
      rec.notes = [];
      for (const i of multi) {
        const v = A.clean(row[i]);
        if (v) { rec.notes.push(v); any = true; }
        const l = sheet.links[r + ',' + i];
        if (l) rec.cellLinks['note' + i] = l;
      }
      if (any) records.push(rec);
    }
    return { records, cols, headRow: hi };
  }

  function textOf(parts) { return parts.filter(Boolean).join(' • ').toLowerCase(); }
  function linkOf(rec, key) { return A.safeUrl(rec.cellLinks[key]) || A.safeUrl(rec[key]) || ''; }

  /* Prefer the specific field; fall back to the department when the discipline is generic. */
  function fieldFor(discipline, department) {
    const f = A.fieldBucket(discipline);
    if (f === 'General biology' || f === 'Other' || f === 'Not stated') {
      const g = A.fieldBucket(department);
      if (g !== 'General biology' && g !== 'Other' && g !== 'Not stated') return g;
    }
    return f;
  }

  /* ---------- Per-tab normalisers ---------- */
  function postings(sheet, w) {
    const t = mapTable(sheet, {
      id: 'post', header: [/date added/, /universit|institution/],
      fields: [['date', /^date/], ['category', /categor/], ['university', /universit|institution/], ['department', /depart/], ['location', /locat/], ['discipline', /disciplin|special/], ['rank', /^rank|position/], ['link', /link|url/]],
      multiAfter: 'link',
    }, w);
    return t.records.map(r => {
      r.dateMs = A.parseDate(r.date);
      r.url = linkOf(r, 'link');
      r.state = A.stateOf(r.location);
      r.field = fieldFor(r.discipline, r.department);
      r.rankKind = A.rankBucket(r.rank);
      r.categoryLabel = r.category || 'Not labelled';
      r.text = textOf([r.university, r.department, r.location, r.discipline, r.rank, r.category, r.notes.join(' ')]);
      return r;
    }).filter(r => r.university || r.url);
  }

  function applications(sheet, w) {
    const t = mapTable(sheet, {
      id: 'app', header: [/institution/, /response/],
      fields: [['responseDate', /response date/], ['response', /^response/], ['institution', /institution/], ['due', /^due/], ['submitted', /submitted/], ['position', /position/], ['specialty', /special/], ['department', /depart/], ['location', /locat/], ['note1', /part 1/], ['note2', /part 2/], ['jobAd', /job ad|url|\bid\b/]],
      fallback: { date: 0 }, multiAfter: 'jobAd',
    }, w);
    return t.records.map(r => {
      r.example = /last cycle/i.test(r.date);
      r.addedMs = A.parseDate(r.date);
      r.submittedMs = A.parseDate(r.submitted);
      r.respondedMs = A.parseDate(r.responseDate);
      r.dueMs = A.parseDate(r.due);
      r.state = A.stateOf(r.location);
      r.kind = A.responseKind(r.response);
      r.rankKind = A.rankBucket(r.position);
      r.field = fieldFor(r.specialty, r.department);
      r.url = A.safeUrl(r.cellLinks.jobAd) || A.safeUrl(r.jobAd);
      r.noteList = [r.note1, r.note2].concat(r.notes).filter(Boolean);
      if (r.submittedMs && r.respondedMs) {
        const d = Math.round((r.respondedMs - r.submittedMs) / A.DAY);
        r.daysToResponse = d >= 0 && d <= 400 ? d : null;
      } else r.daysToResponse = null;
      r.text = textOf([r.institution, r.department, r.specialty, r.location, r.position, r.response, r.noteList.join(' ')]);
      return r;
    }).filter(r => r.institution && !r.example);
  }

  function applicantStats(sheet, w) {
    const t = mapTable(sheet, {
      id: 'stat', header: [/number of applications/],
      fields: [['apps', /number of applications/], ['heard', /heard/], ['remote', /remote/], ['onsiteV', /virtual/], ['onsiteP', /in-person|campus/], ['unoff', /unofficial/], ['offRej', /official rejection/], ['offers', /^offers/], ['year', /year applying/], ['instType', /type of institution/], ['fellowship', /k99|fellowship|career development/], ['pubs', /cns|publication/], ['firstGen', /first generation|underrepresented/], ['discipline', /^discipline/], ['updated', /last updated/]],
    }, w);
    const out = [];
    for (const r of t.records) {
      const prev = sheet.rows[r.row - 1] || [];
      const isExample = /example/i.test(prev[0] || '') || /example/i.test(r.apps);
      const n = A.firstNumber(r.apps);
      if (n === null || n <= 0) continue;
      r.example = isExample;
      r.appsNum = n;
      r.ongoing = /ongoing|\+|~|\bso far\b/i.test(r.apps);
      r.heardNum = A.firstNumber(r.heard) || 0;
      r.remoteNum = A.firstNumber(r.remote) || 0;
      r.onsiteVNum = A.firstNumber(r.onsiteV) || 0;
      r.onsitePNum = A.firstNumber(r.onsiteP) || 0;
      r.interviews = r.remoteNum + r.onsiteVNum + r.onsitePNum;
      r.onsiteNum = r.onsiteVNum + r.onsitePNum;
      r.offerNum = A.firstNumber(r.offers) || 0;
      r.offRejNum = A.firstNumber(r.offRej) || 0;
      r.unoffNum = A.firstNumber(r.unoff) || 0;
      const y = A.firstNumber(r.year);
      r.cycle = y === null ? 'Not stated' : (y < 1.5 ? '1st cycle' : (y < 2.5 ? '2nd cycle' : '3rd cycle or later'));
      r.instTypes = [];
      if (/\br1\b/i.test(r.instType)) r.instTypes.push('R1');
      if (/\br2\b/i.test(r.instType)) r.instTypes.push('R2');
      if (/pui|slac|liberal|undergrad/i.test(r.instType)) r.instTypes.push('PUI / SLAC');
      if (/europe|asia|international|uk|canada/i.test(r.instType)) r.instTypes.push('International');
      r.field = fieldFor(r.discipline, '');
      r.text = textOf([r.discipline, r.instType, r.year, r.fellowship, r.pubs]);
      out.push(r);
    }
    return out;
  }

  function negotiations(sheet, w) {
    const t = mapTable(sheet, {
      id: 'neg', header: [/salary/, /startup/],
      fields: [['salaryOffered', /salary.*initial/], ['salaryAsked', /salary.*request/], ['salaryGranted', /salary.*grant/], ['salaryType', /salary type/], ['appointment', /appointment/], ['cost', /cost of living/], ['relocation', /relocation/], ['startupOffered', /startup.*initial/], ['startupAsked', /startup.*request/], ['startupGranted', /startup.*grant/], ['teaching', /teaching/], ['labType', /setting up|experimental|computational/], ['pubpriv', /public/], ['region', /region/], ['field', /field|discipline/], ['gender', /gender/], ['prior', /prior/], ['type', /^type/], ['date', /^date/]],
      multi: /note|comment/,
    }, w);
    return t.records.map(r => {
      r.dateMs = A.parseDate(r.date);
      r.salaryOfferedNum = A.parseMoney(r.salaryOffered);
      r.salaryAskedNum = A.parseMoney(r.salaryAsked);
      r.salaryGrantedNum = A.parseMoney(r.salaryGranted);
      r.startupOfferedNum = A.parseMoney(r.startupOffered);
      r.startupAskedNum = A.parseMoney(r.startupAsked);
      r.startupGrantedNum = A.parseMoney(r.startupGranted);
      r.label = [r.type, r.field].filter(x => x && !/^\[/.test(x)).join(' – ') || 'Entry ' + (r.row);
      r.text = textOf([r.type, r.field, r.region, r.prior, r.salaryType, r.notes.join(' '), r.labType]);
      return r;
    });
  }

  function offers(sheet, w) {
    const t = mapTable(sheet, {
      id: 'offer', header: [/institution/, /accepted|declined/],
      fields: [['institution', /institution/], ['department', /depart/], ['position', /position/], ['location', /locat/], ['source', /source/], ['status', /accepted|declined/]],
      fallback: { date: 0 }, multi: /comment/,
    }, w);
    return t.records.map(r => {
      r.dateMs = A.parseDate(r.date);
      r.lastCycle = /last/i.test(r.date);
      r.url = A.safeUrl(r.cellLinks.source) || A.safeUrl(r.source);
      r.state = A.stateOf(r.location);
      r.text = textOf([r.institution, r.department, r.location, r.status, r.notes.join(' ')]);
      return r;
    }).filter(r => r.institution);
  }

  function noResponse(sheet, w) {
    const t = mapTable(sheet, {
      id: 'nores', header: [/institution/, /deadline/],
      fields: [['date', /^date/], ['institution', /institution/], ['deadline', /deadline/], ['department', /depart/], ['rank', /^rank/], ['location', /locat/], ['jobAd', /job ad|url/]],
      multi: /note|comment/,
    }, w);
    return t.records.map(r => {
      r.dateMs = A.parseDate(r.date);
      r.deadlineMs = A.parseDate(r.deadline);
      r.state = A.stateOf(r.location);
      r.url = A.safeUrl(r.cellLinks.jobAd) || A.safeUrl(r.jobAd);
      r.text = textOf([r.institution, r.department, r.location, r.rank, r.notes.join(' ')]);
      return r;
    }).filter(r => r.institution);
  }

  function culture(sheet, w) {
    const t = mapTable(sheet, {
      id: 'cult', header: [/institution/, /question/],
      fields: [['date', /date/], ['institution', /institution/], ['department', /depart/], ['question', /^question/]],
      multi: /^response|answer|comment/,
    }, w);
    return t.records.map(r => {
      r.dateMs = A.parseDate(r.date);
      r.text = textOf([r.institution, r.department, r.question, r.notes.join(' ')]);
      return r;
    }).filter(r => r.institution || r.question);
  }

  function locations(sheet, w) {
    const t = mapTable(sheet, {
      id: 'loc', header: [/city/, /pros/],
      fields: [['city', /city|area/], ['question', /question/], ['pros', /pros/], ['cons', /cons/]],
      multi: /answer|note/,
    }, w);
    return t.records.map(r => {
      r.state = A.stateOf(r.city);
      r.answered = !!(r.pros || r.cons || r.notes.length);
      r.text = textOf([r.city, r.question, r.pros, r.cons, r.notes.join(' ')]);
      return r;
    }).filter(r => r.city);
  }

  function failed(sheet, w) {
    const t = mapTable(sheet, {
      id: 'fail', header: [/institution/, /status/],
      fields: [['links', /link/], ['info', /misc|search info/], ['confirmed', /confirm/], ['source', /source/], ['status', /^status/], ['department', /depart/], ['institution', /institution/], ['date', /date/]],
    }, w);
    return t.records.map(r => { r.dateMs = A.parseDate(r.date); r.text = textOf([r.institution, r.department, r.status, r.info]); return r; }).filter(r => r.institution);
  }
  function frozen(sheet, w) {
    const t = mapTable(sheet, {
      id: 'froz', header: [/institution/, /status/],
      fields: [['respDate', /response date/], ['date', /date/], ['institution', /institution/], ['department', /depart/], ['status', /^status/]],
      multi: /note/,
    }, w);
    return t.records.map(r => { r.dateMs = A.parseDate(r.date); r.text = textOf([r.institution, r.department, r.status, r.notes.join(' ')]); return r; }).filter(r => r.institution);
  }

  /* Threads: first column is the date, every other filled cell is a message (post, then replies). */
  function threads(sheet, key) {
    const out = [];
    sheet.rows.forEach((row, i) => {
      if (i === 0) return;
      const msgs = [];
      for (let c = 1; c < row.length; c++) { const v = A.clean(row[c]); if (v) msgs.push(v); }
      if (!msgs.length) return;
      const date = A.clean(row[0]);
      out.push({ id: key + ':' + i, row: i, date, dateMs: A.parseDate(date), messages: msgs, text: msgs.join(' ').toLowerCase() });
    });
    return out;
  }

  function glossary(sheet) {
    const head = sheet.rows[0] || [];
    const cols = [];
    for (let c = 0; c < head.length; c++) {
      const items = [];
      for (let r = 1; r < sheet.rows.length; r++) {
        const text = A.clean(sheet.rows[r][c]);
        const url = A.safeUrl(sheet.links[r + ',' + c]);
        if (text || url) items.push({ text, url });
      }
      if (A.clean(head[c]) || items.length) cols.push({ title: A.clean(head[c]), items });
    }
    return cols;
  }

  /* ---------- Build everything ---------- */
  A.buildDB = function (wb) {
    const warnings = [];
    const S = sheetsByNumber(wb.sheets);
    const need = n => { if (!S[n]) warnings.push('Tab (' + n + ') was not found in this workbook.'); return S[n]; };
    const db = { warnings, tabs: wb.sheets.map(s => s.name.trim()) };
    db.postings = S[8] ? postings(S[8], warnings) : (need(8), []);
    db.apps = S[3] ? applications(S[3], warnings) : (need(3), []);
    db.stats = S[4] ? applicantStats(S[4], warnings) : (need(4), []);
    db.nego = S[5] ? negotiations(S[5], warnings) : (need(5), []);
    db.noresp = S[6] ? noResponse(S[6], warnings) : (need(6), []);
    db.offers = S[7] ? offers(S[7], warnings) : (need(7), []);
    db.culture = S[9] ? culture(S[9], warnings) : (need(9), []);
    db.locs = S[10] ? locations(S[10], warnings) : (need(10), []);
    db.failed = S[11] ? failed(S[11], warnings) : [];
    db.frozen = S[12] ? frozen(S[12], warnings) : [];
    db.comments = S[2] ? threads(S[2], 'com') : (need(2), []);
    db.happy = S[13] ? threads(S[13], 'joy') : [];
    db.visa = S[14] ? threads(S[14], 'visa') : [];
    db.glossary = S[1] ? glossary(S[1]) : [];
    db.welcome = S[0] ? S[0].rows.map(r => A.clean(r[0])).filter(Boolean) : [];
    db.noRespHint = S[6] && S[6].rows[0] ? S[6].rows[0].map(A.clean).filter(Boolean)[0] || '' : '';
    // time window for charts: ignore stray old or future dates
    db.win = A.window(db.postings.map(p => p.dateMs).concat(db.apps.map(a => a.addedMs)));
    return db;
  };
})();
