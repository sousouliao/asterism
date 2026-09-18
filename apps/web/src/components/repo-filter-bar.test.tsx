// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { useBrowseFilters } from '../stores/browse-filters';
import { RepoFilterBar } from './repo-filter-bar';

const facets = { languages: ['TypeScript', 'Rust'], topics: ['ai-agents', 'ui'] };
const collections = [{ id: 'collection-1', name: 'Reading list' }];

/**
 * 触发同一行视觉一致的最小几何集合。Button 与 Select 的默认内边距、gap、宽度不同，
 * 任一 trigger 缺一项就会重新出现宽窄与留白不一致。
 */
const SHARED_GEOMETRY = [
  'h-8',
  'min-w-28',
  'max-w-44',
  'justify-start',
  'gap-1.5',
  'px-2.5',
  'text-caption',
];

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderBar() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<RepoFilterBar facets={facets} collections={collections} />);
  });
}

function triggers(): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      '[data-slot="popover-trigger"], [data-slot="select-trigger"]',
    ),
  ];
}

function trigger(label: string): HTMLElement {
  const match = triggers().find((element) => element.textContent?.includes(label));
  if (!match) throw new Error(`Missing filter trigger: ${label}`);
  return match;
}

beforeEach(() => {
  useBrowseFilters.getState().reset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('RepoFilterBar trigger geometry', () => {
  it('gives every trigger the same control geometry', async () => {
    await renderBar();

    const toolbar = triggers();
    expect(toolbar).toHaveLength(5);

    for (const element of toolbar) {
      for (const token of SHARED_GEOMETRY) {
        expect(element.className, `${element.textContent} is missing ${token}`).toContain(token);
      }
      expect(element.className).toContain('rounded-lg');
      expect(element.getAttribute('aria-label') ?? element.textContent).toBeTruthy();
    }
  });

  it('pins label and trailing affordance with one flexible child per trigger', async () => {
    await renderBar();

    for (const element of triggers()) {
      const flexible = [...element.children].filter((child) => child.className.includes('flex-1'));
      expect(flexible, `${element.textContent} must flex exactly its label`).toHaveLength(1);
      expect(element.lastElementChild?.tagName.toLowerCase()).toBe('svg');
    }
  });

  it('keeps sorting in its own group, apart from the funnel triggers', async () => {
    await renderBar();

    const row = container.firstElementChild;
    const sortGroup = row?.lastElementChild as HTMLElement;
    expect(
      triggers()
        .slice(0, -1)
        .every((element) => element.parentElement === row),
    ).toBe(true);
    expect(sortGroup.className).toContain('sm:ml-auto');
    expect(sortGroup.querySelector('[data-slot="select-trigger"]')).not.toBeNull();
  });
});

describe('RepoFilterBar active state', () => {
  it('puts the secondary filter count next to the trailing chevron', async () => {
    await renderBar();
    await act(async () => useBrowseFilters.getState().setMinStars(1000));

    const more = trigger(i18n.t('filters.more'));
    expect([...more.children].map((child) => child.tagName.toLowerCase())).toEqual([
      'svg',
      'span',
      'span',
      'svg',
    ]);

    const count = more.querySelector('[data-slot="badge"]');
    expect(count?.textContent).toBe('1');
    expect(count?.nextElementSibling).toBe(more.lastElementChild);
  });

  it('shows the selected collection count on the collections trigger', async () => {
    await renderBar();
    await act(async () => useBrowseFilters.getState().toggleCollectionId('collection-1'));

    const picked = trigger(i18n.t('filters.collections'));
    const count = [...picked.children].find((child) => child.getAttribute('data-slot') === 'badge');
    expect(count?.textContent).toBe('1');
    expect(picked.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('names the sort control so the value is not the whole label', async () => {
    await renderBar();

    const sort = container.querySelector('[data-slot="select-trigger"]');
    expect(sort?.getAttribute('aria-label')).toBe(i18n.t('filters.sort'));
  });
});
