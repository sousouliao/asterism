import { signInWithGitHub } from '@asterism/db';
import { Button } from '@asterism/ui';
import { ChartColumnIcon, SearchIcon, ShieldCheckIcon, TagIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../components/brand-logo';
import { GitHubIcon } from '../components/github-icon';
import { ThemeToggle } from '../components/theme-toggle';
import { supabase } from '../lib/supabase';

type FeatureIcon = ComponentType<SVGProps<SVGSVGElement>>;

const FEATURES: { icon: FeatureIcon; key: string }[] = [
  { icon: TagIcon, key: 'login.features.tagging' },
  { icon: SearchIcon, key: 'login.features.search' },
  { icon: ChartColumnIcon, key: 'login.features.insights' },
  { icon: ShieldCheckIcon, key: 'login.features.privacy' },
];

const SCOPES = ['login.scopeStars', 'login.scopeMetadata', 'login.scopeProfile'];

export function LoginPage() {
  const { t } = useTranslation();

  function handleSignIn() {
    void signInWithGitHub(supabase, window.location.origin);
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-2">
      <section className="relative flex flex-col justify-between gap-12 bg-background px-8 py-10 lg:px-16 lg:py-16">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="size-7" title={t('app.name')} />
          <span className="font-semibold text-foreground text-xl">{t('app.name')}</span>
        </div>

        <div className="flex max-w-xl flex-col gap-6">
          <h1 className="whitespace-pre-line font-bold text-display text-foreground tracking-tight">
            {t('login.brandTagline')}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {t('login.brandSubtitle')}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {FEATURES.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3 text-body text-muted-foreground">
              <Icon className="size-4 shrink-0 text-link" aria-hidden="true" />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="asterism-glass-surface relative flex flex-col items-center justify-center border-border px-8 py-12 lg:border-l lg:px-16">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <h2 className="font-semibold text-section-title text-card-foreground leading-tight">
              {t('login.getStarted')}
            </h2>
            <p className="text-body text-muted-foreground">{t('login.connectPrompt')}</p>
          </div>

          <Button
            className="h-12 w-full gap-2.5 rounded-lg text-drawer-title"
            onClick={handleSignIn}
          >
            <GitHubIcon className="size-5" />
            {t('login.continueWithGitHub')}
          </Button>

          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-caption text-muted-foreground">
              {t('login.minimalPermissions')}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
            <p className="font-medium text-body text-card-foreground">{t('login.scopesTitle')}</p>
            <ul className="flex flex-col gap-1">
              {SCOPES.map((key) => (
                <li key={key} className="text-body text-muted-foreground">
                  • {t(key)}
                </li>
              ))}
            </ul>
            <p className="pt-1 text-caption text-link">{t('login.privacyNote')}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
