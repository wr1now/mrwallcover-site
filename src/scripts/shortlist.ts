const KEY = 'mw-shortlist';

export function readShortlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(slugs)]));
}

function paint() {
  const selected = new Set(readShortlist());
  document.querySelectorAll<HTMLButtonElement>('[data-shortlist]').forEach((button) => {
    const slug = button.dataset.shortlist || '';
    const on = selected.has(slug);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? 'Saved on this device' : 'Save to shortlist';
  });
  const count = document.querySelector('[data-shortlist-count]');
  if (count) count.textContent = String(selected.size);
  document.querySelectorAll<HTMLElement>('[data-compare-row]').forEach((row) => {
    row.hidden = !selected.has(row.dataset.compareRow || '');
  });
  const empty = document.querySelector<HTMLElement>('[data-compare-empty]');
  if (empty) empty.hidden = selected.size > 0;
}

export function bindShortlist() {
  paint();
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-shortlist]');
    if (!button) return;
    const slug = button.dataset.shortlist || '';
    const next = new Set(readShortlist());
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    write([...next]);
    paint();
    const sink = (window as unknown as { __mwTrack?: (name: string, detail: Record<string, unknown>) => void }).__mwTrack;
    if (typeof sink === 'function') sink('shortlist_added', { slug, count: next.size });
  });
}

bindShortlist();
