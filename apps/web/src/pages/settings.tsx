import { signOut } from '@asterism/db';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  type Theme,
  useTheme,
} from '@asterism/ui';
import { AlertTriangleIcon, LoaderCircleIcon, LogOutIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { ConfirmDialog } from '../components/confirm-dialog';
import { PageHeader } from '../components/page-header';
import { PendingActionContent } from '../components/pending-action-content';
import { SettingsAskSection } from '../components/settings-ask-section';
import { useEmbeddingBootstrapContext } from '../contexts/embedding-bootstrap-context';
import { changeInterfaceLanguage } from '../i18n';
import { supabase } from '../lib/supabase';

const THEME_OPTIONS: { value: Theme; labelKey: string }[] = [
  { value: 'system', labelKey: 'theme.system' },
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
];

/** 会销毁数据的次级动作，与「退出登录」共用同一套破坏性描边。 */
const DESTRUCTIVE_OUTLINE_CLASS =
  'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive';

function SettingRow({
  title,
  badge,
  description,
  control,
}: {
  title: string;
  badge?: ReactNode;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex flex-col gap-0.5 sm:min-w-0 sm:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground text-sm">{title}</p>
          {badge}
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:ml-auto">
        {control}
      </div>
    </div>
  );
}

function SectionTitle({ children, badge }: { children: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="font-semibold text-section-title text-foreground">{children}</h2>
      {badge}
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { session } = useSession();
  const embedding = useEmbeddingBootstrapContext();
  const [embeddingAction, setEmbeddingAction] = useState<
    'start' | 'retry' | 'rebuild' | 'clear' | null
  >(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const user = session?.user;
  const name =
    (user?.user_metadata?.user_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initial = name.slice(0, 1).toUpperCase() || '?';
  const preparing = !['idle', 'ready', 'degraded'].includes(embedding.phase);
  const embeddingBusy = embeddingAction !== null;
  const embeddingProgress =
    embedding.phase === 'loading-model'
      ? Math.round(embedding.modelProgress)
      : embedding.phase === 'backfilling' && embedding.total > 0
        ? Math.round((embedding.completed / embedding.total) * 100)
        : 0;
  const embeddingBadge = preparing ? (
    <Badge variant="secondary" className="gap-1.5" role="status">
      <LoaderCircleIcon
        className="size-3 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      {t('settings.preparingSearch', { progress: embeddingProgress })}
    </Badge>
  ) : embedding.phase === 'ready' ? (
    <Badge variant="secondary">{t('settings.searchReady')}</Badge>
  ) : embedding.phase === 'degraded' ? (
    <Badge
      variant="outline"
      className="gap-1.5 border-destructive/40 text-destructive"
      role="status"
    >
      <AlertTriangleIcon className="size-3" aria-hidden="true" />
      {t('settings.searchNeedsAttention')}
    </Badge>
  ) : null;
  // 已建立索引时只提供维护动作：重建索引与销毁索引，二者共享同一套按钮几何。
  const maintenance =
    embedding.phase === 'ready'
      ? ({
          action: 'rebuild',
          label: t('settings.rebuildSearch'),
          pendingLabel: t('settings.rebuildSearchPending'),
        } as const)
      : embedding.phase === 'degraded'
        ? ({
            action: 'retry',
            label: t('common.retry'),
            pendingLabel: t('settings.retrySearchPending'),
          } as const)
        : null;

  const runEmbeddingAction = async (action: 'start' | 'retry' | 'rebuild' | 'clear') => {
    setEmbeddingAction(action);
    setEmbeddingError(null);
    try {
      await embedding[action]();
      if (action === 'clear') setClearDialogOpen(false);
    } catch (error) {
      setEmbeddingError(error instanceof Error ? error.message : String(error));
    } finally {
      setEmbeddingAction(null);
    }
  };

  return (
    <div className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <PageHeader title={t('settings.title')} />

        <section className="flex flex-col">
          <SectionTitle>{t('settings.appearance')}</SectionTitle>
          <SettingRow
            title={t('settings.theme')}
            description={t('settings.themeDescription')}
            control={
              <SegmentedControl<Theme>
                value={theme}
                onValueChange={setTheme}
                ariaLabel={t('settings.theme')}
                size="md"
                options={THEME_OPTIONS.map((option) => ({
                  value: option.value,
                  label: t(option.labelKey),
                }))}
              />
            }
          />
          <Separator />
          <SettingRow
            title={t('settings.language')}
            description={t('settings.languageDescription')}
            control={
              <Select
                value={i18n.resolvedLanguage}
                onValueChange={(value) => void changeInterfaceLanguage(value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('languageNames.english')}</SelectItem>
                  <SelectItem value="zh-CN">{t('languageNames.simplifiedChinese')}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </section>

        <section className="flex flex-col">
          <SectionTitle>{t('settings.search')}</SectionTitle>
          <SettingRow
            title={t('settings.semanticSearch')}
            badge={embeddingBadge}
            description={t('settings.semanticSearchDescription')}
            control={
              maintenance ? (
                <>
                  <Button
                    variant="outline"
                    disabled={embeddingBusy}
                    aria-busy={embeddingAction === maintenance.action}
                    onClick={() => void runEmbeddingAction(maintenance.action)}
                  >
                    <PendingActionContent
                      pending={embeddingBusy}
                      idleLabel={maintenance.label}
                      pendingLabel={maintenance.pendingLabel}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    className={DESTRUCTIVE_OUTLINE_CLASS}
                    disabled={embeddingBusy}
                    onClick={() => setClearDialogOpen(true)}
                  >
                    {t('settings.clearSearchModel')}
                  </Button>
                </>
              ) : preparing ? null : embedding.repositoryCount === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t('settings.semanticSearchNeedsRepositories')}
                </p>
              ) : (
                <Button disabled={embeddingBusy} onClick={() => void runEmbeddingAction('start')}>
                  {t('settings.enableSemanticSearch')}
                </Button>
              )
            }
          />
          {embeddingError ? (
            <p role="alert" className="pb-2 text-caption text-destructive">
              {t('settings.searchActionError')}
            </p>
          ) : null}
        </section>

        <SettingsAskSection />

        <section className="flex flex-col gap-3">
          <SectionTitle>{t('settings.account')}</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-foreground text-sm">{name}</span>
                <span className="text-muted-foreground text-xs">{t('settings.connectedVia')}</span>
              </div>
            </div>
            <Button
              variant="outline"
              className={DESTRUCTIVE_OUTLINE_CLASS}
              onClick={() => void signOut(supabase)}
            >
              <LogOutIcon className="size-4" />
              {t('auth.signOut')}
            </Button>
          </div>
        </section>

        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          title={t('settings.clearSearchModelTitle')}
          description={t('settings.clearSearchModelDescription')}
          confirmLabel={t('settings.clearSearchModel')}
          pending={embeddingAction === 'clear'}
          errorMessage={embeddingError ?? undefined}
          onConfirm={() => void runEmbeddingAction('clear')}
        />
      </div>
    </div>
  );
}
