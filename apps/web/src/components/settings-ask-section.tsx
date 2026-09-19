import { Badge } from '@asterism/ui';
import { CheckCircle2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { useAskByok } from '../lib/ask-byok';
import { AiConnectionsManager } from './ai-connections-manager';

/**
 * Settings 的 Ask Asterism 分区（ADR 0042 / 0043）：头部就绪状态与出网说明，配置体
 * 为还原的生成连接管理器（连接 CRUD + 模型检测 + 探活 + 活跃连接偏好）。
 */
export function SettingsAskSection() {
  const { t } = useTranslation();
  const { session } = useSession();
  const saved = useAskByok(session?.user.id);

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
      <p className="text-muted-foreground text-sm">{t('settings.askDescription')}</p>
      <div className="mt-4">
        <AiConnectionsManager />
      </div>
    </section>
  );
}
