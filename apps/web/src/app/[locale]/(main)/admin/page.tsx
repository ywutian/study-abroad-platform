'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-state';
import { EssayPromptManager } from '@/components/features';
import { motion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
// date-fns format removed — using useFormatter() from next-intl instead
import {
  Users,
  AlertTriangle,
  BarChart3,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Shield,
  UserCheck,
  FileText,
  Trash2,
  GraduationCap,
  RefreshCw,
  Database,
  Calendar,
  Globe,
  PenTool,
} from 'lucide-react';
import { useAuthStore } from '@/stores';
import { useRouter } from '@/lib/i18n/navigation';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
}

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  context?: any;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  reporter: {
    id: string;
    email: string;
    role: string;
  };
}

interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  locale: string;
  createdAt: string;
  _count: {
    admissionCases: number;
    reviewsGiven: number;
  };
}

interface School {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  state?: string;
  acceptanceRate?: number;
  tuition?: number;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
    essayCount?: number;
    applicationCycle?: string;
    dataUpdated?: string;
  };
}

export default function AdminPage() {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('overview');
  const [reportFilter, setReportFilter] = useState('PENDING');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [reportToResolve, setReportToResolve] = useState<Report | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [syncLimit, setSyncLimit] = useState('100');

  const isAdmin = user?.role === 'ADMIN';

  // apiClient 已自动解包 { success, data } -> data
  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
    enabled: isAdmin,
  });

  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['adminReports', reportFilter],
    queryFn: () =>
      apiClient.get<{ data: Report[]; total: number }>('/admin/reports', {
        params: reportFilter ? { status: reportFilter } : {},
      }),
    enabled: isAdmin,
  });

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers', userSearch, userRoleFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (userSearch) params.search = userSearch;
      if (userRoleFilter && userRoleFilter !== 'ALL') params.role = userRoleFilter;
      return apiClient.get<{ data: User[]; total: number }>('/admin/users', { params });
    },
    enabled: isAdmin,
  });

  // Fetch schools
  const { data: schoolsData, isLoading: schoolsLoading } = useQuery({
    queryKey: ['adminSchools', schoolSearch],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>('/schools', {
        params: { search: schoolSearch ?? '', pageSize: '50' },
      }),
    enabled: isAdmin,
  });

  // Update report mutation
  const updateReportMutation = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      apiClient.put(`/admin/reports/${id}`, { status, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setReportToResolve(null);
      toast.success(t('admin.toast.reportResolved'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.put(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(t('admin.toast.roleUpdated'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setUserToDelete(null);
      toast.success(t('admin.toast.userDeleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Sync College Scorecard data
  const syncScorecardMutation = useMutation({
    mutationFn: (limit: number) =>
      apiClient.post<{ synced: number; errors: number }>(`/schools/sync/scorecard?limit=${limit}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(t('admin.toast.syncComplete', { count: data.synced }));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.toast.syncFailed'));
    },
  });

  // Scrape school websites
  const scrapeSchoolsMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: string[]; failed: { school: string; error: string }[] }>(
        '/schools/scrape/all'
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(t('admin.toast.scrapeComplete', { count: data.success.length }));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.toast.scrapeFailed'));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('admin.status.pending')}
          </Badge>
        );
      case 'REVIEWED':
        return (
          <Badge variant="info" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('admin.status.reviewed')}
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('admin.status.resolved')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="purple">{t('admin.roles.admin')}</Badge>;
      case 'VERIFIED':
        return <Badge variant="success">{t('admin.roles.verified')}</Badge>;
      default:
        return <Badge variant="secondary">{t('admin.roles.user')}</Badge>;
    }
  };

  const getTargetTypeName = (type: string) => {
    switch (type) {
      case 'USER':
        return t('admin.targetTypes.user');
      case 'MESSAGE':
        return t('admin.targetTypes.message');
      case 'CASE':
        return t('admin.targetTypes.case');
      case 'REVIEW':
        return t('admin.targetTypes.review');
      default:
        return type;
    }
  };

  // Redirect if not admin (must be after all hooks)
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/profile');
    }
  }, [user, router]);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('admin.title')}
        description={t('admin.description')}
        icon={Shield}
        color="violet"
        stats={
          stats
            ? [
                {
                  label: t('admin.stats.totalUsers'),
                  value: stats.totalUsers,
                  icon: Users,
                  color: 'text-blue-500',
                },
                {
                  label: t('admin.stats.totalCases'),
                  value: stats.totalCases,
                  icon: FileText,
                  color: 'text-emerald-500',
                },
                {
                  label: t('admin.stats.pendingReports'),
                  value: stats.pendingReports,
                  icon: AlertTriangle,
                  color: 'text-amber-500',
                },
                {
                  label: t('admin.stats.totalReviews'),
                  value: stats.totalReviews,
                  icon: UserCheck,
                  color: 'text-primary',
                },
              ]
            : undefined
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted/50">
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tabs.overview')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tabs.reports')}</span>
            {stats?.pendingReports ? <Badge variant="warning">{stats.pendingReports}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tabs.users')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="schools"
            className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600"
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tabs.data')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="essays"
            className="gap-2 data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-600"
          >
            <PenTool className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.tabs.essays')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* 统计卡片 */}
          {statsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: t('admin.stats.totalUsers'),
                    value: stats.totalUsers,
                    sub: `${stats.verifiedUsers} ${t('admin.roles.verified')}`,
                    icon: Users,
                    color: 'blue',
                    tab: 'users',
                  },
                  {
                    title: t('admin.stats.totalCases'),
                    value: stats.totalCases,
                    icon: FileText,
                    color: 'emerald',
                    tab: null,
                  },
                  {
                    title: t('admin.stats.pendingReports'),
                    value: stats.pendingReports,
                    icon: AlertTriangle,
                    color: 'amber',
                    tab: 'reports',
                  },
                  {
                    title: t('admin.stats.totalReviews'),
                    value: stats.totalReviews,
                    icon: UserCheck,
                    color: 'violet',
                    tab: null,
                  },
                ].map((stat, index) => {
                  const StatIcon = stat.icon;
                  return (
                    <motion.div
                      key={stat.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={cn(
                          'overflow-hidden transition-shadow',
                          stat.tab && 'cursor-pointer hover:shadow-md'
                        )}
                        onClick={() => stat.tab && setActiveTab(stat.tab)}
                      >
                        <div
                          className={cn('h-1 bg-gradient-to-r', {
                            'bg-primary': stat.color === 'blue' || stat.color === 'violet',
                            'bg-success': stat.color === 'emerald',
                            'bg-warning': stat.color === 'amber',
                          })}
                        />
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                          <div
                            className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                              'bg-blue-500/10 text-blue-500': stat.color === 'blue',
                              'bg-emerald-500/10 text-emerald-500': stat.color === 'emerald',
                              'bg-amber-500/10 text-amber-500': stat.color === 'amber',
                              'bg-primary/10 text-primary': stat.color === 'violet',
                            })}
                          >
                            <StatIcon className="h-4 w-4" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div
                            className={cn('text-3xl font-bold', {
                              'text-blue-600': stat.color === 'blue',
                              'text-emerald-600': stat.color === 'emerald',
                              'text-amber-600': stat.color === 'amber',
                              'text-primary': stat.color === 'violet',
                            })}
                          >
                            {stat.value}
                          </div>
                          {stat.sub && (
                            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* 快捷操作 */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 待处理事项 */}
                {stats.pendingReports > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                          <AlertTriangle className="h-6 w-6 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            {stats.pendingReports} {t('admin.overview.pendingReports')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('admin.overview.needsAttention')}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab('reports')}>
                          {t('admin.overview.handle')}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* 数据同步入口 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                        <Database className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{t('admin.overview.dataManagement')}</p>
                        <p className="text-xs text-muted-foreground">
                          {schoolsData?.total || 0} {t('admin.overview.schoolsInDb')}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('schools')}>
                        {t('admin.overview.manage')}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* 文书管理入口 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10">
                        <PenTool className="h-6 w-6 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{t('admin.tabs.essays')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.overview.essayDesc')}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('essays')}>
                        {t('admin.overview.manage')}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <div className="mb-4">
            <Select value={reportFilter} onValueChange={setReportFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('common.filter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">{t('admin.status.pending')}</SelectItem>
                <SelectItem value="REVIEWED">{t('admin.status.reviewed')}</SelectItem>
                <SelectItem value="RESOLVED">{t('admin.status.resolved')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : reportsData?.data && reportsData.data.length > 0 ? (
            <div className="space-y-4">
              {reportsData.data.map((report) => (
                <Card key={report.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(report.status)}
                          <Badge variant="outline">{getTargetTypeName(report.targetType)}</Badge>
                        </div>
                        <p className="font-medium">{report.reason}</p>
                        {report.detail && (
                          <p className="text-sm text-muted-foreground">{report.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t('admin.reports.reporter')}: {report.reporter.email} ·{' '}
                          {fmt.dateTime(new Date(report.createdAt), 'medium')}
                        </p>
                      </div>
                      {report.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateReportMutation.mutate({ id: report.id, status: 'REVIEWED' })
                            }
                          >
                            {t('admin.reports.markReviewed')}
                          </Button>
                          <Button size="sm" onClick={() => setReportToResolve(report)}>
                            {t('admin.reports.resolve')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<AlertTriangle className="h-12 w-12" />}
              title={t('admin.reports.empty')}
              description={t('admin.reports.emptyDesc')}
            />
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('admin.users.searchPlaceholder')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('common.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="USER">{t('admin.roles.user')}</SelectItem>
                <SelectItem value="VERIFIED">{t('admin.roles.verified')}</SelectItem>
                <SelectItem value="ADMIN">{t('admin.roles.admin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {usersLoading ? (
            <ListSkeleton count={5} />
          ) : usersData?.data && usersData.data.length > 0 ? (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.users.email')}</TableHead>
                      <TableHead>{t('admin.users.role')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>
                        {t('admin.users.cases')}/{t('admin.users.reviews')}
                      </TableHead>
                      <TableHead>{t('admin.users.joinDate')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.data.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[200px]">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(u.role)}</TableCell>
                        <TableCell>
                          {u.emailVerified ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {t('admin.roles.verified')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3 text-amber-500" />
                              {t('admin.users.notVerified')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u._count.admissionCases} / {u._count.reviewsGiven}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmt.dateTime(new Date(u.createdAt), 'medium')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUserRoleMutation.mutate({ userId: u.id, role: 'VERIFIED' })
                                }
                                disabled={u.role === 'VERIFIED' || u.role === 'ADMIN'}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                {t('admin.users.setVerified')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUserRoleMutation.mutate({ userId: u.id, role: 'USER' })
                                }
                                disabled={u.role === 'USER' || u.role === 'ADMIN'}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                {t('admin.users.setUser')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setUserToDelete(u.id)}
                                className="text-destructive focus:text-destructive"
                                disabled={u.role === 'ADMIN'}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('admin.users.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          ) : (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title={t('admin.users.noResults')}
              description={t('admin.users.noResultsDesc')}
            />
          )}
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools">
          {/* Data Sync Actions */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {t('admin.data.syncScorecard')}
                </CardTitle>
                <CardDescription>{t('admin.data.syncScorecardDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Select value={syncLimit} onValueChange={setSyncLimit}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => syncScorecardMutation.mutate(parseInt(syncLimit))}
                    disabled={syncScorecardMutation.isPending}
                  >
                    {syncScorecardMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('admin.data.startSync')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('admin.data.scrapeSchools')}
                </CardTitle>
                <CardDescription>{t('admin.data.scrapeSchoolsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => scrapeSchoolsMutation.mutate()}
                  disabled={scrapeSchoolsMutation.isPending}
                  variant="outline"
                >
                  {scrapeSchoolsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {t('admin.data.startScrape')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('admin.data.status')}
                </CardTitle>
                <CardDescription>{t('admin.data.statusDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{schoolsData?.total || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.data.cycle')}: 2025-2026
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Schools Table */}
          {schoolsLoading ? (
            <ListSkeleton count={5} />
          ) : schoolsData?.items && schoolsData.items.length > 0 ? (
            <Card>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">{t('admin.data.rank')}</TableHead>
                      <TableHead>{t('admin.data.schoolName')}</TableHead>
                      <TableHead>{t('admin.data.state')}</TableHead>
                      <TableHead>{t('admin.data.applicationType')}</TableHead>
                      <TableHead>{t('admin.data.deadline')}</TableHead>
                      <TableHead>{t('admin.data.acceptanceRate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolsData.items.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell>
                          {school.usNewsRank ? (
                            <Badge variant="outline">#{school.usNewsRank}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{getSchoolName(school, locale)}</div>
                            {getSchoolSubName(school, locale) && (
                              <div className="text-xs text-muted-foreground">
                                {getSchoolSubName(school, locale)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{school.state || '-'}</TableCell>
                        <TableCell>
                          {school.metadata?.applicationType ? (
                            <Badge variant="secondary">
                              {school.metadata.applicationType.toUpperCase()}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {school.metadata?.deadlines ? (
                            <div className="text-xs">
                              {school.metadata.deadlines.rea && (
                                <div>REA: {school.metadata.deadlines.rea}</div>
                              )}
                              {school.metadata.deadlines.ea && (
                                <div>EA: {school.metadata.deadlines.ea}</div>
                              )}
                              {school.metadata.deadlines.ed && (
                                <div>ED: {school.metadata.deadlines.ed}</div>
                              )}
                              {school.metadata.deadlines.rd && (
                                <div>RD: {school.metadata.deadlines.rd}</div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {school.acceptanceRate
                            ? `${Number(school.acceptanceRate).toFixed(1)}%`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          ) : (
            <EmptyState
              icon={<GraduationCap className="h-12 w-12" />}
              title={t('admin.schools.notFound')}
              description={t('admin.schools.tryOther')}
            />
          )}
        </TabsContent>

        {/* Essays Tab */}
        <TabsContent value="essays">
          <EssayPromptManager />
        </TabsContent>
      </Tabs>

      {/* Resolve Report Dialog */}
      <AlertDialog open={!!reportToResolve} onOpenChange={() => setReportToResolve(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.dialogs.resolveReport')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.dialogs.resolveReportDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reportToResolve &&
                updateReportMutation.mutate({
                  id: reportToResolve.id,
                  status: 'RESOLVED',
                  resolution: t('admin.dialogs.defaultResolution'),
                })
              }
            >
              {updateReportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.dialogs.resolveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.dialogs.deleteUserTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.dialogs.deleteUserDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.dialogs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
