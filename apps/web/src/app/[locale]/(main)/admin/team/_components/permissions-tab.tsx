'use client';

import { useState, useEffect, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListSkeleton } from '@/components/ui/loading-state';
import { AdminFeatureGuide } from '../../_components/admin-feature-guide';
import { ContextualHelp } from '@/components/ui/contextual-help';
import { RoleBadge } from '../../_components/role-badge';
import { toast } from 'sonner';
import { Save, Lock, Search, User, RotateCcw } from 'lucide-react';

interface RolePermissionEntry {
  role: string;
  permission: string;
  granted: boolean;
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  cases: ['case:create', 'case:review', 'case:delete'],
  essays: ['essay:manage'],
  schools: ['school:edit', 'school:review'],
  highschool: ['highschool:manage'],
  calendar: ['calendar:manage'],
  users: ['user:view', 'user:manage', 'user:delete', 'user:ban'],
  content: ['content:moderate'],
  verification: ['verification:review'],
  data: ['data:export', 'data:health', 'data:sync'],
  system: ['system:settings', 'system:roles', 'system:calibration'],
  ai: ['ai:config'],
  audit: ['audit:view'],
  notifications: ['notification:broadcast'],
  payment: ['payment:view', 'payment:manage'],
  dashboard: ['dashboard:full'],
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

      {/* User-level permission overrides */}
      <UserPermissionEditor />
    </div>
  );
}

// ──────────────────────────────────────────────────
// User-level permission editor
// ──────────────────────────────────────────────────

interface Operator {
  id: string;
  email: string;
  role: string;
  profile?: { nickname?: string; realName?: string } | null;
}

interface UserPermissionOverride {
  permission: string;
  granted: boolean;
  grantedBy?: string;
  updatedAt?: string;
}

const PERMISSION_PRESETS: Record<string, { nameKey: string; permissions: string[] }> = {
  DATA_OPS: {
    nameKey: 'team.permissions.presetNames.dataOps',
    permissions: [
      'case:create',
      'case:review',
      'essay:manage',
      'school:edit',
      'school:review',
      'data:health',
      'highschool:manage',
      'calendar:manage',
    ],
  },
  CONTENT_MOD: {
    nameKey: 'team.permissions.presetNames.contentMod',
    permissions: ['content:moderate', 'case:review', 'user:view', 'audit:view'],
  },
  USER_OPS: {
    nameKey: 'team.permissions.presetNames.userOps',
    permissions: [
      'user:view',
      'verification:review',
      'payment:view',
      'audit:view',
      'notification:broadcast',
    ],
  },
  TECH_OPS: {
    nameKey: 'team.permissions.presetNames.techOps',
    permissions: ['ai:config', 'system:calibration', 'data:sync', 'data:health', 'audit:view'],
  },
  INTERN: {
    nameKey: 'team.permissions.presetNames.intern',
    permissions: ['case:create', 'school:edit', 'data:health'],
  },
};

function UserPermissionEditor() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean | null>>({});
  const [isUserDirty, setIsUserDirty] = useState(false);

  // Get list of operators
  const { data: operators } = useQuery({
    queryKey: ['adminOperators'],
    queryFn: () => apiClient.get<Operator[]>('/admin/roles/operators'),
  });

  // Get user permissions when selected
  const { data: userPerms, isLoading: userPermsLoading } = useQuery({
    queryKey: ['adminUserPermissions', selectedUserId],
    queryFn: () =>
      apiClient.get<{ user: Operator; overrides: UserPermissionOverride[] }>(
        `/admin/roles/users/${selectedUserId}/permissions`
      ),
    enabled: !!selectedUserId,
  });

  useEffect(() => {
    if (!userPerms) return;
    const map: Record<string, boolean | null> = {};
    for (const override of userPerms.overrides) {
      map[override.permission] = override.granted;
    }
    setUserOverrides(map);
    setIsUserDirty(false);
  }, [userPerms]);

  const saveUserPermsMutation = useMutation({
    mutationFn: (data: { permissions: Array<{ permission: string; granted: boolean }> }) =>
      apiClient.put(`/admin/roles/users/${selectedUserId}/permissions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUserPermissions', selectedUserId] });
      setIsUserDirty(false);
      toast.success(t('team.permissions.saved'));
    },
  });

  const toggleUserOverride = (permission: string) => {
    setUserOverrides((prev) => {
      const current = prev[permission];
      // Cycle: null (inherit) → true (grant) → false (deny) → null
      let next: boolean | null;
      if (current === null || current === undefined) next = true;
      else if (current === true) next = false;
      else next = null;
      const updated = { ...prev };
      if (next === null) {
        delete updated[permission];
      } else {
        updated[permission] = next;
      }
      return updated;
    });
    setIsUserDirty(true);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PERMISSION_PRESETS[presetKey];
    if (!preset) return;
    const allPerms = Object.values(PERMISSION_GROUPS).flat();
    const newOverrides: Record<string, boolean | null> = {};
    for (const perm of allPerms) {
      if (preset.permissions.includes(perm)) {
        newOverrides[perm] = true;
      } else {
        newOverrides[perm] = false;
      }
    }
    setUserOverrides(newOverrides);
    setIsUserDirty(true);
  };

  const clearOverrides = () => {
    setUserOverrides({});
    setIsUserDirty(true);
  };

  const handleSaveUserPerms = () => {
    const permissions = Object.entries(userOverrides)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([permission, granted]) => ({ permission, granted: granted as boolean }));
    saveUserPermsMutation.mutate({ permissions });
  };

  const getOverrideLabel = (permission: string) => {
    const val = userOverrides[permission];
    if (val === true)
      return (
        <Badge variant="success" className="text-[10px]">
          {t('team.permissions.granted')}
        </Badge>
      );
    if (val === false)
      return (
        <Badge variant="destructive" className="text-[10px]">
          {t('team.permissions.denied')}
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-[10px]">
        {t('team.permissions.inherit')}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('team.permissions.userOverrides')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('team.permissions.userOverridesDesc')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t('team.permissions.selectUser')} />
          </SelectTrigger>
          <SelectContent>
            {operators?.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                <div className="flex items-center gap-2">
                  <span>{op.profile?.nickname || op.profile?.realName || op.email}</span>
                  <RoleBadge role={op.role} size="sm" />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedUserId && (
          <div className="flex items-center gap-2">
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('team.permissions.applyPreset')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {t(preset.nameKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearOverrides}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('team.permissions.clearOverrides')}
            </Button>
          </div>
        )}
      </div>

      {selectedUserId && userPermsLoading && <ListSkeleton />}

      {selectedUserId && userPerms && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">{t('team.permissions.permission')}</TableHead>
                  <TableHead className="text-center w-[120px]">
                    {t('team.permissions.override')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                  <Fragment key={group}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="py-1.5">
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
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => toggleUserOverride(perm)}
                            className="inline-flex items-center"
                          >
                            {getOverrideLabel(perm)}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isUserDirty && selectedUserId && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveUserPerms}
            disabled={saveUserPermsMutation.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {t('team.permissions.saveChanges')}
          </Button>
        </div>
      )}
    </div>
  );
}
