'use client';

import { useState, useEffect, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { AdminFeatureGuide } from '../../_components/admin-feature-guide';
import { ContextualHelp } from '@/components/ui/contextual-help';
import { toast } from 'sonner';
import { Save, Lock } from 'lucide-react';

interface RolePermissionEntry {
  role: string;
  permission: string;
  granted: boolean;
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  cases: ['case:create', 'case:review', 'case:delete'],
  essays: ['essay:manage'],
  schools: ['school:edit', 'school:review'],
  users: ['user:view', 'user:manage', 'user:delete', 'user:ban'],
  content: ['content:moderate'],
  data: ['data:export', 'data:health', 'data:sync'],
  system: ['system:settings', 'system:roles', 'system:calibration'],
  ai: ['ai:config'],
  audit: ['audit:view'],
  notifications: ['notification:broadcast'],
};

const EDITABLE_ROLES = ['OPERATOR', 'ADMIN'] as const;

export function PermissionsTab() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [localPerms, setLocalPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['adminPermissions'],
    queryFn: () => apiClient.get<RolePermissionEntry[]>('/admin/roles/permissions'),
  });

  useEffect(() => {
    if (!permissions) return;
    const map: Record<string, Record<string, boolean>> = { OPERATOR: {}, ADMIN: {} };
    for (const entry of permissions) {
      if (entry.role === 'OPERATOR' || entry.role === 'ADMIN') {
        map[entry.role][entry.permission] = entry.granted;
      }
    }
    setLocalPerms(map);
    setIsDirty(false);
  }, [permissions]);

  const saveMutation = useMutation({
    mutationFn: (data: { permissions: RolePermissionEntry[] }) =>
      apiClient.put('/admin/roles/permissions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPermissions'] });
      setIsDirty(false);
      toast.success(t('team.permissions.saved'));
    },
  });

  const togglePermission = (role: string, permission: string) => {
    setLocalPerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role]?.[permission],
      },
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    const entries: RolePermissionEntry[] = [];
    for (const role of EDITABLE_ROLES) {
      for (const permission of Object.values(PERMISSION_GROUPS).flat()) {
        entries.push({
          role,
          permission,
          granted: localPerms[role]?.[permission] ?? false,
        });
      }
    }
    saveMutation.mutate({ permissions: entries });
  };

  if (isLoading) return <ListSkeleton />;

  const allPermissions = Object.values(PERMISSION_GROUPS).flat();

  return (
    <div className="space-y-6">
      <AdminFeatureGuide
        title={t('team.permissions.guideTitle')}
        steps={[
          t('team.permissions.guideStep1'),
          t('team.permissions.guideStep2'),
          t('team.permissions.guideStep3'),
        ]}
        warnings={[t('team.permissions.guideWarning')]}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">{t('team.permissions.permission')}</TableHead>
                <TableHead className="text-center w-[120px]">{t('roles.operator')}</TableHead>
                <TableHead className="text-center w-[120px]">{t('roles.admin')}</TableHead>
                <TableHead className="text-center w-[120px]">
                  <div className="flex items-center justify-center gap-1">
                    {t('roles.superAdmin')}
                    <ContextualHelp
                      variant="info"
                      title={t('team.permissions.superAdminTitle')}
                      description={t('team.permissions.superAdminDesc')}
                    />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <Fragment key={group}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(`team.permissions.groups.${group}`)}
                      </span>
                    </TableCell>
                  </TableRow>
                  {perms.map((perm) => (
                    <TableRow key={perm}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">{perm}</span>
                          <p className="text-xs text-muted-foreground">
                            {t(`team.permissions.desc.${perm.replace(':', '_')}`)}
                          </p>
                        </div>
                      </TableCell>
                      {EDITABLE_ROLES.map((role) => (
                        <TableCell key={role} className="text-center">
                          <Switch
                            checked={localPerms[role]?.[perm] ?? false}
                            onCheckedChange={() => togglePermission(role, perm)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isDirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {t('team.permissions.saveChanges')}
          </Button>
        </div>
      )}
    </div>
  );
}
