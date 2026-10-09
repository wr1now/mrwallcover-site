#!/usr/bin/env python3
"""Copy case studies from the research folder into the site, cleaned for publication.

Usage: python3 scripts/sync-case-studies.py /workspace/mrwallcover-site/case-studies

Rules:
- SOURCES.md is internal and never copied.
- The "## Images" section (rights notes) is internal and removed.
- Lines that only say something is still "to be confirmed" are removed.
- Gallery keeps only images that are our own photographs, or official OWO press images
  (credited "Image: Raffles London at The OWO (official)"). Anything marked
  "confirm rights" is held back.
"""
import json, re, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '/workspace/mrwallcover-site/case-studies')
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/content/case-studies'
SIZES = json.loads((ROOT / 'src/content/sizes.json').read_text())
OWO_CREDIT = 'Image: Raffles London at The OWO (official)'
OWO_DRIVE = {
    '1dcgxSXRf6ULGDBUgYKTvR3leRlsLjYNd': 'owo-official-classic',
    '1i01YJVjzmo7Uk7YesnXesPCnLJVzf-7i': 'owo-official-deluxe-double',
    '16cHtyhFT4Ci3yiZXu_d10VD5oynr0ia_': 'owo-official-deluxe-twin',
    '1PlyuIZdE7oyEFXYwXPFdil8qw1QbOHFg': 'owo-official-junior-suite',
    '1sMv8PszCnsjX9c0kGvrrJZT5U5rqo4S7': 'owo-official-executive',
    '1gbK-qVzI2DeJ4vPt7VmX9-lae6GImKkW': 'owo-official-lifestyle-suite',
}
# Earlier project slugs that each case study replaces (old URLs redirect).
REPLACES = {
    'four-seasons-ten-trinity-square': 'four-seasons-ten-trinity',
    'raffles-london-the-owo': 'owo-whitehall',
    'hilton-garden-inn-silverstone': 'hilton-silverstone',
}
TBC = re.compile(r'to be confirmed|once confirmed|will be added once|unconfirmed', re.I)


def parse_frontmatter(text):
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    fm, body = {}, text
    if not m:
        return fm, body
    body = text[m.end():]
    key = None
    for line in m.group(1).splitlines():
        if re.match(r'^\s+-\s', line) and key:
            fm.setdefault(key, [])
            fm[key].append(line.split('-', 1)[1].strip().strip('"'))
        elif ':' in line:
            key, val = line.split(':', 1)
            key, val = key.strip(), val.strip().strip('"')
            fm[key] = val if val else []
    return fm, body


def image_rights(body):
    """Map image id or Drive id -> rights note, from the internal Images table."""
    rights = {}
    sec = re.search(r'^## Images\n(.*?)(?=^## |\Z)', body, re.S | re.M)
    if not sec:
        return rights
    for row in sec.group(1).splitlines():
        if not row.startswith('|') or '---' in row:
            continue
        cells = [c.strip() for c in row.strip('|').split('|')]
        if len(cells) < 3:
            continue
        note = cells[-1]
        for ident in re.findall(r'`([a-z0-9-]+)`', cells[0]):
            rights[ident] = note
        for did in re.findall(r'/d/([A-Za-z0-9_-]+)/', cells[0]):
            rights[did] = note
        # ranges such as `browns-hotel-mayfair-02` to `-05`
        rng = re.search(r'`([a-z0-9-]+-)(\d\d)` to `-(\d\d)`', cells[0])
        if rng:
            for n in range(int(rng.group(2)), int(rng.group(3)) + 1):
                rights[f'{rng.group(1)}{n:02d}'] = note
    return rights


def allowed(note):
    n = note.lower()
    if 'confirm' in n or 'use only once' in n:
        return False
    return 'own' in n or 'official' in n


def clean_body(body):
    body = re.sub(r'^## Images\n.*?(?=^## |\Z)', '', body, flags=re.S | re.M)
    body = re.sub(r'^# .*\n', '', body, count=1, flags=re.M)
    out = []
    for line in body.splitlines():
        line = re.sub(r'\s*\((?:extent )?to be confirmed\)', '', line, flags=re.I)
        if TBC.search(line):
            continue
        out.append(line)
    text = '\n'.join(out)
    return re.sub(r'\n{3,}', '\n\n', text).strip() + '\n'


def standfirst(body):
    m = re.search(r'^\*(?!\*)(.+?)\*\s*$', body, re.M)
    return m.group(1).strip() if m else ''


for path in sorted(SRC.glob('*.md')):
    if path.name.upper() == 'SOURCES.MD':
        continue
    fm, body = parse_frontmatter(path.read_text())
    slug = fm.get('slug') or path.stem
    rights = image_rights(body)
    gallery = []
    for item in fm.get('gallery', []) or []:
        did = re.search(r'/d/([A-Za-z0-9_-]+)/', item)
        if did:
            img = OWO_DRIVE.get(did.group(1))
            note = rights.get(did.group(1), '')
            if img and img in SIZES and allowed(note):
                gallery.append({'id': img, 'credit': OWO_CREDIT})
            continue
        note = rights.get(item, '')
        if item in SIZES and allowed(note):
            gallery.append({'id': item, 'credit': None})
    hero = fm.get('hero_image')
    hero_ok = hero and any(g['id'] == hero for g in gallery)
    lead = standfirst(body)
    clean = clean_body(body)
    if lead:
        clean = re.sub(r'^\*(?!\*)' + re.escape(lead) + r'\*\s*\n', '', clean, count=1, flags=re.M).lstrip()
    years = fm.get('years') or ''
    data = {
        'title': fm.get('title', slug),
        'slug': slug,
        'replaces': REPLACES.get(slug),
        'client': fm.get('client', ''),
        'location': fm.get('location', ''),
        'years': None if TBC.search(years) or not years else years,
        'role': fm.get('role', ''),
        'wallcoverings': [w for w in fm.get('wallcoverings', []) or [] if not TBC.search(w)],
        'standfirst': lead,
        'hero': hero if hero_ok else (gallery[0]['id'] if gallery else None),
        'gallery': gallery,
    }
    held = [g for g in (fm.get('gallery') or []) if g not in [x['id'] for x in gallery] and not any(OWO_DRIVE.get(d) in [x['id'] for x in gallery] for d in re.findall(r'/d/([A-Za-z0-9_-]+)/', g))]
    (OUT / f'{slug}.md').write_text('---\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n---\n\n' + clean)
    print(f'{slug}: {len(gallery)} images published, {len(held)} held back')
