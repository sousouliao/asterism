import { cn } from '@asterism/ui';
import {
  ChartColumnIcon,
  DownloadIcon,
  FolderIcon,
  LayoutGridIcon,
  SettingsIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { BrandLogo } from './brand-logo';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const NAV_ITEMS: { to: string; key: string; icon: IconType; end?: boolean }[] = [
  { to: '/', key: 'nav.browse', icon: LayoutGridIcon, end: true },
  { to: '/dashboard', key: 'nav.dashboard', icon: ChartColumnIcon },
  { to: '/collections', key: 'nav.collections', icon: FolderIcon },
  { to: '/import-export', key: 'nav.importExport', icon: DownloadIcon },
  { to: '/settings', key: 'nav.settings', icon: SettingsIcon },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <BrandLogo className="size-6" title={t('app.name')} />
        <span className="font-semibold text-base text-foreground">{t('app.name')}</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-md px-3 text-body outline-none transition-[color,background-color,transform] duration-150 [transition-timing-function:var(--ease-out-quart)] active:translate-y-px motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50',
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground [&_svg]:text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
