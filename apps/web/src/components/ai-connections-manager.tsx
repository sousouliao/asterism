import { readGenerationCapability } from '@asterism/core';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Switch,
  toast,
} from '@asterism/ui';
import { MoreHorizontalIcon, PencilIcon, PlugZapIcon, PowerIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAiConnections,
  useAiSettings,
  useCreateAiConnection,
  useDeleteAiConnection,
  useDiscoverAiConnectionModels,
  useTestAiConnection,
  useUpdateAiConnection,
  useUpdateAiSettings,
} from '../data/use-ai-connections';
import {
  type AiConnection,
  type AiConnectionStatus,
  getAvailableAiModels,
} from '../lib/ai-connections';
import { AiConnectionFormDialog } from './ai-connection-form-dialog';
import { AiConnectionTestDialog } from './ai-connection-test-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { PendingActionContent } from './pending-action-content';
import { SectionHeader } from './section-header';

type StatusBadgeStyle = { variant: 'secondary' | 'outline'; className?: string };

const STATUS_BADGE: Record<AiConnectionStatus, StatusBadgeStyle> = {
  valid: { variant: 'secondary', className: 'bg-success/15 text-success' },
  invalid: { variant: 'secondary', className: 'bg-destructive/10 text-destructive' },
  untested: { variant: 'outline' },
  disabled: { variant: 'outline', className: 'text-muted-foreground' },
};

function testReasonKey(reason: string | null | undefined): string {
  if (reason === 'unauthorized') return 'settings.ai.testReasons.unauthorized';
  if (reason?.startsWith('blocked_endpoint:')) return 'settings.ai.testReasons.blocked';
  if (
    reason === 'empty_response' ||
    reason === 'unparseable_output' ||
    reason === 'schema_mismatch'
  ) {
    return 'settings.ai.testReasons.format';
  }
  return 'settings.ai.testReasons.network';
}

function formatTestedAt(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ConnectionStatusBadge({ status }: { status: AiConnectionStatus }) {
  const { t } = useTranslation();
  const style: StatusBadgeStyle = STATUS_BADGE[status] ?? { variant: 'outline' };
  return (
    <Badge variant={style.variant} className={style.className}>
      {t(`settings.ai.status.${status}`)}
    </Badge>
  );
}

/**
 * Settings 里的生成连接管理器：连接列表 + 增删改探活，以及活跃连接 / 模型 / 笔记偏好。
 * 自旧 ADR 0018 Registry 的管理器还原（ADR 0043）；连接存储换为浏览器本地库，激活
 * 连接前必须通过 ADR 0042 的出网披露同意（Provider 变更时重新披露）。
 * 区块标题由调用方传入，避免与 Ask 分区再叠一层「生成连接」标题。
 */
export function AiConnectionsManager({
  title,
  description,
  badge,
}: {
  title?: string;
  description?: string;
  badge?: ReactNode;
} = {}) {
  const { t, i18n } = useTranslation();
  const connectionsQuery = useAiConnections();
  const settingsQuery = useAiSettings();
  const createConnection = useCreateAiConnection();
  const updateConnection = useUpdateAiConnection();
  const testConnection = useTestAiConnection();
  const discoverModels = useDiscoverAiConnectionModels();
  const deleteConnection = useDeleteAiConnection();
  const updateSettings = useUpdateAiSettings();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AiConnection | null>(null);
  const [deleting, setDeleting] = useState<AiConnection | null>(null);
  const [testing, setTesting] = useState<AiConnection | null>(null);

  const connections = connectionsQuery.data ?? [];
  const settings = settingsQuery.data;

  const availableModels = useMemo(() => getAvailableAiModels(connections), [connections]);
  const deepseekModels = useMemo(
    () => availableModels.filter((m) => m.provider === 'deepseek'),
    [availableModels],
  );
  const openaiModels = useMemo(
    () => availableModels.filter((m) => m.provider === 'openai'),
    [availableModels],
  );

  const currentDigestModel =
    (settings?.digestModel
      ? availableModels.find((m) => m.model === settings.digestModel)?.model
      : null) ??
    availableModels[0]?.model ??
    '';

  const hasValidConnection = connections.some((connection) => connection.status === 'valid');
  const activeDigestProvider =
    availableModels.find((m) => m.model === currentDigestModel)?.provider ??
    availableModels[0]?.provider;
  const activeProviderName = activeDigestProvider
    ? t(`settings.ai.adapters.${activeDigestProvider}`)
    : '';

  const failSettings = () => toast.error(t('settings.ai.settingsError'));

  const testedConnection =
    testConnection.data?.id === testing?.id ? testConnection.data : undefined;
  const testResultCapability = readGenerationCapability(
    testedConnection?.generationCapability ?? null,
  );
  const testResultStatus = testResultCapability
    ? testResultCapability.ok
      ? 'valid'
      : 'invalid'
    : undefined;
  const testResultMessage = testResultCapability
    ? testResultCapability.ok
      ? t('settings.ai.testValid')
      : t(testReasonKey(testResultCapability.reason))
    : undefined;

  const openCreate = () => {
    createConnection.reset();
    setCreateOpen(true);
  };

  const addButton = <Button onClick={openCreate}>{t('settings.ai.addConnection')}</Button>;

  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <SectionHeader title={title} description={description} badge={badge} actions={addButton} />
      ) : (
        <div className="flex justify-end">{addButton}</div>
      )}

      {connectionsQuery.isLoading ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3 rounded-lg border p-4">
          <span className="sr-only">{t('loading.page')}</span>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : connectionsQuery.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <p className="text-destructive text-sm">{t('settings.ai.loadError')}</p>
          <Button variant="outline" size="sm" onClick={() => void connectionsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : connections.length === 0 ? (
        !title ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="font-medium text-foreground text-sm">{t('settings.ai.emptyTitle')}</p>
            <p className="text-muted-foreground text-sm">{t('settings.ai.emptyDescription')}</p>
          </div>
        ) : null
      ) : (
        <ul className="divide-y rounded-lg border">
          {connections.map((connection) => {
            const capability = readGenerationCapability(connection.generationCapability);
            const testedAt = formatTestedAt(capability?.testedAt ?? null, i18n.language);
            const isConnectionTesting =
              testConnection.isPending && testConnection.variables?.connectionId === connection.id;
            const providerLabel = t(`settings.ai.adapters.${connection.adapter}`);
            const displayName =
              connection.name && connection.name !== connection.adapter
                ? connection.name
                : providerLabel;

            return (
              <li key={connection.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground text-sm">
                      {displayName}
                    </span>
                    <ConnectionStatusBadge status={connection.status} />
                  </div>
                  {connection.credentialHint ? (
                    <div className="font-mono text-caption text-muted-foreground">
                      {connection.credentialHint}
                    </div>
                  ) : null}
                  {capability ? (
                    <p className="text-caption text-muted-foreground">
                      {t('settings.ai.lastTest', {
                        model: capability.model ?? t('settings.ai.unknownModel'),
                        date: testedAt ?? t('settings.ai.unknownTestTime'),
                        result: capability.ok
                          ? t('settings.ai.testPassedShort')
                          : t(testReasonKey(capability.reason)),
                      })}
                      {connection.models && connection.models.length > 0
                        ? ` · ${t('settings.ai.discoveredModelsCount', { count: connection.models.length })}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 图二：卡片自带测试连接按钮，测试时原地 loading 并一并发现模型 */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isConnectionTesting}
                    onClick={() =>
                      testConnection.mutate(
                        { connectionId: connection.id },
                        {
                          onSuccess: (updated) => {
                            const count = updated.models?.length ?? 0;
                            toast.success(t('settings.ai.testSuccessModels', { count }));
                          },
                          onError: () => {
                            toast.error(t('settings.ai.testError'));
                          },
                        },
                      )
                    }
                    aria-label={t('settings.ai.testConnection')}
                  >
                    <PendingActionContent
                      pending={isConnectionTesting}
                      idleLabel={t('settings.ai.testConnection')}
                      pendingLabel={t('settings.ai.testingConnection')}
                      idleIcon={PlugZapIcon}
                    />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground sm:size-8"
                        aria-label={t('common.actions')}
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={updateConnection.isPending}
                        onSelect={() =>
                          updateConnection.mutate(
                            {
                              connectionId: connection.id,
                              enabled: connection.status === 'disabled',
                            },
                            { onError: () => toast.error(t('settings.ai.lifecycleError')) },
                          )
                        }
                      >
                        <PowerIcon className="size-4" />
                        {connection.status === 'disabled'
                          ? t('settings.ai.enable')
                          : t('settings.ai.disable')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          testConnection.reset();
                          discoverModels.reset();
                          setTesting(connection);
                        }}
                      >
                        <PlugZapIcon className="size-4" />
                        {t('settings.ai.test')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          updateConnection.reset();
                          setEditing(connection);
                        }}
                      >
                        <PencilIcon className="size-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          deleteConnection.reset();
                          setDeleting(connection);
                        }}
                      >
                        <Trash2Icon className="size-4" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {connections.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1 sm:min-w-0 sm:flex-1">
              <span className="font-medium text-foreground text-sm">
                {t('settings.ai.digestModelLabel')}
              </span>
              <span className="text-caption text-muted-foreground">
                {t('settings.ai.digestModelDescription')}
              </span>
            </div>
            <div className="w-full sm:w-auto">
              {availableModels.length > 0 ? (
                <Select
                  value={currentDigestModel}
                  onValueChange={(val) => {
                    updateSettings.mutate({ digestModel: val }, { onError: failSettings });
                  }}
                  disabled={updateSettings.isPending}
                >
                  <SelectTrigger
                    className="w-full font-mono text-xs sm:w-56"
                    aria-label={t('settings.ai.digestModelLabel')}
                  >
                    <SelectValue placeholder={t('settings.ai.digestModelPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent align="end" className="w-56 font-mono text-xs">
                    {deepseekModels.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel className="font-sans text-micro text-muted-foreground">
                          DeepSeek
                        </SelectLabel>
                        {deepseekModels.map((item) => (
                          <SelectItem
                            key={`deepseek-${item.model}`}
                            value={item.model}
                            className="font-mono text-xs"
                          >
                            {item.model}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                    {deepseekModels.length > 0 && openaiModels.length > 0 ? (
                      <SelectSeparator />
                    ) : null}
                    {openaiModels.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel className="font-sans text-micro text-muted-foreground">
                          OpenAI
                        </SelectLabel>
                        {openaiModels.map((item) => (
                          <SelectItem
                            key={`openai-${item.model}`}
                            value={item.model}
                            className="font-mono text-xs"
                          >
                            {item.model}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
              ) : (
                <Select disabled>
                  <SelectTrigger
                    className="w-full font-mono text-xs text-muted-foreground sm:w-56"
                    aria-label={t('settings.ai.digestModelLabel')}
                  >
                    <SelectValue placeholder={t('settings.ai.digestModelEmpty')} />
                  </SelectTrigger>
                </Select>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1 sm:min-w-0 sm:flex-1">
              <span className="font-medium text-foreground text-sm">
                {t('settings.ai.includeNotesLabel')}
              </span>
              <span className="text-caption text-muted-foreground">
                {hasValidConnection
                  ? t('settings.ai.includeNotesDescription', {
                      provider: activeProviderName || t('settings.ai.title'),
                    })
                  : t('settings.ai.includeNotesUnavailable')}
              </span>
            </div>
            <Switch
              checked={settings?.includeNotesInAi ?? true}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ includeNotesInAi: checked }, { onError: failSettings })
              }
              disabled={updateSettings.isPending || !hasValidConnection}
              aria-label={t('settings.ai.includeNotesLabel')}
            />
          </div>
        </div>
      ) : null}

      <AiConnectionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        title={t('settings.ai.createTitle')}
        submitLabel={t('settings.ai.addConnection')}
        pending={createConnection.isPending}
        errorMessage={createConnection.isError ? t('settings.ai.saveError') : undefined}
        onSubmit={(values) => {
          createConnection.mutate(
            {
              adapter: values.adapter,
              credential: { apiKey: values.apiKey },
              models: values.models,
              generationCapability: values.generationCapability,
            },
            {
              onSuccess: () => {
                setCreateOpen(false);
              },
            },
          );
        }}
      />

      <AiConnectionFormDialog
        key={editing?.id ?? 'edit'}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        title={t('settings.ai.editTitle')}
        submitLabel={t('common.save')}
        initialAdapter={editing?.adapter}
        pending={updateConnection.isPending}
        errorMessage={updateConnection.isError ? t('settings.ai.saveError') : undefined}
        onSubmit={(values) => {
          if (!editing) return;
          updateConnection.mutate(
            {
              connectionId: editing.id,
              ...(values.apiKey
                ? {
                    credential: { apiKey: values.apiKey },
                    models: values.models,
                    generationCapability: values.generationCapability,
                    status: 'valid',
                  }
                : {}),
            },
            { onSuccess: () => setEditing(null) },
          );
        }}
      />

      <AiConnectionTestDialog
        key={testing?.id ?? 'test'}
        open={Boolean(testing)}
        onOpenChange={(open) => {
          if (!open) setTesting(null);
        }}
        connectionName={
          testing
            ? testing.name && testing.name !== testing.adapter
              ? testing.name
              : t(`settings.ai.adapters.${testing.adapter}`)
            : ''
        }
        pending={testConnection.isPending}
        resultStatus={testResultStatus}
        resultMessage={testResultMessage}
        errorMessage={testConnection.isError ? t('settings.ai.testError') : undefined}
        discoveredModels={discoverModels.data ?? []}
        discovering={discoverModels.isPending}
        discoveryAttempted={discoverModels.isSuccess || discoverModels.isError}
        onDiscover={() => {
          if (testing) discoverModels.mutate(testing.id);
        }}
        onTest={(model) => {
          if (!testing) return;
          testConnection.mutate({ connectionId: testing.id, model });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('settings.ai.deleteTitle', {
          name: deleting
            ? deleting.name && deleting.name !== deleting.adapter
              ? deleting.name
              : t(`settings.ai.adapters.${deleting.adapter}`)
            : '',
        })}
        description={t('settings.ai.deleteDescription')}
        confirmLabel={t('common.delete')}
        pending={deleteConnection.isPending}
        errorMessage={deleteConnection.isError ? t('settings.ai.deleteError') : undefined}
        onConfirm={() => {
          if (!deleting) return;
          deleteConnection.mutate(deleting, { onSuccess: () => setDeleting(null) });
        }}
      />
    </section>
  );
}
