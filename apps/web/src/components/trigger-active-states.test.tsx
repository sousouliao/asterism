// @vitest-environment happy-dom

import { buttonVariants, Select, SelectTrigger, SelectValue } from '@asterism/ui';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { FILTER_TRIGGER_ACTIVE_CLASS, FILTER_TRIGGER_CLASS } from './filter-trigger';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('trigger active / open states', () => {
  describe('buttonVariants', () => {
    it('provides data-[state=open] and aria-expanded active states on ghost variant', () => {
      const classes = buttonVariants({ variant: 'ghost' });
      expect(classes).toContain('data-[state=open]:bg-accent');
      expect(classes).toContain('data-[state=open]:text-accent-foreground');
      expect(classes).toContain('aria-expanded:bg-accent');
      expect(classes).toContain('aria-expanded:text-accent-foreground');
    });

    it('provides data-[state=open] and aria-expanded active states on outline variant', () => {
      const classes = buttonVariants({ variant: 'outline' });
      expect(classes).toContain('data-[state=open]:bg-accent');
      expect(classes).toContain('data-[state=open]:text-accent-foreground');
      expect(classes).toContain('aria-expanded:bg-accent');
      expect(classes).toContain('aria-expanded:text-accent-foreground');
    });

    it('provides data-[state=open] and aria-expanded active states on default and secondary variants', () => {
      const defaultClasses = buttonVariants({ variant: 'default' });
      expect(defaultClasses).toContain('data-[state=open]:bg-primary/90');
      expect(defaultClasses).toContain('aria-expanded:bg-primary/90');

      const secondaryClasses = buttonVariants({ variant: 'secondary' });
      expect(secondaryClasses).toContain('data-[state=open]:bg-secondary');
      expect(secondaryClasses).toContain('aria-expanded:bg-secondary');
    });
  });

  describe('filter triggers', () => {
    it('includes open and expanded active styles in FILTER_TRIGGER_CLASS', () => {
      expect(FILTER_TRIGGER_CLASS).toContain('data-[state=open]:bg-accent/70');
      expect(FILTER_TRIGGER_CLASS).toContain('data-[state=open]:text-accent-foreground');
      expect(FILTER_TRIGGER_CLASS).toContain('aria-expanded:bg-accent/70');
      expect(FILTER_TRIGGER_CLASS).toContain('aria-expanded:text-accent-foreground');
    });

    it('includes open and expanded active styles in FILTER_TRIGGER_ACTIVE_CLASS', () => {
      expect(FILTER_TRIGGER_ACTIVE_CLASS).toContain('data-[state=open]:bg-primary/10');
      expect(FILTER_TRIGGER_ACTIVE_CLASS).toContain('aria-expanded:bg-primary/10');
    });
  });

  describe('SelectTrigger', () => {
    it('renders with open-state visual classes for border and background', async () => {
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          <Select>
            <SelectTrigger aria-label="Test Select">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
          </Select>,
        );
      });

      const trigger = container.querySelector<HTMLButtonElement>(
        'button[data-slot="select-trigger"]',
      );
      expect(trigger).not.toBeNull();
      expect(trigger?.className).toContain('data-[state=open]:border-foreground/60');
      expect(trigger?.className).toContain('data-[state=open]:bg-accent/40');

      await act(async () => root.unmount());
      container.remove();
    });
  });
});
