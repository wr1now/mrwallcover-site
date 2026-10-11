import { allowanceRange, estimateRolls, roomWalls, type MatchType } from '../lib/quantity.ts';

/**
 * Progressive enhancement for /advice/quantities/. Without JavaScript the form and the worked examples still read;
 * with it, the calculator gives the drop count (free and straight match) and the 15–30% allowance range
 * (staircases around 30%) side by side, and updates as the figures change.
 */
const form = document.querySelector<HTMLFormElement>('[data-quantity]');
const output = document.querySelector<HTMLElement>('[data-quantity-output]');
if (form && output) {
  const room = form.querySelector<HTMLElement>('[data-room]');
  const wallsBox = form.querySelector<HTMLElement>('[data-walls]');
  const addWall = form.querySelector<HTMLButtonElement>('[data-add-wall]');
  const num = (name: string) => Number(new FormData(form).get(name));
  const measure = () => String(new FormData(form).get('measure') || 'walls');

  const readWalls = () => {
    if (measure() === 'room') return roomWalls(num('roomLength'), num('roomWidth'), num('roomHeight'));
    const widths = [...form.querySelectorAll<HTMLInputElement>('[name="width"]')];
    const heights = [...form.querySelectorAll<HTMLInputElement>('[name="height"]')];
    return widths.map((width, index) => ({
      widthM: Number(width.value),
      heightM: Number(heights[index]?.value),
    }));
  };

  const line = (text: string, strong?: string) => {
    const p = document.createElement('p');
    if (strong) {
      const b = document.createElement('strong');
      b.textContent = strong;
      p.append(b, ' ');
    }
    p.append(text);
    return p;
  };

  const plural = (n: number) => `${n} roll${n === 1 ? '' : 's'}`;

  const calculate = () => {
    const match = String(new FormData(form).get('match') || 'free') as MatchType;
    const walls = readWalls();
    const base = { rollWidthM: num('rollWidth'), rollLengthM: num('rollLength'), match };
    const result = estimateRolls({ ...base, walls, trimM: num('trim'), repeatM: match === 'straight' ? num('repeat') : undefined });
    const allowance = allowanceRange({ ...base, walls });
    output.hidden = false;
    output.replaceChildren();
    output.append(result.ok ? line(`${plural(result.rolls)} under these assumptions.`, 'Drop count:') : line(result.reason, 'Drop count:'));
    if (allowance.ok) {
      const range = allowance.minRolls === allowance.maxRolls ? plural(allowance.maxRolls) : `${allowance.minRolls} to ${plural(allowance.maxRolls)}`;
      const pct = allowance.minPct === allowance.maxPct ? `around ${allowance.maxPct}%` : `${allowance.minPct}–${allowance.maxPct}%`;
      output.append(line(`${range}: ${allowance.netAreaM2} m² of net wall area plus ${pct}. ${allowance.note}`, 'With the usual allowance:'));
      if (result.ok && result.rolls > allowance.maxRolls) output.append(line('The drop count is higher than the allowance range here, so the order follows the drop count.'));
    } else {
      output.append(line(allowance.reason, 'With the usual allowance:'));
    }
    const notes = result.ok ? result.assumptions : ['This is not a confirmed purchase quantity and it is not a quotation.'];
    output.append(line(`Extra rolls for pattern matching are confirmed at survey. ${notes.join(' ')}`));
  };

  const syncMeasure = () => {
    const isRoom = measure() === 'room';
    if (room) room.hidden = !isRoom;
    if (wallsBox) wallsBox.hidden = isRoom;
    if (addWall) addWall.hidden = isRoom;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculate();
  });
  form.addEventListener('change', (event) => {
    if ((event.target as HTMLInputElement).name === 'measure') syncMeasure();
    if (!output.hidden) calculate();
  });
  addWall?.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'grid gap-5 md:grid-cols-2';
    row.innerHTML = '<div class="field"><label>Width, metres <input name="width" type="number" min="0" step="0.01" value="5" /></label></div><div class="field"><label>Height, metres <input name="height" type="number" min="0" step="0.01" value="2.7" /></label></div>';
    wallsBox?.append(row);
    row.querySelector('input')?.focus();
  });
  syncMeasure();
}
