// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextChip } from './repo-context-chip';

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe('ContextChip visual decoupling', () => {
  it('renders collections with secondary badge and folder icon', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <ContextChip
          item={{ kind: 'collection', key: 'collection:col-1', label: '前端基础设施' }}
        />,
      );
    });

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-secondary');
    expect(badge?.textContent).toBe('前端基础设施');

    const icon = badge?.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders technical topics with plain secondary badge without extra icons', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <ContextChip item={{ kind: 'topic', key: 'topic:typescript', label: 'typescript' }} />,
      );
    });

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-secondary');
    expect(badge?.textContent).toBe('typescript');

    const icon = badge?.querySelector('svg');
    expect(icon).toBeNull();
  });
});
