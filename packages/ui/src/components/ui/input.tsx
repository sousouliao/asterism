import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-8 w-full min-w-0 rounded-md border border-input bg-[var(--glass-surface)] px-3 py-1 text-body shadow-[inset_0_1px_0_var(--glass-highlight)] outline-none backdrop-blur-[8px] transition-[color,background-color,border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out-quart)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-foreground/60',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
