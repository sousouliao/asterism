// @vitest-environment happy-dom

import type { MatchExplanation } from '@asterism/core';
import i18next from 'i18next';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import '../i18n';
import { MatchExplanationBadge } from './match-explanation-badge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MatchExplanationBadge', () => {
  beforeEach(async () => {
    await i18next.changeLanguage('zh-CN');
  });

  it('renders why_saved match reason with snippet in zh-CN and en', async () => {
    const explanation: MatchExplanation = {
      repoId: 'r1',
      primaryReason: {
        kind: 'why_saved',
        snippet: '用于替换旧网关',
      },
      reasons: [{ kind: 'why_saved', snippet: '用于替换旧网关' }],
    };

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MatchExplanationBadge explanation={explanation} />);
    });

    expect(container.textContent).toContain('命中收藏原因');
    expect(container.textContent).toContain('用于替换旧网关');

    // 切换到英文
    await act(async () => {
      await i18next.changeLanguage('en');
    });

    expect(container.textContent).toContain('Matches saved reason');

    await act(async () => root.unmount());
    container.remove();
  });

  it('renders semantic_memory match reason', async () => {
    const explanation: MatchExplanation = {
      repoId: 'r2',
      primaryReason: {
        kind: 'semantic_memory',
        snippet: '数据库连接池实现',
      },
      reasons: [{ kind: 'semantic_memory', snippet: '数据库连接池实现' }],
    };

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MatchExplanationBadge explanation={explanation} />);
    });

    expect(container.textContent).toContain('与你的笔记意图相近');

    await act(async () => root.unmount());
    container.remove();
  });

  it('can hide snippet in compact mode', async () => {
    const explanation: MatchExplanation = {
      repoId: 'r3',
      primaryReason: {
        kind: 'note',
        snippet: '私有笔记',
      },
      reasons: [{ kind: 'note', snippet: '私有笔记' }],
    };

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MatchExplanationBadge explanation={explanation} showSnippet={false} />);
    });

    expect(container.textContent).toContain('命中笔记');
    expect(container.textContent).not.toContain('私有笔记');

    await act(async () => root.unmount());
    container.remove();
  });

  it('does not display redundant inline snippet for description match to keep card clean', async () => {
    const explanation: MatchExplanation = {
      repoId: 'r4',
      primaryReason: {
        kind: 'description',
        snippet: 'Help AI coding agents write modern Go',
        fullText: 'Help AI coding agents write modern Go',
      },
      reasons: [{ kind: 'description', snippet: 'Help AI coding agents write modern Go' }],
    };

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MatchExplanationBadge explanation={explanation} />);
    });

    expect(container.textContent).toContain('命中仓库描述');
    expect(container.textContent).not.toContain('Help AI coding agents');

    await act(async () => root.unmount());
    container.remove();
  });
});
