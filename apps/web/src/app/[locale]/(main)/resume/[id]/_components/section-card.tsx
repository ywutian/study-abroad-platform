'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Trash2, GripVertical, Eye, EyeOff, ChevronDown } from 'lucide-react';

// ─── Types ───

interface ResumeSection {
  id: string;
  resumeId: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ContentItem {
  primary?: string;
  secondary?: string;
}

export interface SectionCardProps {
  section: ResumeSection;
  sectionLabel: string;
  t: (key: string) => string;
  tc: (key: string) => string;
  onToggleVisibility: () => void;
  onUpdateContent: (content: unknown) => void;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
  isSaving: boolean;
}

// ─── Content Summary Helper ───

export function getContentSummary(section: ResumeSection): ContentItem[] {
  const content = section.content as Record<string, unknown>;
  if (!content) return [];

  if (section.type === 'HEADER') {
    const name = content.name as string;
    const email = content.email as string;
    if (!name && !email) return [];
    return [
      {
        primary: name || '—',
        secondary: [email, content.phone as string].filter(Boolean).join(' · '),
      },
    ];
  }

  if (section.type === 'SKILLS') {
    const categories = content.categories as Array<{ name: string; items: string[] }>;
    if (!categories || categories.length === 0) return [];
    return categories.map((c) => ({
      primary: c.name,
      secondary: c.items?.join(', ') || '',
    }));
  }

  const items = content.items as Array<Record<string, unknown>>;
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  return items.map((item) => {
    const primary =
      (item.name as string) ||
      (item.schoolName as string) ||
      (item.title as string) ||
      (item.type as string) ||
      '';
    const parts: string[] = [];
    if (item.role) parts.push(item.role as string);
    if (item.organization) parts.push(item.organization as string);
    if (item.company) parts.push(item.company as string);
    if (item.institution) parts.push(item.institution as string);
    if (item.degree) parts.push(item.degree as string);
    if (item.major) parts.push(item.major as string);
    if (item.level) parts.push(item.level as string);
    if (item.score !== undefined) parts.push(`Score: ${item.score}`);
    if (item.startDate) {
      const dateRange = `${item.startDate}${item.endDate ? ` – ${item.endDate}` : ''}`;
      parts.push(dateRange);
    }
    return { primary, secondary: parts.join(' · ') };
  });
}

// ─── Component ───

export function SectionCard({
  section,
  sectionLabel,
  t: _t,
  tc,
  onToggleVisibility,
  onUpdateContent,
  onUpdateTitle: _onUpdateTitle,
  onDelete,
  isSaving,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingContent, setEditingContent] = useState(false);
  const [contentJson, setContentJson] = useState('');

  const handleEditContent = () => {
    setContentJson(JSON.stringify(section.content, null, 2));
    setEditingContent(true);
  };

  const handleSaveContent = () => {
    try {
      const parsed = JSON.parse(contentJson);
      onUpdateContent(parsed);
      setEditingContent(false);
    } catch {
      toast.error('Invalid JSON');
    }
  };

  const contentItems = getContentSummary(section);

  return (
    <Card className={cn(!section.isVisible && 'opacity-60')}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')}
              />
            </button>
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <CardTitle className="text-sm font-medium">{sectionLabel}</CardTitle>
            {!section.isVisible && (
              <Badge variant="outline" className="text-xs">
                <EyeOff className="mr-1 h-3 w-3" />
                {tc('hidden') ?? 'Hidden'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleVisibility}
              title={section.isVisible ? 'Hide' : 'Show'}
            >
              {section.isVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          {editingContent ? (
            <div className="space-y-3">
              <Textarea
                value={contentJson}
                onChange={(e) => setContentJson(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingContent(false)}>
                  {tc('cancel')}
                </Button>
                <Button size="sm" onClick={handleSaveContent} disabled={isSaving}>
                  {tc('save')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {contentItems.length > 0 ? (
                <div className="space-y-2">
                  {contentItems.map((item, i) => (
                    <div key={i} className="rounded-md border border-border/50 px-3 py-2 text-sm">
                      {item.primary && (
                        <p className="font-medium text-foreground">{item.primary}</p>
                      )}
                      {item.secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.secondary}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {tc('noData') ?? 'No data yet'}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs"
                onClick={handleEditContent}
              >
                {tc('edit')}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
