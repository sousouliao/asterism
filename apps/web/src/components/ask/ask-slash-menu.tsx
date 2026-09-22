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
        'pointer-events-auto absolute bottom-full mb-2.5 w-full max-w-md left-1/2 -translate-x-1/2',
        'rounded-2xl border border-white/80 dark:border-white/15',
        'bg-gradient-to-b from-white/95 via-white/90 to-white/80 dark:from-[#1A2230]/95 dark:via-[#131A24]/90 dark:to-[#0F141C]/85',
        'p-1.5 backdrop-blur-2xl backdrop-saturate-[190%]',
        'shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95),0_12px_36px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_12px_36px_rgba(0,0,0,0.4)]',
        'animate-in fade-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none z-50',
      )}
    >
      <div className="flex flex-col gap-1">
        {filteredCommands.map((cmd, index) => {
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
                'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer select-none',
                isHighlighted
                  ? 'bg-white/90 dark:bg-white/10 ring-1 ring-primary/30 shadow-xs'
                  : 'text-foreground hover:bg-white/50 dark:hover:bg-white/5',
              )}
            >
              {/* 选项特征：左侧专属等宽命令胶囊 */}
              <span
                className={cn(
                  'shrink-0 font-mono text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors',
                  isHighlighted
                    ? 'bg-primary text-primary-foreground border-transparent shadow-xs'
                    : 'bg-primary/10 text-primary border-primary/20',
                )}
              >
                {cmd.command}
              </span>

              {/* 中间文字 */}
              <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground truncate">
                  {cmd.label.replace(cmd.command, '').trim()}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {cmd.description}
                </span>
              </div>

              {/* 右侧回车提示 */}
              <kbd
                className={cn(
                  'hidden sm:inline-flex h-5 items-center px-1.5 rounded text-[10px] font-mono transition-colors',
                  isHighlighted
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground/60',
                )}
              >
                ↵
              </kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
