'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Eye,
} from 'lucide-react';

export interface User {
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

interface UsersTableProps {
  users: User[];
  onUpdateRole: (userId: string, role: string) => void;
  onBanUser: (user: User) => void;
  onUnbanUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export function UsersTable({
  users,
  onUpdateRole,
  onBanUser,
  onUnbanUser,
  onDeleteUser,
}: UsersTableProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();

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
            {users.map((u) => (
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
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/users/${u.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t('users.viewDetail')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onUpdateRole(u.id, 'VERIFIED')}
                        disabled={u.role === 'VERIFIED' || u.role === 'ADMIN'}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        {t('users.setVerified')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onUpdateRole(u.id, 'USER')}
                        disabled={u.role === 'USER' || u.role === 'ADMIN'}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {t('users.setUser')}
                      </DropdownMenuItem>
                      {u.isBanned ? (
                        <DropdownMenuItem
                          onClick={() => onUnbanUser(u.id)}
                          disabled={u.role === 'ADMIN'}
                        >
                          <ShieldOff className="mr-2 h-4 w-4" />
                          {t('ban.unbanUser')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onBanUser(u)}
                          className="text-destructive focus:text-destructive"
                          disabled={u.role === 'ADMIN'}
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          {t('ban.banUser')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onDeleteUser(u.id)}
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
  );
}
