import { ASK_PROVIDERS, type AskProviderId } from '@asterism/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@asterism/ui';
import { CheckCircle2Icon, PlugZapIcon, XCircleIcon } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type TestAndDiscoverOutcome, useTestAndDiscoverProbe } from '../data/use-ai-connections';
import { PendingActionContent } from './pending-action-content';

export interface AiConnectionFormValues {
  adapter: AskProviderId;
  apiKey: string;
  models?: string[];
  generationCapability?: unknown;
}

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

/**
 * 生成连接的新建 / 编辑对话框。
 * - 仅支持 OpenAI 与 DeepSeek 白名单
 * - 无需手动输入名称（自动以 Provider 为标识）
 * - 必须在弹窗内测试通过后才允许保存，测试时同步探测并拉取可用模型
 */
export function AiConnectionFormDialog({
  open,
  onOpenChange,
  mode,
  title,
  submitLabel,
  initialAdapter = 'deepseek',
  pending = false,
  errorMessage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  title: string;
  submitLabel: string;
  initialAdapter?: AskProviderId;
  pending?: boolean;
  errorMessage?: string;
  onSubmit: (values: AiConnectionFormValues) => void;
}) {
  const { t } = useTranslation();
  const fieldId = useId();
  const [adapter, setAdapter] = useState<AskProviderId>(initialAdapter);
  const [apiKey, setApiKey] = useState('');
  const [testOutcome, setTestOutcome] = useState<TestAndDiscoverOutcome | null>(null);

  const testProbe = useTestAndDiscoverProbe();
  const resetTestProbe = testProbe.reset;

  useEffect(() => {
    if (open) {
      setAdapter(initialAdapter);
      setApiKey('');
      setTestOutcome(null);
      resetTestProbe();
    }
  }, [open, initialAdapter, resetTestProbe]);

  const trimmedKey = apiKey.trim();
  const keyEntered = trimmedKey.length > 0;
  const isTestedAndValid = testOutcome?.ok === true;

  // 编辑态下若未修改 key 则允许直接保存；新建或修改了 key 则必须测试通过
  const canSubmit = mode === 'edit' ? !keyEntered || isTestedAndValid : isTestedAndValid;

  const handleAdapterChange = (value: AskProviderId) => {
    setAdapter(value);
    setTestOutcome(null);
    testProbe.reset();
  };

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    setTestOutcome(null);
    testProbe.reset();
  };

  const handleRunTest = () => {
    if (!keyEntered || testProbe.isPending) {
      return;
    }
    testProbe.mutate(
      { provider: adapter, apiKey: trimmedKey },
      {
        onSuccess: (outcome) => {
          setTestOutcome(outcome);
        },
        onError: () => {
          setTestOutcome({
            ok: false,
            status: 'failed',
            reason: 'network',
            model: '',
            models: [],
            testedAt: new Date().toISOString(),
          });
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || testProbe.isPending) {
      return;
    }
    if (!canSubmit) {
      if (keyEntered) {
        handleRunTest();
      }
      return;
    }
    const generationCapability = testOutcome
      ? {
          ok: testOutcome.ok,
          reason: testOutcome.reason,
          model: testOutcome.model,
          testedAt: testOutcome.testedAt,
        }
      : undefined;

    onSubmit({
      adapter,
      apiKey: trimmedKey,
      models: testOutcome?.models,
      generationCapability,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending && !testProbe.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={pending}>
          <DialogHeader className="pr-10">
            <DialogTitle>{title}</DialogTitle>
            {errorMessage ? (
              <p role="alert" className="text-caption text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-adapter`}>{t('settings.ai.providerLabel')}</Label>
            <Select
              value={adapter}
              onValueChange={(val) => handleAdapterChange(val as AskProviderId)}
              disabled={mode === 'edit' || pending || testProbe.isPending}
            >
              <SelectTrigger id={`${fieldId}-adapter`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASK_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {t(`settings.ai.adapters.${provider.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${fieldId}-key`}>{t('settings.ai.apiKeyLabel')}</Label>
              {isTestedAndValid ? (
                <span className="flex items-center gap-1 text-micro font-medium text-success">
                  <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                  {t('settings.ai.testPassedShort')}
                </span>
              ) : null}
            </div>

            <Input
              id={`${fieldId}-key`}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => handleKeyChange(event.target.value)}
              placeholder={
                mode === 'edit' ? t('settings.ai.apiKeyKeep') : t('settings.ai.apiKeyPlaceholder')
              }
              autoFocus
              disabled={pending || testProbe.isPending}
              className="w-full font-mono text-xs"
            />
            <p className="text-caption text-muted-foreground">{t('settings.ai.apiKeyHint')}</p>

            {testOutcome ? (
              testOutcome.ok ? (
                <div
                  role="status"
                  className="mt-1 flex flex-col gap-1.5 rounded-lg border border-success/30 bg-success/10 p-3 text-caption text-success"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {t('settings.ai.testSuccessModels', { count: testOutcome.models.length })}
                    </span>
                  </div>
                  {testOutcome.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {testOutcome.models.slice(0, 8).map((model) => (
                        <span
                          key={model}
                          className="rounded bg-success/15 px-2 py-0.5 font-mono text-micro text-foreground"
                        >
                          {model}
                        </span>
                      ))}
                      {testOutcome.models.length > 8 ? (
                        <span className="self-center px-1 text-micro text-muted-foreground">
                          +{testOutcome.models.length - 8}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  role="alert"
                  className="mt-1 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-caption text-destructive"
                >
                  <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {testOutcome.reason === 'unauthorized'
                      ? t('settings.ai.testReasons.unauthorized')
                      : t(testReasonKey(testOutcome.reason))}
                  </span>
                </div>
              )
            ) : null}
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!keyEntered || pending || testProbe.isPending}
              onClick={handleRunTest}
              aria-busy={testProbe.isPending}
            >
              <PendingActionContent
                pending={testProbe.isPending}
                idleLabel={
                  isTestedAndValid ? t('settings.ai.retest') : t('settings.ai.testConnection')
                }
                pendingLabel={t('settings.ai.testingConnection')}
                idleIcon={PlugZapIcon}
              />
            </Button>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending || testProbe.isPending}
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={pending || !canSubmit || testProbe.isPending}
                aria-busy={pending}
              >
                <PendingActionContent
                  pending={pending}
                  idleLabel={submitLabel}
                  pendingLabel={t('common.saving')}
                />
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
