import { Skeleton } from '@asterism/ui';

/** 镜像 Resurface 分区的结构节奏：标题行 + 两组标签与卡片网格。 */
export function ResurfaceSectionSkeleton() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-[172px] rounded-lg" />
        <Skeleton className="h-[172px] rounded-lg" />
        <Skeleton className="hidden h-[172px] rounded-lg xl:block" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-[124px] rounded-lg" />
        <Skeleton className="h-[124px] rounded-lg" />
      </div>
    </section>
  );
}
