'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
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
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkBanOpen, setBulkBanOpen] = useState(false);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['adminUsers', userSearch, userRoleFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (userSearch) params.search = userSearch;
      if (userRoleFilter && userRoleFilter !== 'ALL') params.role = userRoleFilter;
      return apiClient.get<{ data: User[]; total: number; totalPages: number }>(
        adminRoutes.users(),
        {
          params,
        }
      );
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.post(adminRoutes.userRoleAssign(userId), { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(t('toast.roleUpdated'));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(adminRoutes.userById(userId)),
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
    }) =>
      apiClient.post(adminRoutes.userBan(userId), {
        reason,
        durationHours,
        permanent,
      }),
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
    mutationFn: (userId: string) => apiClient.post(adminRoutes.userUnban(userId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToUnban(null);
      toast.success(t('ban.userUnbanned'));
    },
  });

  const handleSearchChange = (value: string) => {
    setUserSearch(value);
    setPage(1);
    setSelectedUsers(new Set());
  };

  const handleRoleFilterChange = (value: string) => {
    setUserRoleFilter(value);
    setPage(1);
    setSelectedUsers(new Set());
  };

  // Bulk operations
  const bulkRoleMutation = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: string }) => {
      const results = await Promise.allSettled(
        userIds.map((userId) => apiClient.post(adminRoutes.userRoleAssign(userId), { role }))
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      return { successCount, total: userIds.length };
    },
    onSuccess: ({ successCount, total }) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSelectedUsers(new Set());
      toast.success(t('users.bulkRoleSuccess', { count: successCount, total }));
    },
  });

  const bulkBanMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const results = await Promise.allSettled(
        userIds.map((userId) =>
          apiClient.post(adminRoutes.userBan(userId), {
            reason: banReason,
            permanent: banPermanent,
            ...(banPermanent ? {} : { durationHours: banDuration }),
          })
        )
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      return { successCount, total: userIds.length };
    },
    onSuccess: ({ successCount, total }) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSelectedUsers(new Set());
      setUserToBan(null);
      setBanReason('');
      setBanDuration(24);
      setBanPermanent(false);
      toast.success(t('users.bulkBanSuccess', { count: successCount, total }));
    },
  });

  const handleToggleUser = useCallback((userId: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked && usersData?.data) {
        setSelectedUsers(new Set(usersData.data.map((u) => u.id)));
      } else {
        setSelectedUsers(new Set());
      }
    },
    [usersData?.data]
  );

  const handleBulkRole = useCallback(
    (role: string) => {
      const userIds = Array.from(selectedUsers);
      if (userIds.length > 0) bulkRoleMutation.mutate({ userIds, role });
    },
    [selectedUsers, bulkRoleMutation]
  );

  const handleBulkBan = useCallback(() => {
    if (selectedUsers.size > 0) {
      setBulkBanOpen(true);
    }
  }, [selectedUsers]);

  const handleConfirmBan = () => {
    if (bulkBanOpen) {
      bulkBanMutation.mutate(Array.from(selectedUsers));
      setBulkBanOpen(false);
    } else if (userToBan) {
      banUserMutation.mutate({
        userId: userToBan.id,
        reason: banReason,
        durationHours: banPermanent ? undefined : banDuration,
        permanent: banPermanent,
      });
    }
  };

  const isBulkPending = bulkRoleMutation.isPending || bulkBanMutation.isPending;

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
          selectedCount={selectedUsers.size}
          onBulkRole={handleBulkRole}
          onBulkBan={handleBulkBan}
          onClearSelection={() => setSelectedUsers(new Set())}
          isBulkPending={isBulkPending}
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
              selectedUsers={selectedUsers}
              onToggleUser={handleToggleUser}
              onToggleAll={handleToggleAll}
            />
            <PaginationControls
              page={page}
              totalPages={usersData.totalPages ?? 1}
              total={usersData.total ?? 0}
              pageSize={pageSize}
              onPageChange={(p) => {
                setPage(p);
                setSelectedUsers(new Set());
              }}
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
        userToBan={
          bulkBanOpen
            ? ({ id: '', email: t('users.selectedCount', { count: selectedUsers.size }) } as User)
            : userToBan
        }
        onClose={() => {
          setUserToBan(null);
          setBulkBanOpen(false);
        }}
        banReason={banReason}
        onBanReasonChange={setBanReason}
        banDuration={banDuration}
        onBanDurationChange={setBanDuration}
        banPermanent={banPermanent}
        onBanPermanentChange={setBanPermanent}
        onConfirmBan={handleConfirmBan}
        isPending={banUserMutation.isPending || bulkBanMutation.isPending}
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
