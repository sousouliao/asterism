import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiConnectionStatus } from '../lib/ai-connections';
import { PendingActionContent } from './pending-action-content';

/**
 * 连接探活对话框：输入一个模型名，向该 Provider 发一次最小生成请求。结论在本地
 * 连接记录上更新状态，这里把 valid / invalid / 传输错误分别以可读方式呈现，测试后
 * 保持打开让用户看到结论。自旧 ADR 0018 Registry 的探活对话框原样还原（ADR 0043）。
 */
export function AiConnectionTestDialog({
  open,
  onOpenChange,
  connectionName,
  pending = false,
  resultStatus,
  resultMessage,
  errorMessage,
  discoveredModels = [],
  discovering = false,
  discoveryAttempted = false,
  onDiscover,
  onTest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionName: string;
  pending?: boolean;
  resultStatus?: AiConnectionStatus;
  resultMessage?: string;
  errorMessage?: string;
  discoveredModels?: string[];
  discovering?: boolean;
  discoveryAttempted?: boolean;
  onDiscover: () => void;
  onTest: (model: string) => void;
}) {
  const { t } = useTranslation();
  const fieldId = useId();
  const [model, setModel] = useState('');

  useEffect(() => {
    if (open) {
      setModel('');
    }
  }, [open]);

  const trimmedModel = model.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmedModel.length > 0 && !pending) {
      onTest(trimmedModel);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={pending}>
          <DialogHeader className="pr-10">
            <DialogTitle>{t('settings.ai.testTitle', { name: connectionName })}</DialogTitle>
            <DialogDescription>{t('settings.ai.testDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`${fieldId}-model`}>{t('settings.ai.modelLabel')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || discovering}
                onClick={onDiscover}
                aria-busy={discovering}
              >
                <PendingActionContent
                  pending={discovering}
                  idleLabel={t('settings.ai.discoverModels')}
                  pendingLabel={t('settings.ai.discoveringModels')}
                />
              </Button>
            </div>
            {discoveredModels.length > 0 ? (
              <Select value={model} onValueChange={setModel} disabled={pending}>
                <SelectTrigger className="w-full" aria-label={t('settings.ai.discoveredModels')}>
                  <SelectValue placeholder={t('settings.ai.chooseDiscoveredModel')} />
                </SelectTrigger>
                <SelectContent>
                  {discoveredModels.map((discoveredModel) => (
                    <SelectItem key={discoveredModel} value={discoveredModel}>
                      {discoveredModel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              id={`${fieldId}-model`}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={t('settings.ai.modelPlaceholder')}
              autoFocus
              disabled={pending}
            />
            <p className="text-caption text-muted-foreground">
              {discoveryAttempted && discoveredModels.length === 0
                ? t('settings.ai.discoveryUnavailable')
                : t('settings.ai.manualModelHint')}
            </p>
          </div>

          {resultStatus === 'valid' ? (
            <p role="status" className="flex items-center gap-2 text-caption text-success">
              <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
              {resultMessage ?? t('settings.ai.testValid')}
            </p>
          ) : null}
          {resultStatus === 'invalid' || errorMessage ? (
            <p role="alert" className="flex items-center gap-2 text-caption text-destructive">
              <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              {errorMessage ?? resultMessage ?? t('settings.ai.testInvalid')}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t('common.done')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending || trimmedModel.length === 0}
              aria-busy={pending}
            >
              <PendingActionContent
                pending={pending}
                idleLabel={t('settings.ai.runTest')}
                pendingLabel={t('settings.ai.testing')}
              />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
