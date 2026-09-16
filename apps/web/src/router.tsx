import { lazy, type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAnon, RequireAuth } from './auth/guards';
import {
  CollectionDetailRouteLoading,
  CollectionsRouteLoading,
  DashboardRouteLoading,
  ImportExportRouteLoading,
  SettingsRouteLoading,
} from './components/page-loading-states';
import { AppLayout } from './layouts/app-layout';
import { BrowsePage } from './pages/browse';
import { LoginPage } from './pages/login';
import { RepoBaseRedirect } from './pages/repo-base-redirect';
import { RepoReadmePage } from './pages/repo-readme';

const CollectionsPage = lazy(() =>
  import('./pages/collections').then((module) => ({ default: module.CollectionsPage })),
);
const CollectionDetailPage = lazy(() =>
  import('./pages/collection-detail').then((module) => ({
    default: module.CollectionDetailPage,
  })),
);
const DashboardPage = lazy(() =>
  import('./pages/dashboard').then((module) => ({ default: module.DashboardPage })),
);
const ImportExportPage = lazy(() =>
  import('./pages/import-export').then((module) => ({ default: module.ImportExportPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings').then((module) => ({ default: module.SettingsPage })),
);
type RouteLoadingKind =
  | 'collections'
  | 'collectionDetail'
  | 'dashboard'
  | 'importExport'
  | 'settings';

function PageFallback({ kind }: { kind: RouteLoadingKind }) {
  const { t } = useTranslation();
  const label = t('loading.page');

  switch (kind) {
    case 'collections':
      return <CollectionsRouteLoading label={label} />;
    case 'collectionDetail':
      return <CollectionDetailRouteLoading label={label} />;
    case 'dashboard':
      return <DashboardRouteLoading label={label} />;
    case 'importExport':
      return <ImportExportRouteLoading label={label} />;
    case 'settings':
      return <SettingsRouteLoading label={label} />;
  }
}

function lazyPage(element: ReactNode, kind: RouteLoadingKind) {
  return <Suspense fallback={<PageFallback kind={kind} />}>{element}</Suspense>;
}

function CorpusLabFallback() {
  const { t } = useTranslation();
  return <div className="p-6 text-sm text-muted-foreground">{t('loading.page')}</div>;
}

function createDevelopmentRoutes() {
  const ReadmeCorpusLabPage = lazy(() =>
    import('./pages/readme-corpus-lab').then((module) => ({
      default: module.ReadmeCorpusLabPage,
    })),
  );

  return [
    {
      path: '/dev/readme-corpus',
      element: (
        <Suspense fallback={<CorpusLabFallback />}>
          <ReadmeCorpusLabPage />
        </Suspense>
      ),
    },
  ];
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RequireAnon>
        <LoginPage />
      </RequireAnon>
    ),
  },
  ...(import.meta.env.DEV ? createDevelopmentRoutes() : []),
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <BrowsePage /> },
      { path: 'repos/:owner/:name', element: <RepoBaseRedirect /> },
      { path: 'repos/:owner/:name/readme', element: <RepoReadmePage /> },
      { path: 'collections', element: lazyPage(<CollectionsPage />, 'collections') },
      {
        path: 'collections/:id',
        element: lazyPage(<CollectionDetailPage />, 'collectionDetail'),
      },
      { path: 'tags', element: <Navigate to="/collections" replace /> },
      { path: 'dashboard', element: lazyPage(<DashboardPage />, 'dashboard') },
      { path: 'organization/*', element: <Navigate replace to="/" /> },
      {
        path: 'import-export',
        element: lazyPage(<ImportExportPage />, 'importExport'),
      },
      { path: 'settings', element: lazyPage(<SettingsPage />, 'settings') },
    ],
  },
]);
