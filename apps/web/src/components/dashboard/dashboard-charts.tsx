import type { DashboardInsights } from '@asterism/core';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@asterism/ui';
import { ArrowRightIcon, FolderPlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';

const trendConfig = {
  count: { label: 'Starred', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const topicConfig = {
  count: { label: 'Repos', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function chartColor(index: number) {
  return `var(--chart-${(index % 5) + 1})`;
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="font-semibold text-drawer-title">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DashboardCharts({ insights }: { insights: DashboardInsights }) {
  const { t } = useTranslation();

  const languageConfig = Object.fromEntries(
    insights.languages.map((entry, index) => [
      entry.name,
      {
        label: entry.name,
        color: chartColor(index),
      },
    ]),
  ) satisfies ChartConfig;

  const totalRepos = insights.archiveSplit.active + insights.archiveSplit.archived;
  const activePct =
    totalRepos > 0 ? Math.round((insights.archiveSplit.active / totalRepos) * 100) : 100;
  const maxCollectionCount = Math.max(...insights.topCollections.map((col) => col.count), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 1. 语言分布 */}
      <ChartCard title={t('dashboard.languageDistribution')}>
        {insights.languages.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={languageConfig} className="aspect-auto h-[260px] w-full">
            <BarChart
              data={insights.languages}
              layout="vertical"
              margin={{ left: 8, right: 36, top: 8, bottom: 8 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.4} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={4}>
                <LabelList
                  dataKey="count"
                  position="right"
                  fontSize={11}
                  className="fill-muted-foreground font-medium"
                />
                {insights.languages.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* 2. 收藏趋势 */}
      <ChartCard title={t('dashboard.starredTrend')}>
        {insights.starredByYear.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
            <AreaChart
              data={insights.starredByYear}
              margin={{ left: 8, right: 20, top: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="starredFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                padding={{ left: 16, right: 16 }}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                fill="url(#starredFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* 3. 热门 Topic：横向条形图平展排布，消除倾斜文字 */}
      <ChartCard title={t('dashboard.topTopics')}>
        {insights.topics.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={topicConfig} className="aspect-auto h-[260px] w-full">
            <BarChart
              data={insights.topics.slice(0, 8)}
              layout="vertical"
              margin={{ left: 8, right: 36, top: 8, bottom: 8 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.4} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-3)" radius={4}>
                <LabelList
                  dataKey="count"
                  position="right"
                  fontSize={11}
                  className="fill-muted-foreground font-medium"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* 4. 活跃状态与集合 */}
      <ChartCard title={t('dashboard.archiveAndTags')}>
        <div className="flex flex-col gap-4">
          {/* 活跃度微型状态条 */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-caption text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {t('dashboard.archiveStatus', {
                  active: insights.archiveSplit.active,
                  archived: insights.archiveSplit.archived,
                })}
              </span>
              <span className="font-semibold text-foreground/90 tabular-nums">
                {activePct}% {t('dashboard.activeRate')}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${activePct}%` }}
              />
            </div>
          </div>

          {/* 集合区域：有集合显示排行进度；无集合展示正向引导 */}
          {insights.topCollections.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="font-medium text-caption text-muted-foreground">
                {t('dashboard.topCollections')}
              </p>
              <ul className="flex flex-col gap-2.5">
                {insights.topCollections.map((collection, index) => (
                  <li key={collection.collectionId} className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between text-caption font-medium">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: chartColor(index) }}
                        />
                        <span className="truncate text-foreground/90">{collection.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {t('dashboard.reposCount', { count: collection.count })}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round((collection.count / maxCollectionCount) * 100)}%`,
                          backgroundColor: chartColor(index),
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center">
              <div className="mb-2 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderPlusIcon className="size-4.5" />
              </div>
              <p className="font-semibold text-caption text-foreground">
                {t('dashboard.createCollectionPrompt')}
              </p>
              <p className="mt-1 max-w-xs text-caption text-muted-foreground">
                {t('dashboard.createCollectionDescription')}
              </p>
              <Button variant="outline" size="xs" asChild className="mt-3 gap-1">
                <Link to="/collections">
                  {t('dashboard.goToCollections')}
                  <ArrowRightIcon className="size-3" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
