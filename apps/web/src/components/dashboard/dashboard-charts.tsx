import type { DashboardInsights } from '@asterism/core';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@asterism/ui';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

const archiveConfig = {
  active: { label: 'Active', color: 'var(--chart-2)' },
  archived: { label: 'Archived', color: 'var(--chart-5)' },
} satisfies ChartConfig;

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

  const archiveData = [
    { name: 'active', value: insights.archiveSplit.active, fill: 'var(--color-active)' },
    { name: 'archived', value: insights.archiveSplit.archived, fill: 'var(--color-archived)' },
  ].filter((entry) => entry.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={t('dashboard.languageDistribution')}>
        {insights.languages.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={languageConfig} className="aspect-auto h-[260px] w-full">
            <BarChart
              data={insights.languages}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
            >
              <CartesianGrid horizontal={false} />
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
                {insights.languages.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      <ChartCard title={t('dashboard.starredTrend')}>
        {insights.starredByYear.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
            <AreaChart
              data={insights.starredByYear}
              margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="starredFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
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

      <ChartCard title={t('dashboard.topTopics')}>
        {insights.topics.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">{t('dashboard.noData')}</p>
        ) : (
          <ChartContainer config={topicConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={insights.topics} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      <ChartCard title={t('dashboard.archiveAndTags')}>
        <div className="grid gap-6 sm:grid-cols-2">
          {archiveData.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm sm:col-span-2">
              {t('dashboard.noData')}
            </p>
          ) : (
            <ChartContainer config={archiveConfig} className="aspect-auto h-[220px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={archiveData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  strokeWidth={2}
                >
                  {archiveData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          <div className="flex flex-col gap-3">
            <p className="font-medium text-muted-foreground text-sm">
              {t('dashboard.topCollections')}
            </p>
            {insights.topCollections.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('dashboard.noCollections')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {insights.topCollections.map((collection, index) => (
                  <li
                    key={collection.collectionId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: chartColor(index) }}
                      />
                      <span className="truncate">{collection.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {collection.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
