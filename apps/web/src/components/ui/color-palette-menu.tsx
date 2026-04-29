'use client';

import { Check, Palette } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  COLOR_PALETTES,
  getColorThemeDescription,
  getColorThemeLabel,
  type ColorPalette,
} from '@study-abroad/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useColorPalette } from '@/hooks/use-color-palette';
import { cn } from '@/lib/utils';

type ColorPaletteMenuProps = {
  className?: string;
  align?: 'start' | 'center' | 'end';
};

export function ColorPaletteMenu({ className, align = 'end' }: ColorPaletteMenuProps) {
  const t = useTranslations('ui.colorPalette');
  const locale = useLocale();
  const { palette, setPalette } = useColorPalette();
  const labelLocale = locale.startsWith('zh') ? 'zh' : 'en';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('rounded-full px-3', className)}
          aria-label={t('menuLabel')}
          suppressHydrationWarning
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[220px]">
        {COLOR_PALETTES.map((id: ColorPalette) => (
          <DropdownMenuItem
            key={id}
            onClick={() => setPalette(id)}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-0.5 py-2.5',
              palette === id && 'bg-accent/80'
            )}
          >
            <span className="flex w-full items-center gap-2 text-sm font-medium">
              {palette === id ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
              )}
              {getColorThemeLabel(id, labelLocale)}
            </span>
            <span className="pl-6 text-2xs text-muted-foreground">
              {getColorThemeDescription(id, labelLocale)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
