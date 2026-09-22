import { signOut } from '@asterism/db';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@asterism/ui';
import {
  CircleAlertIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { useSyncStars } from '../data/use-sync-stars';
import { supabase } from '../lib/supabase';

export function UserMenu() {
  const { t } = useTranslation();
  const { session } = useSession();
  const sync = useSyncStars();
  const { reconnectPending, requiresReconnect, reconnect } = sync;
  const user = session?.user;
  const name =
    (user?.user_metadata?.user_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initial = name.slice(0, 1).toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t('topbar.account')}
        >
          <Avatar className="size-7">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(requiresReconnect ? 'w-64' : 'w-48')}>
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {requiresReconnect ? (
          <>
            <div className="px-2 py-2">
              <div className="flex items-center gap-2 font-medium text-body">
                <CircleAlertIcon className="size-4 shrink-0 text-warning" />
                <span>{t('sync.reconnectTitle')}</span>
              </div>
              <p className="mt-1 pl-6 text-muted-foreground text-xs leading-4">
                {t('sync.reconnectDescription')}
              </p>
            </div>
            <DropdownMenuItem
              className="text-foreground focus:bg-warning/10"
              disabled={reconnectPending}
              onClick={() => void reconnect()}
            >
              {reconnectPending ? (
                <LoaderCircleIcon className="size-4 animate-spin text-warning motion-reduce:animate-none" />
              ) : (
                <LogInIcon className="size-4 text-warning" />
              )}
              {reconnectPending ? t('sync.reconnecting') : t('sync.reconnectAction')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuItem disabled={sync.isPending} onClick={() => sync.sync()}>
              <RefreshCwIcon
                className={cn(
                  'size-4',
                  sync.isPending && 'animate-spin motion-reduce:animate-none',
                )}
              />
              {sync.isPending ? t('sync.syncing') : t('topbar.sync')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onClick={() => void signOut(supabase)}>
          <LogOutIcon className="size-4" />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
