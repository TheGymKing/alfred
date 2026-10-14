import type { ContentScriptContext } from '#imports';
import { sendTrackEvent } from '~/utils/analytics';

const INJECTED_ATTR = 'data-alfred-collection-filter';
const HIDDEN_ATTR = 'data-alfred-filtered-out';
const COLLECTION_PATH = /\/collections\/\d+\/?$/;

// Rows only carry the sortable role and a selection checkbox when the
// collection is sorted manually, which is also when Shopify's bulk Move shows.
const ROW_SELECTOR = '[aria-roledescription="sortable"]';

const STYLES = `
  [${HIDDEN_ATTR}] {
    display: none !important;
  }
  [${INJECTED_ATTR}] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-space-200);
    padding: 0 var(--p-space-400) var(--p-space-300);
  }
  [${INJECTED_ATTR}] s-search-field {
    flex: 1 1 16rem;
  }
  /* Polaris buttons set their own display, which beats the hidden attribute. */
  [${INJECTED_ATTR}] [hidden] {
    display: none !important;
  }
  [${INJECTED_ATTR}] [data-role="summary"] {
    color: var(--p-color-text-secondary);
    font-size: var(--p-font-size-325);
  }
`;

/**
 * Tests whether a product title contains every whitespace-separated term of
 * the query, ignoring case and term order, so "black fleece" finds
 * "Fundamental Fleece Hood - Black".
 * @param title - The product title.
 * @param query - The merchant's filter text.
 */
export const matchesQuery = (title: string, query: string): boolean => {
  const haystack = title.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

/** Product rows in the collection's item list, in display order. */
const getRows = (root: ParentNode = document): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter((row) => row.querySelector('s-checkbox'));

/**
 * Reads a row's product title from its product link, falling back to the
 * checkbox's "Select <title>" label.
 */
const getTitle = (row: HTMLElement): string => {
  const link = row.querySelector('a[href*="/products/"]');
  if (link?.textContent?.trim()) return link.textContent.trim();
  return (row.querySelector('s-checkbox')?.getAttribute('label') ?? '').replace(/^Select\s+/, '');
};

/**
 * Hides rows whose titles don't match the query.
 * @returns The rows that match, in display order.
 */
export const applyFilter = (rows: HTMLElement[], query: string): HTMLElement[] => {
  const matches: HTMLElement[] = [];
  for (const row of rows) {
    const match = !query.trim() || matchesQuery(getTitle(row), query);
    row.toggleAttribute(HIDDEN_ATTR, !match);
    if (match) matches.push(row);
  }
  return matches;
};

// Content scripts run in an isolated world, where the properties Polaris
// defines on its elements (`checked`, `value`) don't exist. The native inputs
// inside their open shadow roots are shared DOM, so state is read from those.
type SelectableCheckbox = HTMLElement & { checked?: boolean };

const isChecked = (checkbox: SelectableCheckbox): boolean => {
  const input = checkbox.shadowRoot?.querySelector('input');
  return input ? input.checked : Boolean(checkbox.checked);
};

/**
 * Toggles a row's Polaris checkbox through its inner input, so the admin's
 * own selection state and bulk actions bar update as if clicked.
 */
const setChecked = (row: HTMLElement, checked: boolean) => {
  const checkbox = row.querySelector<SelectableCheckbox>('s-checkbox');
  if (!checkbox || isChecked(checkbox) === checked) return;
  const input = checkbox.shadowRoot?.querySelector('input');
  (input ?? checkbox).click();
};

/**
 * Makes the selection exactly the matching rows. Hidden rows that were
 * selected earlier are deselected, so Move never carries products the
 * merchant can't see.
 */
export const selectMatching = (rows: HTMLElement[], matches: HTMLElement[]) => {
  const keep = new Set(matches);
  for (const row of rows) setChecked(row, keep.has(row));
};

const setText = (el: HTMLElement, text: string) => {
  if (el.textContent !== text) el.textContent = text;
};

/** Whether the item list has pages beyond the one loaded. */
const hasOtherPages = (list: Element): boolean => {
  const pagination = list.parentElement?.querySelector('[class*="Pagination"]');
  return [...(pagination?.querySelectorAll('s-internal-button') ?? [])].some((btn) => !btn.hasAttribute('disabled'));
};

/**
 * Adds a title filter above a manually sorted collection's items, with a
 * button that selects the matches for Shopify's bulk Move actions.
 * The filter only sees the page of items the admin has loaded.
 * @param ctx - The content script context, used to clean up.
 */
export const setupCollectionFilter = (ctx: ContentScriptContext) => {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.append(style);

  let query = '';
  let pathname = '';
  // One filter event per collection visit, not per keystroke.
  let trackedFilter = false;

  const clear = () => {
    document.querySelector(`[${INJECTED_ATTR}]`)?.remove();
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((row) => row.removeAttribute(HIDDEN_ATTR));
  };

  const update = () => {
    // Opening another collection starts a fresh filter.
    if (window.location.pathname !== pathname) {
      pathname = window.location.pathname;
      query = '';
      trackedFilter = false;
      clear();
    }
    if (!COLLECTION_PATH.test(pathname)) return;

    const rows = getRows();
    let bar = document.querySelector<HTMLElement>(`[${INJECTED_ATTR}]`);

    const [first] = rows;
    if (!first) {
      bar?.remove();
      return;
    }

    const list = first.closest('[class*="ItemsContainer"]') ?? first.parentElement!;
    if (!bar || bar.nextElementSibling !== list) {
      bar?.remove();
      bar = createBar();
      list.before(bar);
    }

    const matches = applyFilter(rows, query);
    const summary = bar.querySelector<HTMLElement>('[data-role="summary"]')!;
    const select = bar.querySelector<HTMLElement>('[data-role="select"]')!;
    const filtering = Boolean(query.trim());
    const pageNote = hasOtherPages(list) ? ' on this page' : '';

    // Writing unchanged text would still queue a mutation and rerun this.
    setText(summary, filtering ? `${matches.length} of ${rows.length} match${pageNote}` : '');
    setText(select, `Select ${matches.length}`);
    select.hidden = !filtering || !matches.length;
  };

  const createBar = (): HTMLElement => {
    const bar = document.createElement('div');
    bar.setAttribute(INJECTED_ATTR, '');

    const field = document.createElement('s-search-field');
    field.setAttribute('label', 'Filter collection items');
    field.setAttribute('labelaccessibilityvisibility', 'exclusive');
    field.setAttribute('placeholder', 'Filter by product title');
    field.setAttribute('autocomplete', 'off');
    // Restores the query when React re-renders the list out from under the bar.
    field.setAttribute('value', query);
    field.addEventListener('input', (e) => {
      // The event is composed from the field's inner <input>.
      const input = e.composedPath()[0];
      query = input instanceof HTMLInputElement ? input.value : '';
      update();
      if (query.trim() && !trackedFilter) {
        trackedFilter = true;
        sendTrackEvent('admin.collection_items.filter');
      }
    });

    const summary = document.createElement('span');
    summary.dataset.role = 'summary';
    summary.setAttribute('aria-live', 'polite');

    const select = document.createElement('s-internal-button');
    select.dataset.role = 'select';
    select.setAttribute('variant', 'secondary');
    select.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rows = getRows();
      const matches = rows.filter((row) => !row.hasAttribute(HIDDEN_ATTR));
      selectMatching(rows, matches);
      sendTrackEvent('admin.collection_items.matches_select', { count: matches.length });
    });

    bar.append(field, summary, select);
    return bar;
  };

  // The admin is a single-page app, and its client-side navigation doesn't
  // reliably reach content scripts as wxt:locationchange. Watching the DOM
  // covers navigation as well as React re-rendering rows after a move, a page
  // change or a sort change.
  let queued = false;
  let active = true;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      // A frame queued before invalidation must not bring the bar back.
      if (active) update();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  update();

  ctx.onInvalidated(() => {
    active = false;
    observer.disconnect();
    clear();
    style.remove();
  });
};
