import { clampPercent, keyboardDelta } from './before-after-utils.mjs';

export function initBeforeAfter(root) {
  if (!root) return;
  const range = root.querySelector('input[type="range"]');
  const after = root.querySelector('.after-wrap');
  const handle = root.querySelector('.before-after-handle');
  if (!range || !after || !handle) return;

  const update = (value) => {
    const pct = clampPercent(value);
    range.value = String(pct);
    after.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
    range.setAttribute('aria-valuenow', String(pct));
  };

  range.addEventListener('input', () => update(range.value));
  range.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    update(keyboardDelta(event.key, Number(range.value)));
  });
  update(range.value || 50);
}

document.querySelectorAll('[data-before-after]').forEach(initBeforeAfter);
