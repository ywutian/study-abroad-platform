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
import { Search, Download } from 'lucide-react';

interface UsersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
}

export function UsersToolbar({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
}: UsersToolbarProps) {
  const t = useTranslations('admin');

  return (
    <div className="mb-4 flex gap-4">
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
  );
}
