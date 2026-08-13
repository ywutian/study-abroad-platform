'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Search, Loader2, Trash2, Eye } from 'lucide-react';
import { MemoryItem, MEMORY_TYPES, memoryTypeBadge, formatDate, truncate } from './types';

export function MemoryBrowserSection() {
  const t = useTranslations('admin.memory');
  const tAria = useTranslations('common.aria');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();

  const [memFilters, setMemFilters] = useState({
    userId: '',
    type: '',
    category: '',
    minImportance: 0,
  });
  const [memPage, setMemPage] = useState(1);
  const memPageSize = 20;

  const { data: memData } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['memoryBrowse', memFilters, memPage],
    queryFn: () =>
      apiClient.get<{ data: MemoryItem[]; total: number }>(adminAiAgentRoutes.memoryBrowse(), {
        params: {
          ...(memFilters.userId && { userId: memFilters.userId }),
          ...(memFilters.type && { type: memFilters.type }),
          ...(memFilters.category && { category: memFilters.category }),
          ...(memFilters.minImportance > 0 && { minImportance: String(memFilters.minImportance) }),
          page: String(memPage),
          pageSize: String(memPageSize),
        },
      }),
  });

  const [viewMemory, setViewMemory] = useState<MemoryItem | null>(null);
  const [deleteMemoryId, setDeleteMemoryId] = useState<string | null>(null);

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(adminAiAgentRoutes.memoryById(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryBrowse'] });
      queryClient.invalidateQueries({ queryKey: ['memoryGlobalStats'] });
      toast.success(t('deleteMemory'));
      setDeleteMemoryId(null);
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5" />
            <div>
              <CardTitle className="text-body">{t('browse')}</CardTitle>
              <CardDescription className="mt-1">{t('browseDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Input
              placeholder={t('userIdPlaceholder')}
              value={memFilters.userId}
              onChange={(e) => {
                setMemFilters({ ...memFilters, userId: e.target.value });
                setMemPage(1);
              }}
            />
            <Select
              value={memFilters.type}
              onValueChange={(v) => {
                setMemFilters({ ...memFilters, type: v === 'all' ? '' : v });
                setMemPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('typeDistribution')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                {MEMORY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('category')}
              value={memFilters.category}
              onChange={(e) => {
                setMemFilters({ ...memFilters, category: e.target.value });
                setMemPage(1);
              }}
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('minImportance')}</Label>
                <span className="text-xs text-muted-foreground">
                  {(memFilters.minImportance * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[memFilters.minImportance]}
                onValueChange={([v]) => {
                  setMemFilters({ ...memFilters, minImportance: v });
                  setMemPage(1);
                }}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
          </div>

          {memData?.data && memData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Type</TableHead>
                    <TableHead className="w-[80px]">{t('category')}</TableHead>
                    <TableHead>{t('content')}</TableHead>
                    <TableHead className="w-[100px]">{t('importance')}</TableHead>
                    <TableHead className="w-[60px]">{t('accessCount')}</TableHead>
                    <TableHead className="w-[140px]">Created</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memData.data.map((mem) => (
                    <TableRow key={mem.id}>
                      <TableCell>
                        <Badge className={cn('text-2xs', memoryTypeBadge[mem.type])}>
                          {mem.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{mem.category || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {truncate(mem.content, 50)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="w-12 bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary rounded-full h-1.5"
                              style={{ width: `${mem.importance * 100}%` }}
                            />
                          </div>
                          <span className="text-2xs">{(mem.importance * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">{mem.accessCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(mem.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 md:h-8 md:w-8"
                            onClick={() => setViewMemory(mem)}
                            aria-label={tAria('viewMemory')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive md:h-8 md:w-8"
                            onClick={() => setDeleteMemoryId(mem.id)}
                            aria-label={tAria('deleteMemory')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={memPage}
                totalPages={Math.ceil((memData.total || 0) / memPageSize)}
                total={memData.total || 0}
                pageSize={memPageSize}
                onPageChange={setMemPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No memories found</p>
          )}
        </CardContent>
      </Card>

      {/* Memory Detail Dialog */}
      <Dialog open={!!viewMemory} onOpenChange={(open) => !open && setViewMemory(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewDetail')}</DialogTitle>
            <DialogDescription>
              {viewMemory?.type} | {viewMemory?.category || '-'}
            </DialogDescription>
          </DialogHeader>
          {viewMemory && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">ID</Label>
                <p className="text-xs font-mono break-all">{viewMemory.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <p className="text-xs font-mono break-all">{viewMemory.userId}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('content')}</Label>
                <p className="text-sm whitespace-pre-wrap">{viewMemory.content}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('importance')}</Label>
                  <p className="text-sm">{(viewMemory.importance * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('accessCount')}</Label>
                  <p className="text-sm">{viewMemory.accessCount}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(viewMemory.createdAt)}</p>
                </div>
              </div>
              {viewMemory.metadata && Object.keys(viewMemory.metadata).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Metadata</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(viewMemory.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Memory Confirm */}
      <AlertDialog
        open={!!deleteMemoryId}
        onOpenChange={(open) => !open && setDeleteMemoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteMemory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemoryId && deleteMemoryMutation.mutate(deleteMemoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMemoryMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
