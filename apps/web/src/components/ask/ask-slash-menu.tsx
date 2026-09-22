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
        // 宽度完全与下方输入框对齐，绝对定位紧贴上方，无硬边框卡片壳
        'pointer-events-auto absolute bottom-full mb-3 inset-x-0 w-full',
        'rounded-2xl border-0',
        'bg-white/60 dark:bg-[#1A2230]/70 backdrop-blur-2xl backdrop-saturate-[190%]',
        'p-1.5 shadow-xl shadow-black/5 dark:shadow-black/40',
        'animate-in fade-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none z-50',
      )}
    >
      <div className="flex flex-col gap-0.5">
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
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 cursor-pointer select-none border-0',
                isHighlighted
                  ? 'bg-white/90 dark:bg-white/10 text-foreground shadow-xs'
                  : 'text-foreground hover:bg-white/40 dark:hover:bg-white/5',
              )}
            >
              {/* 选项特征：左侧纯净等宽命令药丸，无额外线框 */}
              <span
                className={cn(
                  'shrink-0 font-mono text-xs font-semibold px-2 py-0.5 rounded-md transition-colors',
                  isHighlighted
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary',
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

              {/* 右侧回车提示，无边框方盒 */}
              <span
                className={cn(
                  'hidden sm:inline-flex items-center text-xs font-mono transition-colors pr-1',
                  isHighlighted ? 'text-primary font-medium' : 'text-muted-foreground/40',
                )}
              >
                ↵
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
