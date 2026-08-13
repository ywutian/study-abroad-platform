'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Archive, CheckCircle2, CreditCard, Receipt, RotateCcw, XCircle } from 'lucide-react';
import { adminRoutes } from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { PaginationControls } from '../_components/pagination-controls';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  createdAt: string;
  user: { id: string; email: string };
}

interface PaymentStats {
  totalPayments: number;
  byStatus: Record<string, number>;
}

const PAGE_SIZE = 20;

export default function AdminPaymentsPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminPaymentStats'],
    queryFn: () => apiClient.get<PaymentStats>(adminRoutes.paymentsStats()),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['adminPayments', statusFilter, planFilter, page],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(PAGE_SIZE),
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (planFilter !== 'ALL') params.plan = planFilter;
      return apiClient.get<{ data: Payment[]; total: number; totalPages: number }>(
        adminRoutes.payments(),
        { params }
      );
    },
  });

  const statusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return <Badge variant="success">{t('payments.statusCompleted')}</Badge>;
      case 'PENDING':
        return <Badge variant="warning">{t('payments.statusPending')}</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">{t('payments.statusFailed')}</Badge>;
      case 'REFUNDED':
        return <Badge variant="secondary">{t('payments.statusRefunded')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statCards = [
    {
      label: t('payments.totalPayments'),
      value: stats?.totalPayments ?? 0,
      icon: Receipt,
      color: 'text-violet-500',
    },
    {
      label: t('payments.successfulPayments'),
      value: stats?.byStatus?.SUCCESS ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
    {
      label: t('payments.failedPayments'),
      value: stats?.byStatus?.FAILED ?? 0,
      icon: XCircle,
      color: 'text-red-500',
    },
    {
      label: t('payments.refundedPayments'),
      value: stats?.byStatus?.REFUNDED ?? 0,
      icon: RotateCcw,
      color: 'text-slate-500',
    },
  ];

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        description={t('payments.description')}
        icon={CreditCard}
        color="blue"
      />

      <div className="mt-6 space-y-6">
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <Archive className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-400" />
            <div className="space-y-1">
              <CardTitle className="text-body">{t('payments.readOnlyTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('payments.readOnlyDescription')}</p>
            </div>
          </CardHeader>
        </Card>

        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-body-sm font-medium">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('payments.allStatuses')}</SelectItem>
              <SelectItem value="SUCCESS">{t('payments.statusCompleted')}</SelectItem>
              <SelectItem value="PENDING">{t('payments.statusPending')}</SelectItem>
              <SelectItem value="FAILED">{t('payments.statusFailed')}</SelectItem>
              <SelectItem value="REFUNDED">{t('payments.statusRefunded')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={planFilter}
            onValueChange={(value) => {
              setPlanFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('payments.allPlans')}</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
              <SelectItem value="PREMIUM">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentsLoading ? (
          <ListSkeleton count={5} />
        ) : paymentsData?.data?.length ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payments.user')}</TableHead>
                      <TableHead>{t('payments.plan')}</TableHead>
                      <TableHead>{t('payments.amount')}</TableHead>
                      <TableHead>{t('payments.status')}</TableHead>
                      <TableHead>{t('payments.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsData.data.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-muted-foreground">
                          {payment.user?.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.plan}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {fmt.number(Number(payment.amount ?? 0), {
                            style: 'currency',
                            currency: payment.currency || 'CNY',
                          })}
                        </TableCell>
                        <TableCell>{statusBadge(payment.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmt.dateTime(new Date(payment.createdAt), 'medium')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
            <PaginationControls
              page={page}
              totalPages={paymentsData.totalPages ?? 1}
              total={paymentsData.total ?? 0}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<CreditCard className="h-12 w-12" />}
            title={t('payments.noPayments')}
            description={t('payments.noPaymentsDesc')}
          />
        )}
      </div>
    </>
  );
}
