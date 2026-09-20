import { Badge } from '@asterism/ui';
import { CheckCircle2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { useAskByok } from '../lib/ask-byok';
import { AiConnectionsManager } from './ai-connections-manager';

/**
 * Settings 的 Ask Asterism 分区（ADR 0042 / 0043）：一层区块标题 + 就绪状态，
 * 配置体为生成连接管理器（连接 CRUD + 模型检测 + 探活 + 活跃连接偏好）。
 */
export function SettingsAskSection() {
  const { t } = useTranslation();
  const { session } = useSession();
  const saved = useAskByok(session?.user.id);

  return (
    <AiConnectionsManager
      title={t('settings.ask')}
      description={t('settings.askDescription')}
      badge={
        saved ? (
          <Badge variant="secondary" className="gap-1.5">
            <CheckCircle2Icon className="size-3" aria-hidden="true" />
            {t('settings.askConfigured')}
          </Badge>
        ) : (
          <Badge variant="outline">{t('settings.askNotConfigured')}</Badge>
        )
      }
    />
  );
}
