'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { Layers, Pencil, Trash2 } from 'lucide-react';

interface ActivityTemplate {
  id: string;
  name: string;
  nameZh?: string | null;
  aliases: string[];
  category: string;
  tier: number;
  description?: string | null;
  isActive: boolean;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Elite',
  2: 'Significant',
  3: 'Notable',
  4: 'General',
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  2: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  4: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface TemplatesTableProps {
  items: ActivityTemplate[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (item: ActivityTemplate) => void;
  onDelete: (id: string) => void;
}

export function TemplatesTable({
  items,
  isLoading,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
}: TemplatesTableProps) {
  const t = useTranslations('admin');

  if (isLoading) {
    return <ListSkeleton count={5} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-12 w-12" />}
        title="No Activity Templates"
        description="Click Create to add a new activity template"
      />
    );
  }

  return (
    <>
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Chinese Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.nameZh || '-'}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={TIER_COLORS[item.tier] ?? TIER_COLORS[4]}>
                      {TIER_LABELS[item.tier] ?? `Tier ${item.tier}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {item.aliases?.length ? item.aliases.join(', ') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.isActive ? 'default' : 'secondary'}
                      className={
                        item.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {item.isActive ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDelete(item.id)}
                        disabled={!item.isActive}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </>
  );
}
