'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Ban, UserCheck, Users, X, Loader2 } from 'lucide-react';

interface UsersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  selectedCount: number;
  onBulkRole: (role: string) => void;
  onBulkBan: () => void;
  onClearSelection: () => void;
  isBulkPending: boolean;
}

export function UsersToolbar({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  selectedCount,
  onBulkRole,
  onBulkBan,
  onClearSelection,
  isBulkPending,
}: UsersToolbarProps) {
  const t = useTranslations('admin');

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.open('/api/admin/export/users', '_blank');
          }}
        >
          <Download className="h-4 w-4 mr-1.5" />
          {t('users.exportCsv')}
        </Button>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          {isBulkPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="text-sm font-medium">
            {t('users.selectedCount', { count: selectedCount })}
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkRole('VERIFIED')}
            disabled={isBulkPending}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            {t('users.bulkSetVerified')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkRole('USER')}
            disabled={isBulkPending}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {t('users.bulkSetUser')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={onBulkBan}
            disabled={isBulkPending}
          >
            <Ban className="h-3.5 w-3.5 mr-1.5" />
            {t('users.bulkBan')}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
