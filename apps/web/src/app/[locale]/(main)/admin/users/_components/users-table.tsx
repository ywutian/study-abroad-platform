'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  UserCheck,
  Trash2,
  Ban,
  ShieldOff,
  Shield,
  Wrench,
  Eye,
} from 'lucide-react';
import { RoleBadge, getRoleLevel, canAssignRole } from '../../_components/role-badge';
import { useAuthStore } from '@/stores/auth';

export interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  emailVerified: boolean;
  locale: string;
  createdAt: string;
  isBanned?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  _count?: {
    admissionCases: number;
    reviewsGiven: number;
  };
}

interface UsersTableProps {
  users: User[];
  onUpdateRole: (userId: string, role: string) => void;
  onBanUser: (user: User) => void;
  onUnbanUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  selectedUsers: Set<string>;
  onToggleUser: (userId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}

export function UsersTable({
  users,
  onUpdateRole,
  onBanUser,
  onUnbanUser,
  onDeleteUser,
  selectedUsers,
  onToggleUser,
  onToggleAll,
}: UsersTableProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const currentUser = useAuthStore((s) => s.user);
  const currentRole = currentUser?.role || 'ADMIN';

  const isHigherRole = (targetRole: string) => getRoleLevel(currentRole) > getRoleLevel(targetRole);
  const canModify = (targetRole: string) => isHigherRole(targetRole);

  return (
    <Card>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={users.length > 0 && users.every((u) => selectedUsers.has(u.id))}
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                  aria-label={t('users.selectAll')}
                />
              </TableHead>
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
            {users.map((u) => {
              const counts = {
                admissionCases: u._count?.admissionCases ?? 0,
                reviewsGiven: u._count?.reviewsGiven ?? 0,
              };

              return (
                <TableRow key={u.id} data-selected={selectedUsers.has(u.id) || undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.has(u.id)}
                      onCheckedChange={(checked) => onToggleUser(u.id, !!checked)}
                      aria-label={`${t('users.selectUser')} ${u.email}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[200px]">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
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
                    {counts.admissionCases} / {counts.reviewsGiven}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmt.dateTime(new Date(u.createdAt), 'medium')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 md:h-8 md:w-8"
                          aria-label={`${t('users.actions')} ${u.email}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${u.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('users.viewDetail')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.role !== 'USER' && canModify(u.role) && (
                          <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'USER')}>
                            <Users className="mr-2 h-4 w-4" />
                            {t('users.setUser')}
                          </DropdownMenuItem>
                        )}
                        {u.role !== 'VERIFIED' && canModify(u.role) && (
                          <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'VERIFIED')}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            {t('users.setVerified')}
                          </DropdownMenuItem>
                        )}
                        {u.role !== 'OPERATOR' &&
                          canAssignRole(currentRole, 'OPERATOR') &&
                          canModify(u.role) && (
                            <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'OPERATOR')}>
                              <Wrench className="mr-2 h-4 w-4" />
                              {t('roles.setOperator')}
                            </DropdownMenuItem>
                          )}
                        {u.role !== 'ADMIN' &&
                          canAssignRole(currentRole, 'ADMIN') &&
                          canModify(u.role) && (
                            <DropdownMenuItem onClick={() => onUpdateRole(u.id, 'ADMIN')}>
                              <Shield className="mr-2 h-4 w-4" />
                              {t('roles.setAdmin')}
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuSeparator />
                        {u.isBanned ? (
                          <DropdownMenuItem
                            onClick={() => onUnbanUser(u.id)}
                            disabled={!canModify(u.role)}
                          >
                            <ShieldOff className="mr-2 h-4 w-4" />
                            {t('ban.unbanUser')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => onBanUser(u)}
                            className="text-destructive focus:text-destructive"
                            disabled={!canModify(u.role)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            {t('ban.banUser')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDeleteUser(u.id)}
                          className="text-destructive focus:text-destructive"
                          disabled={!canModify(u.role)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('users.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
