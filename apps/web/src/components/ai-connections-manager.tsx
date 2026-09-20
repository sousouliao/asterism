import { readGenerationCapability, readTestedModel } from '@asterism/core';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  toast,
} from '@asterism/ui';
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  PowerIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
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
import type { AiConnection, AiConnectionStatus } from '../lib/ai-connections';
import { readAskConsent } from '../lib/ask-byok';
import { AiConnectionFormDialog } from './ai-connection-form-dialog';
import { AiConnectionTestDialog } from './ai-connection-test-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { EmptyState } from './empty-state';
import { SectionHeader } from './section-header';

const NONE_VALUE = '__none__';

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
  const { session } = useSession();
  const userId = session?.user.id;
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
  const [pendingActivation, setPendingActivation] = useState<{ connectionId: string } | null>(null);

  const connections = connectionsQuery.data ?? [];
  const settings = settingsQuery.data;

  const activeConnectionId = settings?.generationConnectionId ?? null;

  const failSettings = () => toast.error(t('settings.ai.settingsError'));

  const selectableConnections = connections.filter(
    (connection) => connection.status === 'valid' || connection.id === activeConnectionId,
  );

  const activeConnection = connections.find((connection) => connection.id === activeConnectionId);
  const activeProviderName = activeConnection
    ? t(`settings.ai.adapters.${activeConnection.adapter}`)
    : '';
  const activeModel = readTestedModel(activeConnection?.generationCapability ?? null);

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

  /** 激活连接：Provider 与已同意的不一致时先走 ADR 0042 出网披露。 */
  const activateConnection = (connectionId: string | null) => {
    if (connectionId === null) {
      updateSettings.mutate({ generationConnectionId: null }, { onError: failSettings });
      return;
    }
    const connection = connections.find((candidate) => candidate.id === connectionId);
    if (!connection) {
      return;
    }
    // 同意按 Provider 生效（披露内容只与 Provider 有关）；换同 Provider 的另一条
    // 连接时直接沿用，激活会把同意重新绑定到新连接。
    if (readAskConsent(userId ?? '')?.consentedProvider === connection.adapter) {
      updateSettings.mutate({ generationConnectionId: connectionId }, { onError: failSettings });
      return;
    }
    setPendingActivation({ connectionId });
  };

  const pendingActivationConnection = pendingActivation
    ? connections.find((candidate) => candidate.id === pendingActivation.connectionId)
    : undefined;

  const addButton =
    connections.length > 0 ? (
      <Button size="sm" onClick={openCreate}>
        <PlusIcon className="size-4" />
        {t('settings.ai.addConnection')}
      </Button>
    ) : null;

  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <SectionHeader title={title} description={description} badge={badge} actions={addButton} />
      ) : addButton ? (
        <div className="flex justify-end">{addButton}</div>
      ) : null}

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
        <div className="rounded-lg border">
          <EmptyState
            icon={SparklesIcon}
            title={t('settings.ai.emptyTitle')}
            description={t('settings.ai.emptyDescription')}
            action={
              <Button onClick={openCreate}>
                <PlusIcon className="size-4" />
                {t('settings.ai.addConnection')}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {connections.map((connection) => {
            const capability = readGenerationCapability(connection.generationCapability);
            const testedAt = formatTestedAt(capability?.testedAt ?? null, i18n.language);
            return (
              <li key={connection.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground text-sm">
                      {connection.name}
                    </span>
                    <ConnectionStatusBadge status={connection.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
                    <span>{t(`settings.ai.adapters.${connection.adapter}`)}</span>
                    {connection.credentialHint ? (
                      <span className="font-mono">{connection.credentialHint}</span>
                    ) : null}
                  </div>
                  {capability ? (
                    <p className="text-caption text-muted-foreground">
                      {t('settings.ai.lastTest', {
                        model: capability.model ?? t('settings.ai.unknownModel'),
                        date: testedAt ?? t('settings.ai.unknownTestTime'),
                        result: capability.ok
                          ? t('settings.ai.testPassedShort')
                          : t(testReasonKey(capability.reason)),
                      })}
                    </p>
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-muted-foreground sm:size-8"
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
              </li>
            );
          })}
        </ul>
      )}

      {connections.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="ai-active-connection" className="text-foreground text-sm">
              {t('settings.ai.activeConnectionLabel')}
            </Label>
            <Select
              disabled={updateSettings.isPending}
              value={activeConnectionId ?? NONE_VALUE}
              onValueChange={(value) => activateConnection(value === NONE_VALUE ? null : value)}
            >
              <SelectTrigger id="ai-active-connection" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t('settings.ai.activeConnectionNone')}</SelectItem>
                {selectableConnections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground text-sm">
                {t('settings.ai.modelLabel')}
              </span>
              <span className="text-caption text-muted-foreground">
                {t('settings.ai.modelHint')}
              </span>
            </div>
            <span
              className={
                activeModel ? 'font-mono text-foreground text-sm' : 'text-muted-foreground text-sm'
              }
            >
              {activeModel ?? t('settings.ai.modelUntested')}
            </span>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground text-sm">
                {t('settings.ai.includeNotesLabel')}
              </span>
              <span className="text-caption text-muted-foreground">
                {activeConnection
                  ? t('settings.ai.includeNotesDescription', { provider: activeProviderName })
                  : t('settings.ai.includeNotesUnavailable')}
              </span>
            </div>
            <SegmentedControl<'on' | 'off'>
              value={settings?.includeNotesInAi ? 'on' : 'off'}
              onValueChange={(value) =>
                updateSettings.mutate(
                  { includeNotesInAi: value === 'on' },
                  { onError: failSettings },
                )
              }
              ariaLabel={t('settings.ai.includeNotesLabel')}
              options={[
                {
                  value: 'off',
                  label: t('settings.ai.toggleOff'),
                  disabled: updateSettings.isPending,
                },
                {
                  value: 'on',
                  label: t('settings.ai.toggleOn'),
                  disabled: updateSettings.isPending || !activeConnection,
                },
              ]}
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
              name: values.name,
              credential: { apiKey: values.apiKey },
            },
            { onSuccess: () => setCreateOpen(false) },
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
        initialName={editing?.name ?? ''}
        pending={updateConnection.isPending}
        errorMessage={updateConnection.isError ? t('settings.ai.saveError') : undefined}
        onSubmit={(values) => {
          if (!editing) return;
          updateConnection.mutate(
            {
              connectionId: editing.id,
              name: values.name,
              ...(values.apiKey ? { credential: { apiKey: values.apiKey } } : {}),
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
        connectionName={testing?.name ?? ''}
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
        title={t('settings.ai.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('settings.ai.deleteDescription')}
        confirmLabel={t('common.delete')}
        pending={deleteConnection.isPending}
        errorMessage={deleteConnection.isError ? t('settings.ai.deleteError') : undefined}
        onConfirm={() => {
          if (!deleting) return;
          deleteConnection.mutate(deleting, { onSuccess: () => setDeleting(null) });
        }}
      />

      {/* 出网披露同意（ADR 0042）：激活新 Provider 的连接前确认，不用删除语义的 ConfirmDialog。 */}
      <Dialog
        open={Boolean(pendingActivation)}
        onOpenChange={(open) => !open && setPendingActivation(null)}
      >
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader className="pr-10">
            <DialogTitle>
              {t('settings.askConsentTitle', {
                provider: pendingActivationConnection
                  ? t(`settings.ai.adapters.${pendingActivationConnection.adapter}`)
                  : '',
              })}
            </DialogTitle>
            <DialogDescription>
              {t('settings.askConsentDescription', {
                provider: pendingActivationConnection
                  ? t(`settings.ai.adapters.${pendingActivationConnection.adapter}`)
                  : '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingActivation(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!pendingActivation) return;
                updateSettings.mutate(
                  { generationConnectionId: pendingActivation.connectionId },
                  {
                    onSuccess: () => setPendingActivation(null),
                    onError: failSettings,
                  },
                );
              }}
            >
              {t('settings.askConsentConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
