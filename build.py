#!/usr/bin/env python3
"""Build Faculty Market Atlas from its source files.

  python3 build.py hosted
      Writes docs/index.html and docs/sw.js for GitHub Pages. No sheet data and no sheet link are included:
      each person connects their own sheet in their own browser.

  python3 build.py standalone --out Atlas.html [--snapshot snapshot.json --sheet-id ID --label "Name"]
      Writes one self-contained file you can open from disk. With --snapshot and --sheet-id it carries
      a copy of that sheet so it opens with data even offline.

Needs only Python 3. Run it from this folder.
"""
import argparse, base64, gzip, hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src' if (ROOT / 'src').exists() else ROOT
ORDER = ['01-util.js', '02-xlsx.js', '03-data.js', '04-charts.js', '05-stats.js', '06-ui.js',
         '07-views-a.js', '07-views-b.js', '08-app.js']

ICON = ("<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
        "%3Crect width='32' height='32' rx='7' fill='%230f4a96'/%3E%3Crect x='6' y='6' width='8' height='8' rx='2' fill='%23cce3fd'/%3E"
        "%3Crect x='18' y='6' width='8' height='8' rx='2' fill='%236aabf1'/%3E%3Crect x='6' y='18' width='8' height='8' rx='2' fill='%236aabf1'/%3E"
        "%3Crect x='18' y='18' width='8' height='8' rx='2' fill='%23257de0'/%3E%3C/svg%3E\">")

THEME_BOOT = ('<script>try{var t=JSON.parse(localStorage.getItem("fma.theme"));'
              'if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>')

SW_REGISTER = ('if("serviceWorker"in navigator&&/^https?:$/.test(location.protocol)){'
               'addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}')


def read_sources():
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    js = '\n'.join((SRC / 'js' / f).read_text(encoding='utf-8') for f in ORDER)
    assert '</script' not in js.lower(), 'JS must not contain a closing script tag'
    return css, js


def page(css, js, head_extra='', config='', snapshot='', tail=''):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Faculty Market Atlas</title>
{ICON}
{head_extra}{THEME_BOOT}
<style>
{css}
</style>
</head>
<body>
<div id="app"></div>
<noscript>Faculty Market Atlas needs JavaScript to run.</noscript>
<script id="snapshot" type="text/plain">{snapshot}</script>
<script>
{config}{js}
A.boot();
{tail}</script>
</body>
</html>
'''


def build_hosted(outdir):
    css, js = read_sources()
    outdir.mkdir(parents=True, exist_ok=True)
    head = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<meta name="theme-color" content="#0f4a96">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n')
    html = page(css, js, head_extra=head, tail=SW_REGISTER + '\n')
    (outdir / 'index.html').write_text(html, encoding='utf-8')
    version = hashlib.sha256(html.encode('utf-8')).hexdigest()[:10]
    sw = (SRC / 'sw.template.js').read_text(encoding='utf-8').replace('__VERSION__', version)
    (outdir / 'sw.js').write_text(sw, encoding='utf-8')
    print(f'wrote {outdir / "index.html"}  {len(html) / 1024:.0f} KB   (cache version {version})')


def build_standalone(out, snapshot, sheet_id, label):
    css, js = read_sources()
    snap = ''
    if snapshot:
        snap = base64.b64encode(gzip.compress(pathlib.Path(snapshot).read_bytes(), 9)).decode('ascii')
    config = ''
    if sheet_id:
        config = 'globalThis.ATLAS_CONFIG=' + json.dumps({'sheetId': sheet_id, 'label': label or ''}) + ';\n'
    html = page(css, js, config=config, snapshot=snap)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print(f'wrote {out}  {len(html) / 1024:.0f} KB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['hosted', 'standalone'])
    ap.add_argument('--out', help='hosted: output folder (default docs). standalone: output file.')
    ap.add_argument('--snapshot'); ap.add_argument('--sheet-id'); ap.add_argument('--label')
    a = ap.parse_args()
    if a.mode == 'hosted':
        build_hosted(pathlib.Path(a.out) if a.out else ROOT / 'docs')
    else:
        build_standalone(pathlib.Path(a.out or 'Faculty_Market_Atlas.html'), a.snapshot, a.sheet_id, a.label)
