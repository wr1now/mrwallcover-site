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
# Explicit publish lists where the research file's own gallery is a shortlist.
# Trematon: own photographs (previews). Excluded: 02 (crew faces), 22 (unverified subject),
# and the House of Hackney delivery note (client name and address), which is not in the folder.
GALLERY_OVERRIDE = {
    'trematon-castle': [f'trematon-{n}' for n in
        ['01','03','11','16','13','18','06','07','08','09','10','12','14','15','17','19','21','23','24','25','26','04','05','20']],
}
GALLERY_OVERRIDE['old-bailey-hotel'] = [f'old-bailey-{n}' for n in
    ['12','06','07','08','09','10','11','13','14','16','17','18','01','02','03','04','05','15','19']]
# Display titles agreed with Dorin (slug unchanged, so no redirect is needed).
TITLE_OVERRIDE = {'old-bailey-hotel': 'Hyde London City (the Old Bailey Hotel)'}
MODEST = {'trematon-castle', 'old-bailey-hotel'}
# Research files published by hand instead (anonymised). kate-moss-bedroom.md ->
# src/content/case-studies/north-london-residence.md, written manually; never auto-publish it.
SKIP = {'kate-moss-bedroom', 'calico-estuary-nomad-dinner'}  # NoMad dinner is folded into the Rosewood page

# Calico design-week and fashion commissions (own photos, previews, EXIF stripped).
# Excluded: Beverly 01-02 (street views with parked cars), Beverly 09 (duplicate),
# Lee Broom 02 (near-duplicate), Rosewood 04-05 (hands/tools), NoMad 02 (vehicle in background).
GALLERY_OVERRIDE.update({
    'calico-lee-broom-overture': [f'lee-broom-{n}' for n in ['03','01','04','08','05','06','07','09','10','11']],
    'calico-beverly-1975-cadence': [f'beverly-{n}' for n in ['06','08','04','05','07','03']],
    'calico-ahluwalia-estuary-rosewood': [f'ahluwalia-estuary-{n}' for n in ['06','07','01','02','03']] + ['nomad-01'],
})
MODEST |= {'calico-lee-broom-overture', 'calico-beverly-1975-cadence', 'calico-ahluwalia-estuary-rosewood'}
YEARS = {'calico-lee-broom-overture': '2025', 'calico-beverly-1975-cadence': '2026', 'calico-ahluwalia-estuary-rosewood': '2026'}
META_TITLE = {
    'calico-lee-broom-overture': 'Lee Broom x Calico: Overture, Shoreditch | Mr Wallcover',
    'calico-beverly-1975-cadence': 'BEVERLY 1975 x Calico: Cadence, LDF 2026 | Mr Wallcover',
    'calico-ahluwalia-estuary-rosewood': 'Ahluwalia x Calico: Estuary at Rosewood | Mr Wallcover',
}
GROUP = {k: 'design-weeks' for k in YEARS}
META_DESC = {
    'calico-lee-broom-overture': "Survey, preparation and installation of Lee Broom's Overture mural for Calico Wallpaper at his Shoreditch showroom, London Design Festival 2025.",
    'calico-beverly-1975-cadence': 'Cadence in Oxblood by Calico Wallpaper, hung in a day for BEVERLY 1975 at The Lavery, Cromwell Place, Brompton Design District 2026.',
    'calico-ahluwalia-estuary-rosewood': "Ahluwalia's Estuary mural for Calico Wallpaper, installed as the runway backdrop at Rosewood London for London Fashion Week, September 2026.",
}
# Per-slug wording fixes for internal phrasing in the research file.
BODY_SUBS = {
    'old-bailey-hotel': [
        ('## At a glance\n',
         '> **As featured by Timorous Beasties:** [Studio Moren x Timorous Beasties at Hyde London City](https://www.timorousbeasties.com/story/studio-moren-x-timorous-beasties-at-hyde-london-city). Their story shows the two designs in the finished bedrooms.\n\n## At a glance\n'),
        ('- **Our package:**', '- **Interior design:** Studio Moren\n- **Our package:**'),
        ('- **Wallcoverings:** Timorous Beasties (Tropical Clouded Leopard; Totem Damask) and House of Hackney (LIMERENCE)',
         '- **Wallcoverings:** Timorous Beasties Tropical Clouded Leopard and Totem Damask (custom-printed vinyl), and House of Hackney LIMERENCE'),
        ('## The brief\n',
         '## The design\n\nThe interiors were designed by Studio Moren. For the bedrooms they selected two Timorous Beasties designs, produced as custom-printed vinyl wallpaper: Totem Damask in Black & Blue, and Tropical Clouded Leopard in Vanilla. Vinyl lets the patterns stand up to the daily wear of a busy hotel while keeping their colour and detail. Timorous Beasties describe the result as \u201cbold pattern with atmosphere\u201d ([Timorous Beasties](https://www.timorousbeasties.com/story/studio-moren-x-timorous-beasties-at-hyde-london-city)).\n\n## The brief\n'),
        ('Tropical Clouded Leopard is a superwide, quarter-drop design with a 1.4 m vertical repeat. Hung',
         'Tropical Clouded Leopard is a large-scale, quarter-drop design. Hung'),
        ('- Timorous Beasties – Tropical Clouded Leopard Superwide, Vanilla: guest-room headboard walls',
         '- Timorous Beasties – Tropical Clouded Leopard, Vanilla, custom-printed vinyl: guest-room headboard walls'),
        ('- Timorous Beasties – Totem Damask, Black & Blue: guest-room feature walls',
         '- Timorous Beasties – Totem Damask, Black & Blue, custom-printed vinyl: guest-room feature walls'),
        ('Alongside the decoration, we fitted window film to the glazing. Solar Screen rolls were photographed on site in June 2024.',
         'Alongside the decoration, we fitted [Solar Screen](https://solarscreen.eu/en/) window film to the glazing. See our [window film service](/services/window-film/).'),
    ],
}  # preview-size photos: show small, never upscale
TBC = re.compile(r'^\*(?:to confirm|note):\*|to be confirmed|once confirmed|will be added once|unconfirmed|to confirm before publishing|divine savages', re.I)


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


def materials_table_to_list(body):
    """Turn an internal evidence/confidence table into a public list.
    Confirmed rows are stated plainly; probable rows are marked as identified from
    our photographs; possible rows are dropped."""
    def repl(m):
        all_rows = [r for r in m.group(0).strip().splitlines() if r.startswith('|') and '---' not in r]
        head = [c.strip().lower() for c in all_rows[0].strip('|').split('|')]
        ci = head.index('confidence') if 'confidence' in head else -1
        wi = head.index('where') if 'where' in head else None
        out = []
        for r in all_rows[1:]:
            cells = [c.strip() for c in r.strip('|').split('|')]
            design, conf = cells[0], cells[ci].lower()
            if wi is not None:
                design = re.sub(r'\s*Wallpaper,', ',', design)
                where = re.sub(r'\s*\([^)]*\)', '', cells[wi]).strip()
                design = f'{design}: {where[0].lower() + where[1:]}' if where else design
            if 'possible' in conf and 'probable' not in conf:
                continue
            design = re.sub(r'\s*HoH names it.*$', '', design)
            design = design.rstrip('. ')
            note = ' (identified from our site photographs)' if 'probable' in conf else ''
            design = design.replace('(not HoH)', '(not House of Hackney)')
            out.append(f'- {design}{note}')
        return '\n'.join(out) + '\n'
    return re.sub(r'^\|[^\n]*Confidence[^\n]*\|\n(?:\|[^\n]*\n?)+', repl, body, flags=re.M)


# Private clients are not named on the site.
ANON = [
    (r'Frieda Gormley and Javvy M\.? Royle, founders of \[House of Hackney\]\(([^)]*)\), custodians of the Castle of Trematon',
     r'The new owners of Trematon Castle, the founders of [House of Hackney](\1)'),
    (r'Frieda Gormley and Javvy M\.? Royle, founders of House of Hackney \(custodians of the Castle of Trematon since 2018\)',
     'The new owners of Trematon Castle, the founders of House of Hackney'),
    (r', in Javvy Royle\'s words, needed', ', in the founders\' words, needed'),
    (r'(Frieda|Javvy)( M\.)? (Gormley|Royle)', 'the founders'),
]


def anonymise(text):
    for pat, rep in ANON:
        text = re.sub(pat, rep, text)
    return text


def links_table_to_list(body):
    """'| Item | Link |' tables become a plain list of linked titles."""
    def repl(m):
        rows = [r for r in m.group(0).strip().splitlines() if r.startswith('|') and '---' not in r][1:]
        out = []
        for r in rows:
            cells = [c.strip() for c in r.strip('|').split('|')]
            label, link = cells[0], cells[-1]
            if link.startswith('http'):
                out.append(f'- [{label}]({link})')
        return '\n'.join(out) + '\n'
    return re.sub(r'^\|\s*Item\s*\|\s*Link\s*\|\n(?:\|[^\n]*\n?)+', repl, body, flags=re.M)


def nomad_section():
    """The NoMad launch dinner, folded into the Rosewood page."""
    src = SRC / 'calico-estuary-nomad-dinner.md'
    if not src.exists():
        return ''
    _, b = parse_frontmatter(src.read_text())
    b = links_table_to_list(clean_body(b))
    b = re.sub(r'^\*(?!\*).+?\*\s*\n', '', b, count=1, flags=re.M).lstrip()
    b = re.sub(r'^## ', '### ', b, flags=re.M)
    b = b.replace('### Materials and links', '### Links')
    # The dinner date is not confirmed (records say 15 Sep, Calico posted on the 16th).
    b = b.replace('panels hung 14 September 2026; dinner 15 September 2026', 'panels hung 14 September 2026, ahead of the dinner')
    return '\n## Launch dinner, NoMad London\n\n' + b


def calico_callout(clean):
    """Partnership line plus press links, placed at the top of the Calico pages."""
    links = re.findall(r'^- \[(.+?)\]\((https?://[^)]+)\)', clean, flags=re.M)
    press, seen = [], set()
    for label, url in links:
        if 'calicowallpaper.com/collection' in url or 'calicowallpaper.com/product' in url or url in seen:
            continue
        seen.add(url)
        press.append(f'[{label}]({url})')
    line = '> **Delivered in partnership with [Calico Wallpaper](https://calicowallpaper.com/).**'
    if press:
        line += '\n>\n> **In the press:** ' + ' · '.join(press)
    return line + '\n\n'


def clean_body(body):
    body = anonymise(body)
    body = links_table_to_list(body)
    body = re.sub(r'^## Images\n.*?(?=^## |\Z)', '', body, flags=re.S | re.M)
    body = re.sub(r'^## Instagram\n.*?(?=^## |\Z)', '', body, flags=re.S | re.M)
    body = materials_table_to_list(body)
    # internal editorial asides
    body = re.sub(r'\s*\*\((?:Dorin|confidence|scope)[^)]*\)\*', '', body, flags=re.I)
    body = re.sub(r'\s*\((?:Dorin\'s account|Dorin\'s brief)[^)]*\)', '', body)
    body = body.replace(' (evidenced in our photos)', '')
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
    if path.name.upper() == 'SOURCES.MD' or path.stem in SKIP:
        continue
    fm, body = parse_frontmatter(path.read_text())
    slug = fm.get('slug') or path.stem
    rights = image_rights(body)
    gallery = []
    if slug in GALLERY_OVERRIDE:
        fm['gallery'] = []
        gallery = [{'id': i, 'credit': None} for i in GALLERY_OVERRIDE[slug] if i in SIZES]
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
    for a, b in BODY_SUBS.get(slug, []):
        clean = clean.replace(a, b)
    clean = clean.replace('## Materials and links', '## Links and press')
    if slug == 'calico-ahluwalia-estuary-rosewood':
        clean = clean.rstrip() + '\n' + nomad_section()
    if GROUP.get(slug) == 'design-weeks':
        clean = clean.replace('- **For:** Calico Wallpaper', '- **In partnership with:** Calico Wallpaper')
        clean = calico_callout(clean) + clean
    if lead:
        clean = re.sub(r'^\*(?!\*)' + re.escape(lead) + r'\*\s*\n', '', clean, count=1, flags=re.M).lstrip()
    years = fm.get('years') or ''
    data = {
        'title': TITLE_OVERRIDE.get(slug, fm.get('title', slug)),
        'slug': slug,
        'replaces': REPLACES.get(slug),
        'client': anonymise(fm.get('client', '')),
        'location': fm.get('location', ''),
        'years': YEARS[slug] if slug in YEARS else None if TBC.search(years) or not years else re.sub(r'\s*\(photo record[^)]*\)', '', years),
        'role': re.split(r'\.\s*Scope as briefed', fm.get('role', ''))[0],
        'wallcoverings': [w.replace(' Superwide', '') for w in [re.sub(r'\s*\((?:[^)]*(?:confirmed|probable|possible|visual match|roll label|photographed))[^)]*\)', '', w, flags=re.I) for w in fm.get('wallcoverings', []) or [] if not TBC.search(w)]],
        'modest': slug in MODEST,
        'metaTitle': META_TITLE.get(slug),
        'metaDescription': META_DESC.get(slug),
        'group': GROUP.get(slug),
        'standfirst': lead,
        'hero': hero if hero_ok else (gallery[0]['id'] if gallery else None),
        'gallery': gallery,
    }
    held = [g for g in (fm.get('gallery') or []) if g not in [x['id'] for x in gallery] and not any(OWO_DRIVE.get(d) in [x['id'] for x in gallery] for d in re.findall(r'/d/([A-Za-z0-9_-]+)/', g))]
    (OUT / f'{slug}.md').write_text('---\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n---\n\n' + clean)
    print(f'{slug}: {len(gallery)} images published, {len(held)} held back')
