import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { parseHTML } from 'linkedom';

const g = globalThis as Record<string, unknown>;
const saved = ['document', 'HTMLElement'].map((k) => [k, g[k]] as const);
const dom = parseHTML('<!doctype html><html><body></body></html>');
Object.assign(g, { document: dom.document, HTMLElement: dom.HTMLElement });

const { matchesQuery, applyFilter, selectMatching } = await import('../collection-filter');

afterAll(() => {
  for (const [k, v] of saved) g[k] = v;
});

const TITLES = [
  'Gym King Fundamental Fleece Hood - Black',
  'Gym King Fundamental Fleece Jogger - Black',
  'Gym King Debossed Camo SS Tee - Black',
  'Gym King Fundamental Jersey Tee - White'
];

type Checkbox = HTMLElement & { checked: boolean };

// Mirrors a manually sorted grid cell: a sortable row with a Polaris checkbox
// and the product link. Linkedom has no shadow DOM, so the checkbox toggles on
// its own click the way its inner input does in the admin.
const render = (titles: string[]): HTMLElement[] => {
  dom.document.body.innerHTML = `<div class="_ItemsContainer_1gqnn_1">${titles
    .map(
      (title, i) => `
        <div role="button" aria-roledescription="sortable">
          <s-checkbox label="Select ${title}"></s-checkbox>
          <a href="/store/demo/products/${i}"><span>${title}</span></a>
        </div>`
    )
    .join('')}</div>`;
  const rows = [...dom.document.querySelectorAll<HTMLElement>('[aria-roledescription="sortable"]')];
  for (const row of rows) {
    const checkbox = row.querySelector('s-checkbox') as Checkbox;
    checkbox.checked = false;
    checkbox.addEventListener('click', () => (checkbox.checked = !checkbox.checked));
  }
  return rows;
};

const checked = (rows: HTMLElement[]) => rows.map((row) => (row.querySelector('s-checkbox') as Checkbox).checked);
const hidden = (rows: HTMLElement[]) => rows.map((row) => row.hasAttribute('data-alfred-filtered-out'));

describe('matchesQuery', () => {
  it('needs every term, in any order and any case', () => {
    expect(matchesQuery(TITLES[0], 'black FLEECE')).toBe(true);
    expect(matchesQuery(TITLES[0], '  hood   black ')).toBe(true);
    expect(matchesQuery(TITLES[0], 'fleece white')).toBe(false);
  });

  it('matches everything for a blank query', () => {
    expect(matchesQuery(TITLES[0], '   ')).toBe(true);
  });
});

describe('applyFilter', () => {
  let rows: HTMLElement[];
  beforeEach(() => {
    rows = render(TITLES);
  });

  it('hides non-matching rows and returns the matches in order', () => {
    const matches = applyFilter(rows, 'fundamental black');
    expect(matches).toEqual([rows[0], rows[1]]);
    expect(hidden(rows)).toEqual([false, false, true, true]);
  });

  it('shows every row again once the query is cleared', () => {
    applyFilter(rows, 'camo');
    applyFilter(rows, '');
    expect(hidden(rows)).toEqual([false, false, false, false]);
  });

  it('falls back to the checkbox label when a row has no product link', () => {
    rows[2].querySelector('a')!.remove();
    expect(applyFilter(rows, 'camo')).toEqual([rows[2]]);
  });
});

describe('selectMatching', () => {
  it('selects exactly the matches, dropping hidden rows selected earlier', () => {
    const rows = render(TITLES);
    (rows[3].querySelector('s-checkbox') as HTMLElement).click();
    (rows[0].querySelector('s-checkbox') as HTMLElement).click();

    selectMatching(rows, applyFilter(rows, 'fleece'));

    expect(checked(rows)).toEqual([true, true, false, false]);
  });
});
