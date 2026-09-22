import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-[color,background-color,border-color,box-shadow,transform,filter] duration-150 [transition-timing-function:var(--ease-out-quart)] active:translate-y-px active:scale-[0.98] active:brightness-95 motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 data-[state=open]:bg-primary/90 aria-expanded:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-[var(--glass-border)] bg-[var(--glass-surface)] shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[8px] hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        secondary:
          'border border-[var(--glass-border)] bg-[var(--glass-surface)] text-secondary-foreground shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[8px] hover:bg-secondary data-[state=open]:bg-secondary aria-expanded:bg-secondary',
        ghost:
          'hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: 'h-8 rounded-md gap-1.5 px-3 text-body has-[>svg]:px-2.5',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export type { ButtonProps };
export { Button, buttonVariants };
