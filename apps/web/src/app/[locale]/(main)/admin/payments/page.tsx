'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  Loader2,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';
import { Label } from '@/components/ui/label';

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
  totalRevenue: number;
  monthlyRevenue: number;
  totalPayments: number;
  byStatus: Record<string, number>;
  byPlan: Array<{ plan: string; count: number; revenue: number }>;
}

export default function AdminPaymentsPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<{ userId: string; email: string } | null>(null);
  const [newPlan, setNewPlan] = useState('PRO');
  const pageSize = 20;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminPaymentStats'],
    queryFn: () => apiClient.get<PaymentStats>('/admin/payments/stats'),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['adminPayments', statusFilter, planFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (planFilter !== 'ALL') params.plan = planFilter;
      return apiClient.get<{ data: Payment[]; total: number; totalPages: number }>(
        '/admin/payments',
        { params }
      );
    },
  });

  const refundMutation = useMutation({
    mutationFn: (paymentId: string) => apiClient.post(`/admin/payments/${paymentId}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['adminPaymentStats'] });
      setRefundTarget(null);
      toast.success(t('payments.refunded'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: string }) =>
      apiClient.put(`/admin/payments/users/${userId}/subscription`, { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      setAdjustTarget(null);
      toast.success(t('payments.adjusted'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const getStatusBadge = (status: string) => {
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

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        description={t('payments.description')}
        icon={CreditCard}
        color="blue"
      />

      <div className="mt-6 space-y-6">
        {/* Stats */}
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('payments.totalRevenue')}</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  ${Number(stats.totalRevenue ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('payments.monthlyRevenue')}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${Number(stats.monthlyRevenue ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('payments.totalPayments')}</CardTitle>
                <Receipt className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPayments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('payments.activeSubscriptions')}
                </CardTitle>
                <Users className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.byStatus?.SUCCESS ?? 0}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex gap-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
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
            onValueChange={(v) => {
              setPlanFilter(v);
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

        {/* Payments Table */}
        {paymentsLoading ? (
          <ListSkeleton count={5} />
        ) : paymentsData?.data && paymentsData.data.length > 0 ? (
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
                      <TableHead className="w-[140px]">{t('payments.actions')}</TableHead>
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
                          ${Number(payment.amount ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmt.dateTime(new Date(payment.createdAt), 'medium')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setRefundTarget(payment.id)}
                              disabled={payment.status !== 'SUCCESS'}
                              title={t('payments.refund')}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setAdjustTarget({
                                  userId: payment.user.id,
                                  email: payment.user.email,
                                })
                              }
                              title={t('payments.adjustSub')}
                            >
                              <ArrowUpDown className="h-4 w-4" />
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
              totalPages={paymentsData.totalPages ?? 1}
              total={paymentsData.total ?? 0}
              pageSize={pageSize}
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

      {/* Refund Dialog */}
      <AlertDialog open={!!refundTarget} onOpenChange={() => setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payments.refundConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payments.refundDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundTarget && refundMutation.mutate(refundTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {refundMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('payments.refund')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust Subscription Dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={() => setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payments.adjustSub')}</DialogTitle>
            <DialogDescription>
              {t('payments.adjustSubDesc')} — {adjustTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('payments.newPlan')}</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>
              {t('dialogs.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (adjustTarget) {
                  adjustMutation.mutate({ userId: adjustTarget.userId, plan: newPlan });
                }
              }}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
