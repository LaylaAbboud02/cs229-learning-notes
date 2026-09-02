/**
 * Progressive-enhancement filter/search/sort for a library page.
 *
 * The page server-renders every applicable note card in course order. This
 * script (loaded by `LibraryView.astro` only when there are notes) reveals the
 * hidden controls and filters the already-rendered cards in place. With
 * JavaScript disabled, all cards stay visible in course order.
 *
 * The filter/sort logic itself is `applyLibraryFilters` in `src/lib/search.ts`,
 * shared with the unit tests. This file is only the DOM wiring — no framework,
 * no component state, so a React island would add weight without benefit.
 */

import {
  applyLibraryFilters,
  hasActiveFilters,
  type LibraryFilterState,
  type LibrarySort,
  type NoteIndexEntry,
} from '../lib/search';

function init(): void {
  const library = document.querySelector<HTMLElement>('[data-library]');
  const controls = document.querySelector<HTMLElement>('[data-library-controls]');
  const results = document.querySelector<HTMLElement>('[data-library-results]');
  const indexEl = document.querySelector<HTMLScriptElement>('script[data-note-index]');
  if (!library || !controls || !results || !indexEl) return;

  const index: NoteIndexEntry[] = JSON.parse(indexEl.textContent || '[]');

  const lockedType = library.dataset.lockedType || '';
  const noun = library.dataset.noun || 'note';
  const total = Number(library.dataset.total || index.length);
  const nounFor = (n: number) => (n === 1 ? noun : `${noun}s`);

  const grid = document.getElementById('note-grid');
  const items = Array.from(document.querySelectorAll<HTMLLIElement>('[data-note-card]'));
  const noResults = results.querySelector<HTMLElement>('[data-no-results]');
  const count = document.getElementById('note-result-count');
  const search = document.getElementById('note-search') as HTMLInputElement | null;
  const sortSel = document.getElementById('note-sort') as HTMLSelectElement | null;
  const topicSel = document.getElementById('note-topic') as HTMLSelectElement | null;
  const clearBtn = controls.querySelector<HTMLButtonElement>('[data-clear-filters]');
  const typeRadios = Array.from(controls.querySelectorAll<HTMLInputElement>('input[name="type"]'));

  const currentState = (): LibraryFilterState => ({
    query: search?.value ?? '',
    type: lockedType || (typeRadios.find((radio) => radio.checked)?.value ?? 'all'),
    topic: topicSel?.value ?? '',
    sort: (sortSel?.value as LibrarySort) ?? 'courseOrder',
  });

  const apply = (): void => {
    const state = currentState();
    const visible = applyLibraryFilters(index, state);
    const order = new Map(visible.map((entry, i) => [entry.slug, i]));

    for (const li of items) li.hidden = !order.has(li.dataset.slug ?? '');

    if (grid) {
      const sorted = items
        .filter((li) => order.has(li.dataset.slug ?? ''))
        .sort(
          (a, b) => (order.get(a.dataset.slug ?? '') ?? 0) - (order.get(b.dataset.slug ?? '') ?? 0),
        );
      for (const li of sorted) grid.appendChild(li);
      grid.toggleAttribute('data-empty', visible.length === 0);
    }

    const n = visible.length;
    if (count) {
      count.textContent = n === total ? `${n} ${nounFor(n)}` : `${n} of ${total} ${nounFor(total)}`;
    }
    if (noResults) noResults.hidden = n !== 0;
    if (clearBtn) clearBtn.hidden = !hasActiveFilters(state, Boolean(lockedType));
  };

  const reset = (): void => {
    if (search) search.value = '';
    if (sortSel) sortSel.value = 'courseOrder';
    if (topicSel) topicSel.value = '';
    typeRadios.forEach((radio, i) => {
      radio.checked = i === 0;
    });
    apply();
    search?.focus();
  };

  search?.addEventListener('input', apply);
  sortSel?.addEventListener('change', apply);
  topicSel?.addEventListener('change', apply);
  typeRadios.forEach((radio) => radio.addEventListener('change', apply));
  clearBtn?.addEventListener('click', reset);

  controls.hidden = false;
  apply();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
