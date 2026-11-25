/* ============================================================
   Minimal .xlsx reader (zip + XML), dependency free.
   Returns every tab as a grid of strings plus hyperlink targets,
   which a CSV export would lose.
   ============================================================ */
(function () {
  const A = (globalThis.A = globalThis.A || {});
  const td = new TextDecoder('utf-8');

  async function inflateRaw(u8) {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function readZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This file is not a valid .xlsx workbook.');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const map = new Map();
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      map.set(td.decode(u8.subarray(p + 46, p + 46 + nl)), { method, csize, lho });
      p += 46 + nl + el + cl;
    }
    async function read(name) {
      const e = map.get(name);
      if (!e) return null;
      const nl = dv.getUint16(e.lho + 26, true), el = dv.getUint16(e.lho + 28, true);
      const start = e.lho + 30 + nl + el;
      const data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return data;
      if (e.method === 8) return inflateRaw(data);
      throw new Error('Unsupported zip compression method ' + e.method);
    }
    return { names: [...map.keys()], async text(name) { const d = await read(name); return d ? td.decode(d) : null; } };
  }

  /* ---------- XML helpers ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function unx(s) {
    if (s.indexOf('&') >= 0) {
      s = s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
        if (e[0] === '#') {
          const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          try { return String.fromCodePoint(cp); } catch (err) { return ''; }
        }
        return ENT[e.toLowerCase()];
      });
    }
    if (s.indexOf('_x') >= 0) s = s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => (h === '000D' ? '' : String.fromCharCode(parseInt(h, 16))));
    return s;
  }
  function attrs(s) {
    const o = {};
    s.replace(/([\w:.-]+)\s*=\s*"([^"]*)"/g, (m, k, v) => { o[k] = v; return m; });
    return o;
  }
  function colIdx(ref) {
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      if (c >= 65 && c <= 90) n = n * 26 + (c - 64); else break;
    }
    return n - 1;
  }
  function cellRef(ref) {
    const m = String(ref).match(/^([A-Z]+)(\d+)$/);
    return m ? { c: colIdx(m[1]), r: +m[2] - 1 } : null;
  }

  function parseShared(xml) {
    const out = [];
    const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
    let m;
    while ((m = re.exec(xml))) {
      let body = m[1] || '';
      if (body.indexOf('<rPh') >= 0) body = body.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      let s = '';
      const tr = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
      let t;
      while ((t = tr.exec(body))) s += t[1] || '';
      out.push(unx(s));
    }
    return out;
  }

  function isDateFmt(id, code) {
    if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
    if (!code) return false;
    const c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[ymd]/i.test(c);
  }
  function parseStyles(xml) {
    const fmts = {};
    (xml.match(/<numFmt\b[^>]*>/g) || []).forEach(t => { const a = attrs(t); fmts[a.numFmtId] = unx(a.formatCode || ''); });
    const blk = (xml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [''])[0];
    return (blk.match(/<xf\b[^>]*>/g) || []).map(t => { const id = +attrs(t).numFmtId || 0; return isDateFmt(id, fmts[id]); });
  }

  function parseRels(xml) {
    const o = {};
    (xml.match(/<Relationship\b[^>]*>/g) || []).forEach(t => { const a = attrs(t); if (a.Id) o[a.Id] = unx(a.Target || ''); });
    return o;
  }

  function parseSheet(xml, shared, dateStyle, rels) {
    const sparse = [];
    let maxCol = 0, lastRow = -1;
    const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm;
    while ((rm = rowRe.exec(xml))) {
      const body = rm[2];
      if (!body) continue;
      const ra = attrs(rm[1]);
      const ri = (+ra.r || sparse.length + 1) - 1;
      const row = [];
      const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm, any = false;
      while ((cm = cRe.exec(body))) {
        const inner = cm[2];
        if (!inner) continue;
        const ca = attrs(cm[1]);
        const ci = colIdx(ca.r || '');
        if (ci < 0) continue;
        let val = '';
        if (ca.t === 'inlineStr') {
          const tr = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
          while ((t = tr.exec(inner))) val += t[1];
          val = unx(val);
        } else {
          const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
          if (!vm) continue;
          const v = vm[1];
          if (ca.t === 's') val = shared[+v] || '';
          else if (ca.t === 'str') val = unx(v);
          else if (ca.t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
          else if (ca.t === 'e') val = '';
          else {
            const n = +v;
            if (isNaN(n)) val = v;
            else if (dateStyle[+ca.s] && n >= 36526 && n < 80000) val = new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10);
            else val = Number.isInteger(n) ? String(n) : String(+n.toPrecision(12));
          }
        }
        if (val === '') continue;
        row[ci] = val; any = true;
        if (ci > maxCol) maxCol = ci;
      }
      if (any) { sparse[ri] = row; if (ri > lastRow) lastRow = ri; }
    }
    const rows = [];
    for (let r = 0; r <= lastRow; r++) {
      const src = sparse[r]; const row = new Array(maxCol + 1);
      for (let c = 0; c <= maxCol; c++) row[c] = (src && src[c]) || '';
      rows.push(row);
    }
    const links = {};
    const hl = xml.match(/<hyperlinks>[\s\S]*?<\/hyperlinks>/);
    if (hl) {
      (hl[0].match(/<hyperlink\b[^>]*>/g) || []).forEach(tag => {
        const a = attrs(tag);
        const target = rels[a['r:id']];
        if (!target || !/^(https?:|mailto:)/i.test(target) || !a.ref) return;
        const ref = cellRef(a.ref.split(':')[0]);
        if (ref) links[ref.r + ',' + ref.c] = target;
      });
    }
    return { rows, links };
  }

  /* Parse a whole workbook. onProgress(done, total, name) is optional. */
  A.parseXlsx = async function (buf, onProgress) {
    const zip = readZip(buf);
    const wbXml = await zip.text('xl/workbook.xml');
    if (!wbXml) throw new Error('This file does not look like an Excel workbook.');
    const wbRels = parseRels(await zip.text('xl/_rels/workbook.xml.rels') || '');
    const shared = parseShared(await zip.text('xl/sharedStrings.xml') || '');
    const dateStyle = parseStyles(await zip.text('xl/styles.xml') || '');
    const sheetTags = wbXml.match(/<sheet\b[^>]*>/g) || [];
    const sheets = [];
    let done = 0;
    for (const tag of sheetTags) {
      const a = attrs(tag);
      let target = wbRels[a['r:id']] || '';
      target = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target;
      const xml = await zip.text(target);
      const name = unx(a.name || '');
      if (xml) {
        const relName = target.replace(/([^/]+)$/, '_rels/$1.rels');
        const rels = parseRels(await zip.text(relName) || '');
        const { rows, links } = parseSheet(xml, shared, dateStyle, rels);
        sheets.push({ name, rows, links });
      }
      done++;
      if (onProgress) onProgress(done, sheetTags.length, name);
      await new Promise(r => setTimeout(r, 0)); // let the UI breathe between tabs
    }
    return { sheets };
  };

  /* Snapshot: parsed workbook as gzip+base64 (built into the file so the app opens offline). */
  A.unpackSnapshot = async function (b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  };
})();
