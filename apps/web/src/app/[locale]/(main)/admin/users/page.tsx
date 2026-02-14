'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
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
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Users,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  UserCheck,
  Trash2,
  Loader2,
  Ban,
  ShieldOff,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  locale: string;
  createdAt: string;
  isBanned?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  _count: {
    admissionCases: number;
    reviewsGiven: number;
  };
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToBan, setUserToBan] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState(24);
  const [banPermanent, setBanPermanent] = useState(false);
  const [userToUnban, setUserToUnban] = useState<string | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['adminUsers', userSearch, userRoleFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (userSearch) params.search = userSearch;
      if (userRoleFilter && userRoleFilter !== 'ALL') params.role = userRoleFilter;
      return apiClient.get<{ data: User[]; total: number; totalPages: number }>('/admin/users', {
        params,
      });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.put(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(t('toast.roleUpdated'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setUserToDelete(null);
      toast.success(t('toast.userDeleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const banUserMutation = useMutation({
    mutationFn: ({
      userId,
      reason,
      durationHours,
      permanent,
    }: {
      userId: string;
      reason: string;
      durationHours?: number;
      permanent?: boolean;
    }) => apiClient.post(`/admin/users/${userId}/ban`, { reason, durationHours, permanent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToBan(null);
      setBanReason('');
      setBanDuration(24);
      setBanPermanent(false);
      toast.success(t('ban.userBanned'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/admin/users/${userId}/unban`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToUnban(null);
      toast.success(t('ban.userUnbanned'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="purple">{t('roles.admin')}</Badge>;
      case 'VERIFIED':
        return <Badge variant="success">{t('roles.verified')}</Badge>;
      default:
        return <Badge variant="secondary">{t('roles.user')}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title={t('sidebar.users')}
        description={t('users.pageDesc')}
        icon={Users}
        color="blue"
      />

      <div className="mt-6">
        <div className="mb-4 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('users.searchPlaceholder')}
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={userRoleFilter}
            onValueChange={(v) => {
              setUserRoleFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('users.allRoles')}</SelectItem>
              <SelectItem value="USER">{t('roles.user')}</SelectItem>
              <SelectItem value="VERIFIED">{t('roles.verified')}</SelectItem>
              <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : usersData?.data && usersData.data.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('users.email')}</TableHead>
                      <TableHead>{t('users.role')}</TableHead>
                      <TableHead>{t('users.status')}</TableHead>
                      <TableHead>{t('ban.banUser')}</TableHead>
                      <TableHead>
                        {t('users.cases')}/{t('users.reviews')}
                      </TableHead>
                      <TableHead>{t('users.joinDate')}</TableHead>
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
                              {t('roles.verified')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3 text-amber-500" />
                              {t('users.notVerified')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.isBanned ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              {t('ban.banned')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              —
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
                                {t('users.setVerified')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUserRoleMutation.mutate({ userId: u.id, role: 'USER' })
                                }
                                disabled={u.role === 'USER' || u.role === 'ADMIN'}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                {t('users.setUser')}
                              </DropdownMenuItem>
                              {u.isBanned ? (
                                <DropdownMenuItem
                                  onClick={() => setUserToUnban(u.id)}
                                  disabled={u.role === 'ADMIN'}
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  {t('ban.unbanUser')}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setUserToBan(u)}
                                  className="text-destructive focus:text-destructive"
                                  disabled={u.role === 'ADMIN'}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  {t('ban.banUser')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setUserToDelete(u.id)}
                                className="text-destructive focus:text-destructive"
                                disabled={u.role === 'ADMIN'}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('users.delete')}
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
            <PaginationControls
              page={page}
              totalPages={usersData.totalPages ?? 1}
              total={usersData.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title={t('users.noResults')}
            description={t('users.noResultsDesc')}
          />
        )}
      </div>

      {/* Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteUserTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialogs.deleteUserDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('dialogs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban User Dialog */}
      <Dialog open={!!userToBan} onOpenChange={() => setUserToBan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ban.banUser')}</DialogTitle>
            <DialogDescription>{t('ban.banDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('ban.reason')}</Label>
              <Textarea
                placeholder={t('ban.reasonPlaceholder')}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('ban.permanent')}</Label>
              <Switch checked={banPermanent} onCheckedChange={setBanPermanent} />
            </div>
            {!banPermanent && (
              <div className="space-y-2">
                <Label>
                  {t('ban.duration')} ({t('ban.hours')})
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={banDuration}
                  onChange={(e) => setBanDuration(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToBan(null)}>
              {t('dialogs.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (userToBan) {
                  banUserMutation.mutate({
                    userId: userToBan.id,
                    reason: banReason,
                    durationHours: banPermanent ? undefined : banDuration,
                    permanent: banPermanent,
                  });
                }
              }}
              disabled={banUserMutation.isPending}
            >
              {banUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ban.banConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban User Dialog */}
      <AlertDialog open={!!userToUnban} onOpenChange={() => setUserToUnban(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ban.unbanUser')}</AlertDialogTitle>
            <AlertDialogDescription>{t('ban.unbanDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToUnban && unbanUserMutation.mutate(userToUnban)}>
              {unbanUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ban.unbanConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
