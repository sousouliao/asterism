import { cn } from '@asterism/ui';
import { LoaderCircleIcon, type LucideIcon } from 'lucide-react';

/**
 * 按钮内原位反馈：spinner + 动作文案，两个状态叠在同一格内以保持按钮宽度稳定。
 *
 * 注意 pending 文案必须比 idle 文案窄至少一个图标宽度（spinner 16px + gap 8px），
 * 否则待命状态会把按钮永久撑宽，出现多余的左右留白。
 */
export function PendingActionContent({
  pending,
  idleLabel,
  pendingLabel,
  idleIcon: IdleIcon,
  iconClassName,
}: {
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
  idleIcon?: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <span className="inline-grid items-center justify-items-center">
      <span
        aria-hidden={pending}
        className={cn(
          'col-start-1 row-start-1 inline-flex items-center gap-2',
          pending && 'invisible',
        )}
      >
        {IdleIcon ? <IdleIcon className={cn('size-4', iconClassName)} aria-hidden="true" /> : null}
        {idleLabel}
      </span>
      <span
        aria-hidden={!pending}
        className={cn(
          'col-start-1 row-start-1 inline-flex items-center gap-2',
          !pending && 'invisible',
        )}
      >
        <LoaderCircleIcon
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {pendingLabel}
      </span>
    </span>
  );
}
