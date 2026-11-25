/* ============================================================
   Faculty Market Atlas - utilities
   Everything lives on one namespace, A. No external libraries.
   All sheet content is untrusted (anonymous editors), so the UI
   is built with DOM nodes and textContent, never innerHTML.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});

  /* ---------- DOM helpers ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function applyAttrs(el, attrs) {
    if (!attrs) return;
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  function append(el, kids) {
    for (const k of kids) {
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  A.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    applyAttrs(el, attrs);
    append(el, kids);
    return el;
  };
  A.s = function (tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    applyAttrs(el, attrs);
    append(el, kids);
    return el;
  };
  A.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- Safe links and rich text ---------- */
  A.safeUrl = function (u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^mailto:/i.test(u)) return u;
    if (/^www\./i.test(u)) return 'https://' + u;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S+/i.test(u)) return 'https://' + u; // apply.interfolio.com/123
    return '';
  };
  A.host = function (u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  };
  A.shortUrl = function (u, max) {
    max = max || 46;
    let s = String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };
  A.link = function (url, label, cls) {
    const href = A.safeUrl(url);
    if (!href) return A.h('span', { class: cls }, label || url);
    return A.h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: cls || 'ext' }, label || A.shortUrl(href));
  };
  const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  A.termsRe = function (terms) {
    terms = (terms || []).filter(t => t && t.length > 1);
    if (!terms.length) return null;
    return new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi');
  };
  function hlText(text, re) {
    if (!re) return [document.createTextNode(text)];
    const out = []; let last = 0; let m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
      out.push(A.h('mark', null, m[0]));
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) out.push(document.createTextNode(text.slice(last)));
    return out;
  }
  /* Turns plain text into a fragment: URLs become links, search terms are marked. */
  A.rich = function (text, termsRe) {
    const frag = document.createDocumentFragment();
    text = String(text == null ? '' : text);
    let last = 0; let m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text))) {
      let url = m[0];
      const trail = url.match(/[.,;:!?)\]}'"]+$/);
      if (trail) url = url.slice(0, -trail[0].length);
      if (m.index > last) hlText(text.slice(last, m.index), termsRe).forEach(n => frag.appendChild(n));
      frag.appendChild(A.link(url, A.shortUrl(url, 56)));
      last = m.index + url.length;
      URL_RE.lastIndex = last;
    }
    if (last < text.length) hlText(text.slice(last), termsRe).forEach(n => frag.appendChild(n));
    return frag;
  };

  /* ---------- Strings and numbers ---------- */
  A.clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  A.norm = s => A.clean(s).toLowerCase();
  A.n = x => (x === null || x === undefined || isNaN(x)) ? '–' : Number(x).toLocaleString('en-US');
  A.pct = (x, d) => (x === null || x === undefined || isNaN(x)) ? '–' : (x * 100).toFixed(d === undefined ? 0 : d) + '%';
  A.plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  A.sum = a => a.reduce((x, y) => x + y, 0);
  A.quantile = function (arr, q) {
    const a = arr.filter(x => typeof x === 'number' && !isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return a[lo] + (a[hi] - a[lo]) * (p - lo);
  };
  A.median = arr => A.quantile(arr, 0.5);
  A.count = function (items, keyFn) {
    const m = new Map();
    for (const it of items) {
      const k = keyFn(it);
      if (k === null || k === undefined || k === '') continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  A.top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n);
  A.compact = function (v) {
    if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (v >= 1e4) return Math.round(v / 1e3) + 'K';
    return Number(v).toLocaleString('en-US');
  };
  A.money = function (v) {
    if (v === null || v === undefined) return '–';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return '$' + v;
  };
  /* "$135K", "136.5k", "1.7M", "1 M excluding salary", "13.65k + 13.65k bonus" -> first amount */
  A.parseMoney = function (s) {
    s = String(s || '').replace(/,/g, '');
    const m = s.match(/(\d+(?:\.\d+)?)\s*(million|thousand|k|m)?(?![a-z])/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = (m[2] || '').toLowerCase();
    if (u === 'k' || u === 'thousand') return n * 1e3;
    if (u === 'm' || u === 'million') return n * 1e6;
    return n >= 1000 ? n : null;
  };
  A.firstNumber = function (s) {
    const m = String(s || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  /* ---------- Dates (UTC milliseconds, or null) ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  A.MON = MON;
  function mk(y, mo, d) {
    if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    const t = Date.UTC(y, mo - 1, d);
    return new Date(t).getUTCMonth() === mo - 1 ? t : null;
  }
  A.parseDate = function (s) {
    s = A.clean(s);
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/))) return mk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?!\d)/))) {
      let a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (a > 12 && b <= 12) return mk(y, b, a);   // day first
      return mk(y, a, b);                          // month first (US)
    }
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})$/))) return mk(+m[1], +m[2], 1);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{4})$/))) return mk(+m[2], +m[1], 1);
    if (/[a-z]{3}/i.test(s) && /\d{4}/.test(s)) {
      const t = Date.parse(s + (/utc|gmt|z$/i.test(s) ? '' : ' UTC'));
      if (!isNaN(t)) { const d = new Date(t); return mk(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
    }
    return null;
  };
  A.DAY = 86400000;
  A.today = function () { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  A.fmtDate = function (t, withYear) {
    if (t === null || t === undefined) return '';
    const d = new Date(t);
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (withYear === false ? '' : ' ' + d.getUTCFullYear());
  };
  A.fmtMonth = t => { const d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  A.weekStart = function (t) { const d = new Date(t); const dow = (d.getUTCDay() + 6) % 7; return t - dow * A.DAY; };
  A.monthStart = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  A.ago = function (ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  };
  A.stamp = function (ts) {
    const d = new Date(ts);
    return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  /* A plausible window for time series: ignore stray old or future typos. */
  A.window = function (times) {
    const t = times.filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
    if (!t.length) return null;
    const lo = t[Math.min(t.length - 1, Math.floor(t.length * 0.02))] - 60 * A.DAY;
    const hi = A.today() + 2 * A.DAY;
    return { lo, hi };
  };

  /* ---------- US states ---------- */
  A.STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
  const NAME2ABBR = {};
  for (const k of Object.keys(A.STATES)) NAME2ABBR[A.STATES[k].toLowerCase()] = k;
  A.stateOf = function (loc) {
    loc = A.clean(loc);
    if (!loc) return null;
    let m = loc.match(/,\s*([A-Za-z.]{2,}(?:\s[A-Za-z]+)*)\s*(?:\d{5}(?:-\d{4})?)?\s*$/);
    if (m) {
      const t = m[1].replace(/\./g, '').trim();
      if (/^[A-Za-z]{2}$/.test(t) && A.STATES[t.toUpperCase()]) return t.toUpperCase();
      if (NAME2ABBR[t.toLowerCase()]) return NAME2ABBR[t.toLowerCase()];
    }
    m = loc.match(/\b([A-Z]{2})\b\s*(?:\d{5})?\s*$/);
    if (m && A.STATES[m[1]]) return m[1];
    if (/washington,?\s*d\.?c/i.test(loc)) return 'DC';
    return null;
  };

  /* ---------- Fields and ranks (free text -> buckets) ---------- */
  const FIELD_RULES = [
    ['Microbiology & immunology', /micro(bio)?|immun|infect|pathogen|virolog|bacteri|parasit|host.?microbe|epidemi/i],
    ['Neuroscience', /neuro|brain|cognit/i],
    ['Cancer biology', /cancer|oncolog|tumor/i],
    ['Genetics, genomics & computation', /genom|genetic|bioinformat|comput|data science|machine learning|quantitative|systems bio|biostat|statistic/i],
    ['Biochemistry & molecular biology', /biochem|molecular|structur|chemical bio|protein|biophys/i],
    ['Cell & developmental biology', /\bcell\b|cellular|develop|stem|regenerat/i],
    ['Physiology & pharmacology', /physiolog|pharmac|toxic|endocrin|metabol|cardio|nutrition|kinesiol|exercise|anatomy/i],
    ['Ecology, evolution & environment', /ecolog|evolution|marine|environment|plant|botan|zoolog|conservation|fisher|wildlife|ocean|geolog|earth|agricult/i],
    ['Chemistry', /chem/i],
    ['Engineering', /engineer|biomaterial|biomedical|bioengineer|device|imaging/i],
    ['Physics & mathematics', /physic|math/i],
    ['Psychology & behavior', /psych|behavio|social|educat/i],
    ['General biology', /biolog|life science|biomedical sci|natural sci|science/i],
  ];
  A.fieldBucket = function (s) {
    s = A.clean(s);
    if (!s) return 'Not stated';
    for (const [name, re] of FIELD_RULES) if (re.test(s)) return name;
    return 'Other';
  };
  A.rankBucket = function (s) {
    s = A.norm(s);
    if (!s) return 'Not stated';
    if (/lectur|instructor|teaching|clinical|research (professor|track|scientist)|staff/.test(s)) return 'Lecturer / non-tenure-track';
    if (/assistant.*(or|\/|,).*associate|assistant.*associate/.test(s)) return 'Assistant or associate';
    if (/open/.test(s)) return 'Open rank';
    if (/assistant|tenure.track|\btt\b|ttap/.test(s)) return 'Assistant professor';
    if (/associate|full professor|chair|director/.test(s)) return 'Associate / full / chair';
    return 'Other';
  };
  A.responseKind = function (s) {
    s = A.norm(s);
    if (!s) return 'No response logged';
    if (/verbal/.test(s)) return 'Offer';
    if (/offer/.test(s)) return 'Offer';
    if (/reject|declin|not selected|unsuccess/.test(s)) return 'Rejection';
    if (/reference|letter/.test(s)) return 'Reference letters requested';
    if (/remote|zoom|phone|virtual|video|screen/.test(s)) return 'Remote interview';
    if (/onsite|on-site|visit|campus|offsite|in.person|2nd|second/.test(s)) return 'Onsite interview';
    return 'Other';
  };

  /* ---------- Small utilities ---------- */
  A.debounce = function (fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; };
  A.store = {
    get(k, d) { try { const v = localStorage.getItem('fma.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fma.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem('fma.' + k); } catch (e) { /* ignore */ } },
  };
  /* Tiny key-value store on IndexedDB for the cached workbook. */
  A.idb = (function () {
    let dbp;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          const rq = indexedDB.open('fma-atlas', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
          rq.onsuccess = () => res(rq.result);
          rq.onerror = () => rej(rq.error);
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(db => new Promise((res, rej) => {
        const t = db.transaction('kv', mode); const r = fn(t.objectStore('kv'));
        t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      }));
    }
    return {
      get: k => tx('readonly', s => s.get(k)).catch(() => undefined),
      set: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => undefined),
      del: k => tx('readwrite', s => s.delete(k)).catch(() => undefined),
    };
  })();
})();
