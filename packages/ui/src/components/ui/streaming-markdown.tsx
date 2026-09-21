import { Streamdown } from '@lobehub/streamdown';
import { type ReactNode, useSyncExternalStore } from 'react';
import { cn } from '../../lib/utils';

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    () => false,
  );
}

function isSafeHttpUrl(href: string | undefined): href is string {
  if (!href) {
    return false;
  }
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!isSafeHttpUrl(href)) {
    return <span>{children}</span>;
  }
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className="text-link underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

const markdownComponents = {
  a: MarkdownLink,
  img: () => null,
  table: () => null,
  thead: () => null,
  tbody: () => null,
  tr: () => null,
  th: () => null,
  td: () => null,
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-body leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc space-y-1 pl-5 text-body leading-relaxed text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-5 text-body leading-relaxed text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-medium">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-caption text-foreground">
      {children}
    </pre>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    if (className) {
      return <code className={cn('font-mono text-caption', className)}>{children}</code>;
    }
    return (
      <code className="rounded-sm bg-muted px-1 py-px font-mono text-caption">{children}</code>
    );
  },
  h1: ({ children }: { children?: ReactNode }) => (
    <p className="font-medium text-body text-foreground">{children}</p>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <p className="font-medium text-body text-foreground">{children}</p>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <p className="font-medium text-body text-foreground">{children}</p>
  ),
};

/**
 * Ask 回答的唯一 Markdown 渲染入口。隔离 `@lobehub/streamdown`，样式只用设计 token。
 */
export function StreamingMarkdown({
  content,
  animated = false,
}: {
  content: string;
  animated?: boolean;
}) {
  const reduceMotion = usePrefersReducedMotion();
  if (content.length === 0) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-3 text-body leading-relaxed text-foreground"
      aria-busy={animated}
      aria-live={animated ? 'off' : undefined}
    >
      <Streamdown
        content={content}
        smoothing={reduceMotion || !animated ? 'realtime' : 'balanced'}
        granularity="word"
        latexGuard={false}
        components={markdownComponents}
      />
    </div>
  );
}
