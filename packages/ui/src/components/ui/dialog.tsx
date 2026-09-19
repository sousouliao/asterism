import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

function Dialog({ ...props }: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  overlayClassName,
  children,
  showCloseButton = true,
  closeLabel = 'Close',
  closeDisabled = false,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeLabel?: string;
  closeDisabled?: boolean;
  /** 覆写遮罩样式（如减淡压暗）；不传时保持默认遮罩。 */
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'asterism-glass-overlay data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-5 rounded-lg border p-5 duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-[28rem]',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-slot="dialog-close"
              className="absolute top-5 right-5"
              aria-label={closeLabel}
              disabled={closeDisabled}
            >
              <XIcon className="size-4" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('flex min-h-8 items-center font-semibold text-base leading-none', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
