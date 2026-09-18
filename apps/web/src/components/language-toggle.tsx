import { Button } from '@asterism/ui';
import { useTranslation } from 'react-i18next';
import { changeInterfaceLanguage } from '../i18n';

export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.resolvedLanguage === 'zh-CN';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="font-mono text-caption"
      onClick={() => void changeInterfaceLanguage(isZh ? 'en' : 'zh-CN')}
      aria-label={t('actions.toggleLanguage')}
    >
      {t('languageNames.currentShort')}
    </Button>
  );
}
