'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Check, Search, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllTemplates, getTemplatesForResumeType } from './pdf/templates';
import type { TemplateCategory, TemplateDefinition } from './pdf/types';

const CATEGORIES: Array<{ id: TemplateCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'professional', label: 'Professional' },
  { id: 'modern', label: 'Modern' },
  { id: 'creative', label: 'Creative' },
  { id: 'academic', label: 'Academic' },
  { id: 'minimal', label: 'Minimal' },
];

// Color preview for each template (uses primary color)
const THEME_COLORS: Record<string, string> = {
  navy: '#1e3a5f',
  charcoal: '#333333',
  forest: '#2d5016',
  teal: '#0d9488',
  indigo: '#4f46e5',
  coral: '#e11d48',
  amber: '#d97706',
  violet: '#7c3aed',
  rose: '#be185d',
  black: '#000000',
  slate: '#475569',
  burgundy: '#7f1d1d',
  'dark-green': '#14532d',
  'royal-blue': '#1e3a8a',
};

interface TemplatePickerProps {
  currentTemplateId: string;
  resumeType?: string;
  onSelect: (templateId: string) => void;
  trigger?: React.ReactNode;
}

export function TemplatePicker({
  currentTemplateId,
  resumeType,
  onSelect,
  trigger,
}: TemplatePickerProps) {
  const t = useTranslations('resume.editor');
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const recommended = useMemo(
    () => (resumeType ? new Set(getTemplatesForResumeType(resumeType).map((t) => t.id)) : null),
    [resumeType]
  );

  const templates = useMemo(() => {
    let list = getAllTemplates();
    if (category !== 'all') {
      list = list.filter((t) => t.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }
    // Sort: recommended first, then alphabetical
    if (recommended) {
      list = [...list].sort((a, b) => {
        const aRec = recommended.has(a.id) ? 0 : 1;
        const bRec = recommended.has(b.id) ? 0 : 1;
        return aRec - bRec || a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [category, search, recommended]);

  const handleSelect = (t: TemplateDefinition) => {
    onSelect(t.id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Palette className="mr-1.5 h-3.5 w-3.5" />
            Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('chooseTemplate')}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchTemplates')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Button
              key={c.id}
              variant={category === c.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Template grid */}
        <ScrollArea className="h-[400px]">
          <div className="grid grid-cols-3 gap-3 p-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={cn(
                  'group relative rounded-lg border p-3 text-left transition-all hover:border-primary hover:shadow-sm',
                  currentTemplateId === t.id && 'border-primary ring-1 ring-primary'
                )}
              >
                {/* Color preview bar */}
                <div
                  className="mb-2 h-2 rounded-full"
                  style={{ backgroundColor: THEME_COLORS[t.theme] ?? '#000' }}
                />

                {/* Layout indicator */}
                <LayoutMiniature layout={t.layout} color={THEME_COLORS[t.theme] ?? '#000'} />

                {/* Name + badges */}
                <div className="mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{t.name}</span>
                    {currentTemplateId === t.id && <Check className="h-3 w-3 text-primary" />}
                  </div>
                  <p className="mt-0.5 text-2xs text-muted-foreground line-clamp-1">
                    {t.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {recommended?.has(t.id) && (
                      <Badge variant="default" className="h-4 px-1 text-2xs">
                        Recommended
                      </Badge>
                    )}
                    {t.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="h-4 px-1 text-2xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/** Simple layout miniature showing the structure visually */
function LayoutMiniature({ layout, color }: { layout: string; color: string }) {
  const bg = color + '20'; // 12% opacity
  const bar = color + '40';

  switch (layout) {
    case 'sidebar-left':
      return (
        <div className="flex h-14 gap-0.5 rounded border">
          <div className="w-1/3 rounded-l" style={{ backgroundColor: bg }} />
          <div className="flex flex-1 flex-col gap-0.5 p-1">
            <div className="h-1 rounded" style={{ backgroundColor: bar }} />
            <div className="h-1 w-3/4 rounded" style={{ backgroundColor: bar }} />
            <div className="h-1 w-1/2 rounded" style={{ backgroundColor: bar }} />
          </div>
        </div>
      );
    case 'sidebar-right':
      return (
        <div className="flex h-14 gap-0.5 rounded border">
          <div className="flex flex-1 flex-col gap-0.5 p-1">
            <div className="h-1 rounded" style={{ backgroundColor: bar }} />
            <div className="h-1 w-3/4 rounded" style={{ backgroundColor: bar }} />
            <div className="h-1 w-1/2 rounded" style={{ backgroundColor: bar }} />
          </div>
          <div className="w-1/3 rounded-r" style={{ backgroundColor: bg }} />
        </div>
      );
    case 'header-banner-single':
      return (
        <div className="flex h-14 flex-col rounded border">
          <div className="h-4 rounded-t" style={{ backgroundColor: color }} />
          <div className="flex flex-1 flex-col gap-0.5 p-1">
            <div className="h-1 rounded" style={{ backgroundColor: bar }} />
            <div className="h-1 w-2/3 rounded" style={{ backgroundColor: bar }} />
          </div>
        </div>
      );
    case 'header-banner-columns':
      return (
        <div className="flex h-14 flex-col rounded border">
          <div className="h-4 rounded-t" style={{ backgroundColor: color }} />
          <div className="flex flex-1 gap-0.5 p-1">
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
              <div className="h-1 w-2/3 rounded" style={{ backgroundColor: bar }} />
            </div>
            <div className="flex w-1/3 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
            </div>
          </div>
        </div>
      );
    case 'equal-columns':
      return (
        <div className="flex h-14 flex-col rounded border">
          <div className="h-3 border-b" />
          <div className="flex flex-1 gap-0.5 p-1">
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
              <div className="h-1 w-2/3 rounded" style={{ backgroundColor: bar }} />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
              <div className="h-1 w-2/3 rounded" style={{ backgroundColor: bar }} />
            </div>
          </div>
        </div>
      );
    case 'timeline':
      return (
        <div className="flex h-14 flex-col rounded border p-1">
          <div className="flex items-start gap-1">
            <div className="mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
              <div className="h-1 w-2/3 rounded" style={{ backgroundColor: bar }} />
            </div>
          </div>
          <div className="ml-1 flex items-start gap-1 border-l pt-1" style={{ borderColor: bar }}>
            <div className="-ml-1 mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-1 rounded" style={{ backgroundColor: bar }} />
            </div>
          </div>
        </div>
      );
    case 'single-column':
    default:
      return (
        <div className="flex h-14 flex-col gap-0.5 rounded border p-1">
          <div className="h-3 border-b" />
          <div className="h-1 rounded" style={{ backgroundColor: bar }} />
          <div className="h-1 w-3/4 rounded" style={{ backgroundColor: bar }} />
          <div className="h-1 w-1/2 rounded" style={{ backgroundColor: bar }} />
        </div>
      );
  }
}
