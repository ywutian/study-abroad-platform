'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

export interface SettingItem {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  type: 'toggle' | 'select' | 'link' | 'action';
  value?: boolean | string;
  options?: { value: string; label: string }[];
  href?: string;
  danger?: boolean;
  onToggle?: (value: boolean) => void;
  onSelect?: (value: string) => void;
  onClick?: () => void;
}

export function SettingItemRow({ item, disabled }: { item: SettingItem; disabled?: boolean }) {
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);
  const Icon = item.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-3 transition-all duration-200',
        disabled && 'cursor-not-allowed',
        !disabled &&
          (item.type === 'link' || item.type === 'action') &&
          'hover:bg-muted cursor-pointer',
        item.danger && !disabled && 'text-destructive hover:bg-destructive/5'
      )}
      role={disabled ? 'group' : undefined}
      aria-disabled={disabled || undefined}
      title={disabled ? t('settings.comingSoonHint') : undefined}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          item.danger ? 'bg-destructive/10' : 'bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.label}</p>
        {item.description && (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      {item.type === 'toggle' &&
        (mounted ? (
          <Switch
            checked={item.value as boolean}
            onCheckedChange={item.onToggle}
            disabled={disabled}
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-6 w-11 shrink-0 rounded-full border border-border bg-muted/70"
          />
        ))}
      {item.type === 'select' && (
        <Select value={item.value as string} onValueChange={item.onSelect} disabled={disabled}>
          <SelectTrigger aria-label={item.label} className="h-9 w-[12rem] min-w-[10rem] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[420px]">
            {item.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {(item.type === 'link' || item.type === 'action') && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );

  if (disabled) return content;
  if (item.type === 'link' && item.href) return <Link href={item.href}>{content}</Link>;
  if (item.type === 'action' && item.onClick) {
    return (
      <button onClick={item.onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
