import { cn } from '@asterism/ui';
import { HistoryIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type AskSlashCommandId = 'history' | 'new';

export interface AskSlashCommandItem {
  id: AskSlashCommandId;
  command: string;
  label: string;
  description: string;
  icon: typeof HistoryIcon;
}

interface AskSlashMenuProps {
  /** 当前输入框的值（以 / 开头）。 */
  query: string;
  /** 当前键盘高亮项索引。 */
  highlightedIndex: number;
  /** 高亮项变更回调。 */
  onHighlightChange: (index: number) => void;
  /** 选择命令回调。 */
  onSelectCommand: (commandId: AskSlashCommandId) => void;
}

export function AskSlashMenu({
  query,
  highlightedIndex,
  onHighlightChange,
  onSelectCommand,
}: AskSlashMenuProps) {
  const { t } = useTranslation();

  const commands: AskSlashCommandItem[] = useMemo(
    () => [
      {
        id: 'history',
        command: '/history',
        label: t('ask.commands.history'),
        description: t('ask.commands.historyDesc'),
        icon: HistoryIcon,
      },
      {
        id: 'new',
        command: '/new',
        label: t('ask.commands.new'),
        description: t('ask.commands.newDesc'),
        icon: MessageSquarePlusIcon,
      },
    ],
    [t],
  );

  const cleanQuery = query.trim().toLowerCase();
  const filteredCommands = useMemo(() => {
    if (cleanQuery === '/' || !cleanQuery) {
      return commands;
    }
    const token = cleanQuery.startsWith('/') ? cleanQuery.slice(1) : cleanQuery;
    return commands.filter(
      (cmd) =>
        cmd.id.includes(token) ||
        cmd.command.toLowerCase().includes(token) ||
        cmd.label.toLowerCase().includes(token),
    );
  }, [commands, cleanQuery]);

  // 当过滤列表变化时确保高亮索引在合法边界内
  useEffect(() => {
    if (filteredCommands.length === 0) {
      onHighlightChange(0);
    } else if (highlightedIndex >= filteredCommands.length) {
      onHighlightChange(filteredCommands.length - 1);
    }
  }, [filteredCommands.length, highlightedIndex, onHighlightChange]);

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      role="menu"
      aria-label="Slash commands"
      className={cn(
        'pointer-events-auto absolute bottom-full mb-2 w-full max-w-md left-1/2 -translate-x-1/2',
        'rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-1.5 backdrop-blur-2xl shadow-xl shadow-black/5 dark:shadow-black/40',
        'animate-in fade-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none z-50',
      )}
    >
      <div className="flex flex-col gap-0.5">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon;
          const isHighlighted = index === highlightedIndex;
          return (
            <button
              key={cmd.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-highlighted={isHighlighted ? 'true' : undefined}
              onPointerEnter={() => onHighlightChange(index)}
              onClick={() => onSelectCommand(cmd.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer select-none',
                isHighlighted
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--accent)]/60',
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  isHighlighted
                    ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]',
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                    {cmd.command}
                  </span>
                  <span className="text-xs text-[var(--foreground)] truncate">
                    {cmd.label.replace(cmd.command, '').trim()}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                  {cmd.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
