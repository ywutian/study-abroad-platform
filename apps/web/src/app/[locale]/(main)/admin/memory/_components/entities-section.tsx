/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';
import { Network, Eye } from 'lucide-react';
import { EntityItem, ENTITY_TYPES, entityTypeBadge, formatDate } from './types';

export function EntitiesSection() {
  const t = useTranslations('admin.memory');
  const [entityFilters, setEntityFilters] = useState({ userId: '', type: '' });
  const [entityPage, setEntityPage] = useState(1);
  const entityPageSize = 20;

  const { data: entityData } = useQuery({
    queryKey: ['memoryEntities', entityFilters, entityPage],
    queryFn: () =>
      apiClient.get<{ data: EntityItem[]; total: number }>(adminAiAgentRoutes.memoryEntities(), {
        params: {
          ...(entityFilters.userId && { userId: entityFilters.userId }),
          ...(entityFilters.type && { type: entityFilters.type }),
          page: String(entityPage),
          pageSize: String(entityPageSize),
        },
      }),
  });

  const [viewEntity, setViewEntity] = useState<EntityItem | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{t('entities')}</CardTitle>
              <CardDescription className="mt-1">{t('entitiesDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <Input
              placeholder={t('userIdPlaceholder')}
              value={entityFilters.userId}
              onChange={(e) => {
                setEntityFilters({ ...entityFilters, userId: e.target.value });
                setEntityPage(1);
              }}
            />
            <Select
              value={entityFilters.type}
              onValueChange={(v) => {
                setEntityFilters({ ...entityFilters, type: v === 'all' ? '' : v });
                setEntityPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('entityDistribution')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityData?.data && entityData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Type</TableHead>
                    <TableHead>{t('entityName')}</TableHead>
                    <TableHead>{t('entityDesc')}</TableHead>
                    <TableHead className="w-[80px]">{t('entityRelations')}</TableHead>
                    <TableHead className="w-[140px]">Created</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityData.data.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <Badge className={cn('text-2xs', entityTypeBadge[entity.type])}>
                          {entity.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{entity.name}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">
                        {entity.description || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {entity.relations ? (entity.relations as any[]).length : 0}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(entity.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewEntity(entity)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={entityPage}
                totalPages={Math.ceil((entityData.total || 0) / entityPageSize)}
                total={entityData.total || 0}
                pageSize={entityPageSize}
                onPageChange={setEntityPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No entities found</p>
          )}
        </CardContent>
      </Card>

      {/* Entity Detail Dialog */}
      <Dialog open={!!viewEntity} onOpenChange={(open) => !open && setViewEntity(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewEntity?.name}</DialogTitle>
            <DialogDescription>{viewEntity?.type}</DialogDescription>
          </DialogHeader>
          {viewEntity && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('entityDesc')}</Label>
                <p className="text-sm">{viewEntity.description || '-'}</p>
              </div>
              {viewEntity.attributes && Object.keys(viewEntity.attributes).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('entityAttrs')}</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(viewEntity.attributes, null, 2)}
                  </pre>
                </div>
              )}
              {viewEntity.relations && (viewEntity.relations as any[]).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('entityRelations')}</Label>
                  <div className="space-y-1 mt-1">
                    {(viewEntity.relations as any[]).map((rel, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-2xs">
                          {rel.type}
                        </Badge>
                        <span>{rel.targetName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
