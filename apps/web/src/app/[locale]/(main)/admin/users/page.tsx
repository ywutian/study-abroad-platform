'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

import { UsersToolbar } from './_components/users-toolbar';
import { UsersTable } from './_components/users-table';
import type { User } from './_components/users-table';
import { BanUserDialog, UnbanUserDialog, DeleteUserDialog } from './_components/ban-user-dialog';

export default function AdminUsersPage() {
  const t = useTranslations('admin');
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
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setUserToDelete(null);
      toast.success(t('toast.userDeleted'));
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
  });

  const unbanUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/admin/users/${userId}/unban`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToUnban(null);
      toast.success(t('ban.userUnbanned'));
    },
  });

  const handleSearchChange = (value: string) => {
    setUserSearch(value);
    setPage(1);
  };

  const handleRoleFilterChange = (value: string) => {
    setUserRoleFilter(value);
    setPage(1);
  };

  const handleConfirmBan = () => {
    if (userToBan) {
      banUserMutation.mutate({
        userId: userToBan.id,
        reason: banReason,
        durationHours: banPermanent ? undefined : banDuration,
        permanent: banPermanent,
      });
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
        <UsersToolbar
          search={userSearch}
          onSearchChange={handleSearchChange}
          roleFilter={userRoleFilter}
          onRoleFilterChange={handleRoleFilterChange}
        />

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : usersData?.data && usersData.data.length > 0 ? (
          <>
            <UsersTable
              users={usersData.data}
              onUpdateRole={(userId, role) => updateUserRoleMutation.mutate({ userId, role })}
              onBanUser={setUserToBan}
              onUnbanUser={setUserToUnban}
              onDeleteUser={setUserToDelete}
            />
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

      <DeleteUserDialog
        userId={userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirmDelete={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
        isPending={deleteUserMutation.isPending}
      />

      <BanUserDialog
        userToBan={userToBan}
        onClose={() => setUserToBan(null)}
        banReason={banReason}
        onBanReasonChange={setBanReason}
        banDuration={banDuration}
        onBanDurationChange={setBanDuration}
        banPermanent={banPermanent}
        onBanPermanentChange={setBanPermanent}
        onConfirmBan={handleConfirmBan}
        isPending={banUserMutation.isPending}
      />

      <UnbanUserDialog
        userId={userToUnban}
        onClose={() => setUserToUnban(null)}
        onConfirmUnban={() => userToUnban && unbanUserMutation.mutate(userToUnban)}
        isPending={unbanUserMutation.isPending}
      />
    </>
  );
}
