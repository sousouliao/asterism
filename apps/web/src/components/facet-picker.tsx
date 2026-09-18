import { Badge, Button, cn, Input, Popover, PopoverContent, PopoverTrigger } from '@asterism/ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import type { LabeledFacetOption } from './facet-options';
import { getVisibleFacetOptions, getVisibleLabeledFacetOptions } from './facet-options';
import {
  FILTER_TRIGGER_ACTIVE_CLASS,
  FILTER_TRIGGER_CHEVRON_CLASS,
  FILTER_TRIGGER_CLASS,
  FILTER_TRIGGER_COUNT_CLASS,
  FILTER_TRIGGER_LABEL_CLASS,
} from './filter-trigger';
import { SearchInputIcon } from './search-input-icon';

interface FacetPickerProps {
  value: string | null;
  options: readonly string[];
  triggerLabel: string;
  allLabel: string;
  searchLabel: string;
  emptyLabel: string;
  resultsHint: (count: number) => string;
  className?: string;
  onValueChange: (value: string | null) => void;
}

export function FacetPicker({
  value,
  options,
  triggerLabel,
  allLabel,
  searchLabel,
  emptyLabel,
  resultsHint,
  className,
  onValueChange,
}: FacetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const visible = useMemo(
    () => getVisibleFacetOptions(options, deferredQuery, value),
    [deferredQuery, options, value],
  );

  const choose = (nextValue: string | null) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            FILTER_TRIGGER_CLASS,
            value !== null && FILTER_TRIGGER_ACTIVE_CLASS,
            className,
          )}
        >
          <span className={FILTER_TRIGGER_LABEL_CLASS}>{value ?? triggerLabel}</span>
          <ChevronDownIcon className={FILTER_TRIGGER_CHEVRON_CLASS} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="border-b p-2">
          <div className="relative">
            <SearchInputIcon className="left-2.5" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              aria-controls={listId}
              className="pl-8"
            />
          </div>
        </div>
        <div id={listId} className="max-h-64 overflow-y-auto p-1">
          {!deferredQuery.trim() ? (
            <button
              type="button"
              aria-pressed={value === null}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => choose(null)}
            >
              <span className="truncate">{allLabel}</span>
              {value === null ? <CheckIcon className="ml-auto size-4" /> : null}
            </button>
          ) : null}
          {visible.items.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => choose(option)}
            >
              <span className="truncate">{option}</span>
              {value === option ? <CheckIcon className="ml-auto size-4" /> : null}
            </button>
          ))}
          {visible.total === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">{emptyLabel}</p>
          ) : null}
        </div>
        {visible.truncated ? (
          <p className="border-t px-3 py-2 text-muted-foreground text-xs">
            {resultsHint(visible.items.length)}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface MultiFacetPickerProps {
  values: readonly string[];
  options: readonly LabeledFacetOption[];
  triggerLabel: string;
  searchLabel: string;
  emptyLabel: string;
  resultsHint: (count: number) => string;
  className?: string;
  onToggle: (value: string) => void;
}

export function MultiFacetPicker({
  values,
  options,
  triggerLabel,
  searchLabel,
  emptyLabel,
  resultsHint,
  className,
  onToggle,
}: MultiFacetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = useMemo(() => [...values], [values]);
  const visible = useMemo(
    () => getVisibleLabeledFacetOptions(options, deferredQuery, selected),
    [deferredQuery, options, selected],
  );
  const selectedCount = values.length;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            FILTER_TRIGGER_CLASS,
            selectedCount > 0 && FILTER_TRIGGER_ACTIVE_CLASS,
            className,
          )}
        >
          <span className={FILTER_TRIGGER_LABEL_CLASS}>{triggerLabel}</span>
          {selectedCount > 0 ? (
            <Badge variant="secondary" className={FILTER_TRIGGER_COUNT_CLASS}>
              {selectedCount}
            </Badge>
          ) : null}
          <ChevronDownIcon className={FILTER_TRIGGER_CHEVRON_CLASS} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="border-b p-2">
          <div className="relative">
            <SearchInputIcon className="left-2.5" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              aria-controls={listId}
              className="pl-8"
            />
          </div>
        </div>
        <div id={listId} className="max-h-64 overflow-y-auto p-1">
          {visible.items.map((option) => {
            const checked = values.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={checked}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => onToggle(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {checked ? <CheckIcon className="ml-auto size-4" /> : null}
              </button>
            );
          })}
          {visible.total === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">{emptyLabel}</p>
          ) : null}
        </div>
        {visible.truncated ? (
          <p className="border-t px-3 py-2 text-muted-foreground text-xs">
            {resultsHint(visible.items.length)}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
