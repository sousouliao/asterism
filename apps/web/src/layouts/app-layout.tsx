import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppTopbar } from '../components/app-topbar';
import { AskDock, isAskShortcut } from '../components/ask/ask-panel';
import { RepoInspector } from '../components/repo-inspector';
import { SidebarNav } from '../components/sidebar-nav';
import { EmbeddingBootstrapProvider } from '../contexts/embedding-bootstrap-context';
import { RepoInspectorProvider } from '../contexts/repo-inspector-context';
import { useAutoSyncStars } from '../data/use-auto-sync-stars';

export function AppLayout() {
  return (
    <RepoInspectorProvider>
      <EmbeddingBootstrapProvider>
        <AppLayoutContent />
      </EmbeddingBootstrapProvider>
    </RepoInspectorProvider>
  );
}

function AppLayoutContent() {
  useAutoSyncStars();
  const [askFocusRequest, setAskFocusRequest] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isAskShortcut(event)) {
        return;
      }
      event.preventDefault();
      setAskFocusRequest((value) => value + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="asterism-glass-page flex h-svh">
      <aside className="hidden w-60 shrink-0 border-sidebar-border border-r bg-sidebar lg:block">
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="@container/main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
          <Outlet />
        </main>
      </div>
      <RepoInspector />
      <AskDock focusRequest={askFocusRequest} />
    </div>
  );
}
