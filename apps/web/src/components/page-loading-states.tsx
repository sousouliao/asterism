import { Card, Skeleton } from '@asterism/ui';
import type { ReactNode } from 'react';
import { LoadingRegion } from './loading-region';
import { RepoListSkeleton } from './repo-skeletons';

const THREE_KEYS = ['a', 'b', 'c'] as const;
const FOUR_KEYS = ['a', 'b', 'c', 'd'] as const;

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex min-h-10 items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-28 shrink-0" /> : null}
    </div>
  );
}

function LoadingFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <LoadingRegion
      label={label}
      className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-hidden px-6 py-6"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6">{children}</div>
    </LoadingRegion>
  );
}

export function BrowseToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
    </div>
  );
}

export function CollectionGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {THREE_KEYS.slice(0, 2).map((key) => (
        <Card key={key} className="flex min-h-[130px] flex-col gap-3 rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-16 rounded-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="mt-auto h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

export function CollectionsRouteLoading({ label }: { label: string }) {
  return (
    <LoadingFrame label={label}>
      <PageHeaderSkeleton action />
      <CollectionGridSkeleton />
    </LoadingFrame>
  );
}

function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FOUR_KEYS.map((key) => (
        <Card key={key} className="flex h-24 flex-col justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function DashboardChartsSkeleton({ count = 2 }: { count?: 2 | 4 }) {
  const keys = count === 4 ? FOUR_KEYS : THREE_KEYS.slice(0, 2);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {keys.map((key) => (
        <Card key={key} className="flex h-72 flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-1 items-end gap-3 px-2 pb-2">
            <Skeleton className="h-[38%] flex-1" />
            <Skeleton className="h-[72%] flex-1" />
            <Skeleton className="h-[54%] flex-1" />
            <Skeleton className="h-[86%] flex-1" />
            <Skeleton className="h-[64%] flex-1" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <>
      <DashboardStatsSkeleton />
      <DashboardChartsSkeleton />
    </>
  );
}

export function DashboardRouteLoading({ label }: { label: string }) {
  return (
    <LoadingFrame label={label}>
      <PageHeaderSkeleton />
      <DashboardContentSkeleton />
    </LoadingFrame>
  );
}

export function CollectionDetailRouteLoading({ label }: { label: string }) {
  return (
    <LoadingFrame label={label}>
      <Skeleton className="h-8 w-40" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <RepoListSkeleton />
    </LoadingFrame>
  );
}

export function ImportExportContentSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="overflow-hidden rounded-lg p-0">
        <div className="flex flex-col gap-2 border-b p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        {THREE_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3 border-b p-5 last:border-b-0">
            <Skeleton className="size-9 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-8 w-24 shrink-0" />
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="min-h-36 w-full flex-1 rounded-lg" />
      </Card>
    </div>
  );
}

export function ImportExportRouteLoading({ label }: { label: string }) {
  return (
    <LoadingFrame label={label}>
      <PageHeaderSkeleton />
      <ImportExportContentSkeleton />
    </LoadingFrame>
  );
}

export function SettingsRouteLoading({ label }: { label: string }) {
  return (
    <LoadingRegion
      label={label}
      className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-hidden px-6 py-6"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-8">
        <PageHeaderSkeleton />
        {THREE_KEYS.map((key) => (
          <section key={key} className="flex flex-col gap-4">
            <Skeleton className="h-5 w-28" />
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-9 w-36" />
            </div>
            <Skeleton className="h-px w-full rounded-none" />
          </section>
        ))}
      </div>
    </LoadingRegion>
  );
}
