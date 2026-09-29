import { useCallback, useEffect, useState, useTransition } from 'react';
import { getBrowseView, type RepoViewMode, setBrowseViewPersisted } from '../stores/browse-view';

/**
 * Browse 视图切换：通过 useTransition 提交视图更新，
 * 保持 Tab 指示器即时响应的同时，内容视图以非阻塞过渡平滑呈现。
 */
export function useBrowseView() {
  const [view, setView] = useState<RepoViewMode>(() => getBrowseView());
  const [, startTransition] = useTransition();

  useEffect(() => {
    setBrowseViewPersisted(view);
  }, [view]);

  const transitionTo = useCallback((next: RepoViewMode) => {
    startTransition(() => setView(next));
  }, []);

  return {
    view,
    transitionTo,
  };
}
