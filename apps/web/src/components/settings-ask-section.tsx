import {
  ASK_PROVIDERS,
  type AskProviderDefinition,
  type AskProviderId,
  findAskProvider,
} from '@asterism/core';
import {
  Badge,
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
import { CheckCircle2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { clearAskByok, saveAskByok, useAskByok } from '../lib/ask-byok';
import { ConfirmDialog } from './confirm-dialog';

interface AskDraft {
  provider: AskProviderId;
  model: string;
  providerKey: string;
}

/** ASK_PROVIDERS 在 noUncheckedIndexedAccess 下索引可能为 undefined；白名单首项恒存在。 */
const FALLBACK_PROVIDER = ASK_PROVIDERS[0] as AskProviderDefinition;

function draftFromSaved(saved: ReturnType<typeof useAskByok>): AskDraft {
  return {
    provider: saved?.provider ?? FALLBACK_PROVIDER.id,
    model: saved?.model ?? FALLBACK_PROVIDER.defaultModel,
    providerKey: saved?.providerKey ?? '',
  };
}

/** Settings 的 Ask Asterism 分区：BYOK 配置、出网披露同意与移除（ADR 0042）。 */
export function SettingsAskSection() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const saved = useAskByok(userId);
  const [draft, setDraft] = useState<AskDraft>(() => draftFromSaved(saved));
  const [consentOpen, setConsentOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    setDraft(draftFromSaved(saved));
  }, [saved]);

  const providerDefinition = findAskProvider(draft.provider) ?? FALLBACK_PROVIDER;
  const complete = draft.model.trim().length > 0 && draft.providerKey.trim().length > 0;
  // 同意与 Provider 绑定：首次保存或更换 Provider 时重新披露，仅更新模型 / key 时静默保存。
  const consentNeeded =
    !saved || saved.provider !== draft.provider || saved.consentedProvider !== draft.provider;
  const providerLabel = t(providerDefinition.labelKey);

  const commit = () => {
    if (!userId || !complete) {
      return;
    }
    saveAskByok(userId, {
      provider: draft.provider,
      model: draft.model.trim(),
      providerKey: draft.providerKey.trim(),
      ...(consentNeeded
        ? {}
        : { consentedAt: saved.consentedAt, consentedProvider: saved.consentedProvider }),
    });
    setConsentOpen(false);
  };

  const handleProviderChange = (provider: AskProviderId) => {
    setDraft((current) => {
      const previousDefault = findAskProvider(current.provider)?.defaultModel ?? '';
      const nextDefault = findAskProvider(provider)?.defaultModel ?? '';
      return {
        provider,
        // 模型仍是上一个 Provider 默认值或空时跟随切换，用户手填的模型名保持不动。
        model:
          !current.model.trim() || current.model.trim() === previousDefault
            ? nextDefault
            : current.model,
        providerKey: current.providerKey,
      };
    });
  };

  return (
    <section className="flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-semibold text-section-title text-foreground">{t('settings.ask')}</h2>
        {saved ? (
          <Badge variant="secondary" className="gap-1.5">
            <CheckCircle2Icon className="size-3" aria-hidden="true" />
            {t('settings.askConfigured')}
          </Badge>
        ) : (
          <Badge variant="outline">{t('settings.askNotConfigured')}</Badge>
        )}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">{t('settings.askDescription')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ask-provider">{t('settings.askProvider')}</Label>
            <Select
              value={draft.provider}
              onValueChange={(value) => handleProviderChange(value as AskProviderId)}
            >
              <SelectTrigger id="ask-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASK_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {t(provider.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ask-model">{t('settings.askModel')}</Label>
            <Input
              id="ask-model"
              value={draft.model}
              placeholder={providerDefinition.defaultModel}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ask-key">{t('settings.askApiKey')}</Label>
          <Input
            id="ask-key"
            type="password"
            autoComplete="off"
            value={draft.providerKey}
            onChange={(event) => setDraft({ ...draft, providerKey: event.target.value })}
            className="font-mono"
          />
          <p className="text-muted-foreground text-xs">{t('settings.askApiKeyHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!complete}
            onClick={() => (consentNeeded ? setConsentOpen(true) : commit())}
          >
            {t('common.save')}
          </Button>
          {saved ? (
            <Button variant="outline" onClick={() => setRemoveOpen(true)}>
              {t('settings.askRemove')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* 出网披露同意：确认后才写入配置（ADR 0042），不用删除语义的 ConfirmDialog。 */}
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader className="pr-10">
            <DialogTitle>{t('settings.askConsentTitle', { provider: providerLabel })}</DialogTitle>
            <DialogDescription>
              {t('settings.askConsentDescription', { provider: providerLabel })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConsentOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" disabled={!complete} onClick={commit}>
              {t('settings.askConsentConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t('settings.askRemoveTitle')}
        description={t('settings.askRemoveDescription')}
        confirmLabel={t('settings.askRemove')}
        onConfirm={() => {
          if (userId) {
            clearAskByok(userId);
          }
          setRemoveOpen(false);
        }}
      />
    </section>
  );
}
