import { estimateRolls, type MatchType } from '../lib/quantity.ts';

const form = document.querySelector<HTMLFormElement>('[data-quantity]');
const output = document.querySelector<HTMLElement>('[data-quantity-output]');
if (form && output) {
  const readWalls = () => {
    const widths = [...form.querySelectorAll<HTMLInputElement>('[name="width"]')];
    const heights = [...form.querySelectorAll<HTMLInputElement>('[name="height"]')];
    return widths.map((width, index) => ({
      widthM: Number(width.value),
      heightM: Number(heights[index]?.value),
    }));
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const match = String(new FormData(form).get('match') || 'free') as MatchType;
    const result = estimateRolls({
      walls: readWalls(),
      trimM: Number(new FormData(form).get('trim')),
      rollWidthM: Number(new FormData(form).get('rollWidth')),
      rollLengthM: Number(new FormData(form).get('rollLength')),
      match,
      repeatM: match === 'straight' ? Number(new FormData(form).get('repeat')) : undefined,
    });
    output.hidden = false;
    if (!result.ok) {
      output.textContent = result.reason;
      return;
    }
    output.textContent = `Under these assumptions: ${result.rolls} roll${result.rolls === 1 ? '' : 's'}. ${result.assumptions.join(' ')}`;
  });
  document.querySelector('[data-add-wall]')?.addEventListener('click', () => {
    const list = form.querySelector('[data-walls]');
    const row = document.createElement('div');
    row.className = 'grid gap-5 md:grid-cols-2';
    row.innerHTML = '<div class="field"><label>Width, metres <input name="width" type="number" min="0" step="0.01" value="5" /></label></div><div class="field"><label>Height, metres <input name="height" type="number" min="0" step="0.01" value="2.7" /></label></div>';
    list?.append(row);
  });
}
