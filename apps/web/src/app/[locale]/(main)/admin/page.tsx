'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { LoadingState, CardSkeleton, ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('overview');
  const [reportFilter, setReportFilter] = useState('PENDING');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [reportToResolve, setReportToResolve] = useState<Report | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [syncLimit, setSyncLimit] = useState('100');

  // Redirect if not admin
  if (user && user.role !== 'ADMIN') {
    router.push('/profile');
    return null;
  }

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
    enabled: user?.role === 'ADMIN',
  });

  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['adminReports', reportFilter],
    queryFn: () =>
      apiClient.get<{ data: Report[]; total: number }>('/admin/reports', {
        params: reportFilter ? { status: reportFilter } : {},
      }),
    enabled: user?.role === 'ADMIN',
  });

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers', userSearch, userRoleFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (userSearch) params.search = userSearch;
      if (userRoleFilter) params.role = userRoleFilter;
      return apiClient.get<{ data: User[]; total: number }>('/admin/users', { params });
    },
    enabled: user?.role === 'ADMIN',
  });

  // Fetch schools
  const { data: schoolsData, isLoading: schoolsLoading, refetch: refetchSchools } = useQuery({
    queryKey: ['adminSchools', schoolSearch],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>('/schools', {
        params: { search: schoolSearch ?? '', pageSize: '50' },
      }),
    enabled: user?.role === 'ADMIN',
  });

  // Update report mutation
  const updateReportMutation = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      apiClient.put(`/admin/reports/${id}`, { status, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setReportToResolve(null);
      toast.success('举报已处理');
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
      toast.success('用户角色已更新');
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
      toast.success('用户已删除');
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
      toast.success(`同步完成: ${data.synced} 所学校`);
    },
    onError: (error: Error) => {
      toast.error(error.message || '同步失败');
    },
  });

  // Scrape school websites
  const scrapeSchoolsMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: string[]; failed: { school: string; error: string }[] }>('/schools/scrape/all'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(`爬取完成: ${data.success.length} 所学校`);
    },
    onError: (error: Error) => {
      toast.error(error.message || '爬取失败');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />待处理</Badge>;
      case 'REVIEWED':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />已审核</Badge>;
      case 'RESOLVED':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />已解决</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="destructive">管理员</Badge>;
      case 'VERIFIED':
        return <Badge variant="default">已认证</Badge>;
      default:
        return <Badge variant="secondary">普通用户</Badge>;
    }
  };

  const getTargetTypeName = (type: string) => {
    switch (type) {
      case 'USER': return '用户';
      case 'MESSAGE': return '消息';
      case 'CASE': return '案例';
      case 'REVIEW': return '评价';
      default: return type;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="管理后台"
        description="管理用户、处理举报、查看系统数据"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            概览
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            举报
            {stats?.pendingReports ? (
              <Badge variant="destructive">{stats.pendingReports}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            用户
          </TabsTrigger>
          <TabsTrigger value="schools" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            学校数据
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {statsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : stats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.verifiedUsers} 已验证
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">录取案例</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCases}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">待处理举报</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{stats.pendingReports}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">评价数量</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalReviews}</div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <div className="mb-4">
            <Select value={reportFilter} onValueChange={setReportFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">待处理</SelectItem>
                <SelectItem value="REVIEWED">已审核</SelectItem>
                <SelectItem value="RESOLVED">已解决</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
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
                          举报人: {report.reporter.email} · {format(new Date(report.createdAt), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                      {report.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateReportMutation.mutate({ id: report.id, status: 'REVIEWED' })}
                          >
                            标记已审核
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setReportToResolve(report)}
                          >
                            处理
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
              title="暂无举报"
              description="当前筛选条件下没有举报记录"
            />
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索用户邮箱..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部角色</SelectItem>
                <SelectItem value="USER">普通用户</SelectItem>
                <SelectItem value="VERIFIED">已认证</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
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
                      <TableHead>用户</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>案例/评价</TableHead>
                      <TableHead>注册时间</TableHead>
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
                              已验证
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3 text-amber-500" />
                              未验证
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u._count.admissionCases} / {u._count.reviewsGiven}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(u.createdAt), 'yyyy-MM-dd')}
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
                                onClick={() => updateUserRoleMutation.mutate({ userId: u.id, role: 'VERIFIED' })}
                                disabled={u.role === 'VERIFIED' || u.role === 'ADMIN'}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                设为已认证
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateUserRoleMutation.mutate({ userId: u.id, role: 'USER' })}
                                disabled={u.role === 'USER' || u.role === 'ADMIN'}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                设为普通用户
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setUserToDelete(u.id)}
                                className="text-destructive focus:text-destructive"
                                disabled={u.role === 'ADMIN'}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除用户
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
              title="未找到用户"
              description="尝试其他搜索条件"
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
                  College Scorecard 同步
                </CardTitle>
                <CardDescription>
                  从美国教育部官方 API 同步学校数据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Select value={syncLimit} onValueChange={setSyncLimit}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 所</SelectItem>
                      <SelectItem value="500">500 所</SelectItem>
                      <SelectItem value="1000">1000 所</SelectItem>
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
                    同步
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  学校官网爬取
                </CardTitle>
                <CardDescription>
                  爬取截止日期、文书题目等信息
                </CardDescription>
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
                  爬取 Top 10
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  数据状态
                </CardTitle>
                <CardDescription>
                  当前数据库学校数量
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {schoolsData?.total || 0} 所
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  数据周期: 2025-2026 申请季
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索学校..."
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
                      <TableHead className="w-[60px]">排名</TableHead>
                      <TableHead>学校名称</TableHead>
                      <TableHead>州</TableHead>
                      <TableHead>申请类型</TableHead>
                      <TableHead>截止日期</TableHead>
                      <TableHead>录取率</TableHead>
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
                            <div className="font-medium">{school.nameZh || school.name}</div>
                            {school.nameZh && (
                              <div className="text-xs text-muted-foreground">{school.name}</div>
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
              title="未找到学校"
              description="尝试其他搜索条件"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Report Dialog */}
      <AlertDialog open={!!reportToResolve} onOpenChange={() => setReportToResolve(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>处理举报</AlertDialogTitle>
            <AlertDialogDescription>
              确认将此举报标记为已解决？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reportToResolve &&
                updateReportMutation.mutate({
                  id: reportToResolve.id,
                  status: 'RESOLVED',
                  resolution: '管理员已处理',
                })
              }
            >
              {updateReportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认解决
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将软删除该用户，用户数据将被保留但无法登录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

