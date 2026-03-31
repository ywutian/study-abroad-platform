'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { RoleBadge } from '../../_components/role-badge';
import { BarChart3, Eye } from 'lucide-react';

interface Operator {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
  _count?: { admissionCases: number; reviewsGiven: number };
  stats?: { casesReviewed: number; importsProcessed: number; lastActive?: string };
}

interface OperatorStats {
  casesReviewed: number;
  casesApproved: number;
  casesRejected: number;
  importsProcessed: number;
  lastActive?: string;
}

export function MembersTab() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);

  const { data: operators, isLoading } = useQuery({
    queryKey: ['adminOperators'],
    queryFn: () => apiClient.get<Operator[]>(adminRoutes.operators()),
  });

  const { data: operatorStats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminOperatorStats', selectedOperator],
    queryFn: () => apiClient.get<OperatorStats>(adminRoutes.operatorStats(selectedOperator!)),
    enabled: !!selectedOperator,
  });

  if (isLoading) return <ListSkeleton />;

  if (!operators || operators.length === 0) {
    return (
      <EmptyState
        type="no-data"
        title={t('team.members.empty')}
        description={t('team.members.emptyDesc')}
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
                <TableHead>{t('team.members.email')}</TableHead>
                <TableHead>{t('team.members.role')}</TableHead>
                <TableHead>{t('team.members.casesReviewed')}</TableHead>
                <TableHead>{t('team.members.lastActive')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{op.email[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[200px]">{op.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={op.role} />
                  </TableCell>
                  <TableCell>{op.stats?.casesReviewed ?? op._count?.reviewsGiven ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {op.lastLoginAt ? fmt.relativeTime(new Date(op.lastLoginAt)) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOperator(op.id)}>
                      <Eye className="h-4 w-4 mr-1" />
                      {t('team.members.viewStats')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={!!selectedOperator} onOpenChange={() => setSelectedOperator(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('team.members.statsTitle')}
            </DialogTitle>
          </DialogHeader>
          {statsLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : operatorStats ? (
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                label={t('team.members.casesReviewed')}
                value={operatorStats.casesReviewed}
              />
              <StatItem
                label={t('team.members.casesApproved')}
                value={operatorStats.casesApproved}
              />
              <StatItem
                label={t('team.members.casesRejected')}
                value={operatorStats.casesRejected}
              />
              <StatItem
                label={t('team.members.importsProcessed')}
                value={operatorStats.importsProcessed}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
