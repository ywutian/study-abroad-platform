'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { X, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { SuggestionGroup } from '@study-abroad/shared';

interface ComboboxTagInputProps {
  suggestions: SuggestionGroup[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  placeholder?: string;
  noMatchText?: string;
  maxTags?: number;
  className?: string;
}

export function ComboboxTagInput({
  suggestions,
  selected,
  onSelectedChange,
  placeholder,
  noMatchText = 'No matches found',
  maxTags,
  className,
}: ComboboxTagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const addTag = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || selectedSet.has(trimmed)) return;
      if (maxTags && selected.length >= maxTags) return;
      onSelectedChange([...selected, trimmed]);
      setInputValue('');
    },
    [selected, selectedSet, onSelectedChange, maxTags]
  );

  const removeTag = React.useCallback(
    (value: string) => {
      onSelectedChange(selected.filter((s) => s !== value));
    },
    [selected, onSelectedChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ',' || (e.key === 'Enter' && inputValue.trim() && !e.nativeEvent.isComposing)) {
        e.preventDefault();
        addTag(inputValue);
      }
      if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
        removeTag(selected[selected.length - 1]);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [inputValue, selected, addTag, removeTag]
  );

  const handleSelect = React.useCallback(
    (value: string) => {
      if (selectedSet.has(value)) {
        removeTag(value);
      } else {
        addTag(value);
      }
      // Keep focus in input after selection
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [selectedSet, addTag, removeTag]
  );

  // Filter out selected items from suggestions
  const filteredGroups = React.useMemo(
    () =>
      suggestions
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !selectedSet.has(item.value)),
        }))
        .filter((group) => group.items.length > 0),
    [suggestions, selectedSet]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Command shouldFilter={true} className="overflow-visible bg-transparent">
        <PopoverAnchor asChild>
          <div
            className={cn(
              'flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background transition-colors',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              className
            )}
            onClick={() => inputRef.current?.focus()}
          >
            {selected.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <CommandPrimitive.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selected.length === 0 ? placeholder : undefined}
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px] h-7"
            />
          </div>
        </PopoverAnchor>

        {open && (
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList className="max-h-[220px]">
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                {noMatchText}
              </CommandEmpty>
              {filteredGroups.map((group) => (
                <CommandGroup key={group.group} heading={group.group}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.value}
                      // Include labelZh in value for bilingual fuzzy search
                      value={`${item.value} ${item.labelZh}`}
                      onSelect={() => handleSelect(item.value)}
                    >
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.labelZh}</span>
                      {selectedSet.has(item.value) && (
                        <Check className="ml-2 h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </PopoverContent>
        )}
      </Command>
    </Popover>
  );
}
