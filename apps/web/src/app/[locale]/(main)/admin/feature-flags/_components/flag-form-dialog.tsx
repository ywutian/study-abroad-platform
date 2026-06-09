'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { adminFeatureFlagRoutes } from '@study-abroad/shared/constants';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { type FeatureFlag } from './feature-flag-types';

interface StructuredRules {
  roles: string[];
  userIds: string[];
  percentage: number | null;
}

interface FlagFormData {
  key: string;
  description: string;
  enabled: boolean;
  rulesJson: string;
  structuredRules: StructuredRules;
  ruleMode: 'visual' | 'json';
}

const EMPTY_STRUCTURED: StructuredRules = { roles: [], userIds: [], percentage: null };

const EMPTY_FORM: FlagFormData = {
  key: '',
  description: '',
  enabled: false,
  rulesJson: '',
  structuredRules: EMPTY_STRUCTURED,
  ruleMode: 'visual',
};

const ALL_ROLES = ['USER', 'VERIFIED', 'OPERATOR', 'ADMIN'] as const;

function structuredToJson(rules: StructuredRules): string {
  const obj: Record<string, unknown> = {};
  if (rules.roles.length > 0) obj.roles = rules.roles;
  if (rules.userIds.length > 0) obj.userIds = rules.userIds;
  if (rules.percentage !== null) obj.percentage = rules.percentage;
  if (Object.keys(obj).length === 0) return '';
  return JSON.stringify(obj, null, 2);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonToStructured(json: string): StructuredRules {
  if (!json.trim()) return EMPTY_STRUCTURED;
  try {
    const parsed = JSON.parse(json);
    return {
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      userIds: Array.isArray(parsed.userIds) ? parsed.userIds : [],
      percentage: typeof parsed.percentage === 'number' ? parsed.percentage : null,
    };
  } catch {
    return EMPTY_STRUCTURED;
  }
}

function parseRulesJson(json: string): Record<string, unknown> | undefined {
  if (!json.trim()) return undefined;
  return JSON.parse(json);
}

interface FlagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingFlag: FeatureFlag | null;
  onSaved: () => void;
}

export function FlagFormDialog({ open, onOpenChange, editingFlag, onSaved }: FlagFormDialogProps) {
  const t = useTranslations('admin.featureFlags');
  const [form, setForm] = useState<FlagFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open && editingFlag) {
      const rulesJson = editingFlag.rules ? JSON.stringify(editingFlag.rules, null, 2) : '';
      setForm({
        key: editingFlag.key,
        description: editingFlag.description ?? '',
        enabled: editingFlag.enabled,
        rulesJson,
        structuredRules: jsonToStructured(rulesJson),
        ruleMode: 'visual',
      });
    } else if (open) {
      setForm(EMPTY_FORM);
    }
  }, [open, editingFlag]);

  const createMutation = useMutation({
    mutationFn: (data: {
      key: string;
      description?: string;
      enabled?: boolean;
      rules?: Record<string, unknown>;
    }) => apiClient.post(adminFeatureFlagRoutes.list(), data),
    onSuccess: () => {
      // @cache-invalidation-allowed: onSaved() callback invalidates the parent's adminFeatureFlags query (see feature-flags/page.tsx)
      onOpenChange(false);
      toast.success(t('created'));
      onSaved();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(adminFeatureFlagRoutes.byId(id), data),
    onSuccess: () => {
      // @cache-invalidation-allowed: onSaved() callback invalidates the parent's adminFeatureFlags query (see feature-flags/page.tsx)
      onOpenChange(false);
      toast.success(t('updated'));
      onSaved();
    },
  });

  const handleSubmit = () => {
    try {
      const rulesJson =
        form.ruleMode === 'visual' ? structuredToJson(form.structuredRules) : form.rulesJson;
      const rules = parseRulesJson(rulesJson);
      const data = {
        key: form.key,
        description: form.description || undefined,
        enabled: form.enabled,
        rules,
      };

      if (editingFlag) {
        updateMutation.mutate({ id: editingFlag.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch {
      toast.error(t('invalidJson'));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingFlag ? t('editDialog.title') : t('createDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('createDialog.keyLabel')}</Label>
            <Input
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder={t('createDialog.keyPlaceholder')}
              disabled={!!editingFlag}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('createDialog.descriptionLabel')}</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('createDialog.descriptionPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
            />
            <Label>{t('createDialog.enabledLabel')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('createDialog.rulesLabel')}</Label>
            <Tabs
              value={form.ruleMode}
              onValueChange={(v) => {
                const mode = v as 'visual' | 'json';
                if (mode === 'json') {
                  setForm((f) => ({
                    ...f,
                    ruleMode: 'json',
                    rulesJson: structuredToJson(f.structuredRules),
                  }));
                } else {
                  setForm((f) => ({
                    ...f,
                    ruleMode: 'visual',
                    structuredRules: jsonToStructured(f.rulesJson),
                  }));
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="visual">{t('createDialog.visualMode')}</TabsTrigger>
                <TabsTrigger value="json">{t('createDialog.jsonMode')}</TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="space-y-4 mt-3">
                {/* Roles */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('createDialog.roles')}</Label>
                  <div className="flex flex-wrap gap-3">
                    {ALL_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={form.structuredRules.roles.includes(role)}
                          onCheckedChange={(checked) =>
                            setForm((f) => ({
                              ...f,
                              structuredRules: {
                                ...f.structuredRules,
                                roles: checked
                                  ? [...f.structuredRules.roles, role]
                                  : f.structuredRules.roles.filter((r) => r !== role),
                              },
                            }))
                          }
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>
                {/* User IDs */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('createDialog.userIds')}</Label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {form.structuredRules.userIds.map((uid) => (
                      <Badge key={uid} variant="secondary" className="gap-1 text-xs">
                        <span className="max-w-[120px] truncate font-mono">{uid}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              structuredRules: {
                                ...f.structuredRules,
                                userIds: f.structuredRules.userIds.filter((id) => id !== uid),
                              },
                            }))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder={t('createDialog.userIdPlaceholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const value = e.currentTarget.value.trim();
                        if (
                          value &&
                          UUID_RE.test(value) &&
                          !form.structuredRules.userIds.includes(value)
                        ) {
                          setForm((f) => ({
                            ...f,
                            structuredRules: {
                              ...f.structuredRules,
                              userIds: [...f.structuredRules.userIds, value],
                            },
                          }));
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData('text');
                      const ids = text
                        .split(/[\s,;]+/)
                        .map((s) => s.trim())
                        .filter((s) => UUID_RE.test(s));
                      if (ids.length > 0) {
                        setForm((f) => ({
                          ...f,
                          structuredRules: {
                            ...f.structuredRules,
                            userIds: [...new Set([...f.structuredRules.userIds, ...ids])],
                          },
                        }));
                      }
                    }}
                  />
                </div>
                {/* Percentage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('createDialog.percentage')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {form.structuredRules.percentage !== null
                        ? `${form.structuredRules.percentage}%`
                        : t('createDialog.percentageOff')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.structuredRules.percentage !== null}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          structuredRules: {
                            ...f.structuredRules,
                            percentage: checked ? 50 : null,
                          },
                        }))
                      }
                    />
                    <Slider
                      value={[form.structuredRules.percentage ?? 50]}
                      onValueChange={([v]) =>
                        setForm((f) => ({
                          ...f,
                          structuredRules: { ...f.structuredRules, percentage: v },
                        }))
                      }
                      min={0}
                      max={100}
                      step={1}
                      disabled={form.structuredRules.percentage === null}
                      className="flex-1"
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="json" className="mt-3">
                <Textarea
                  value={form.rulesJson}
                  onChange={(e) => setForm((f) => ({ ...f, rulesJson: e.target.value }))}
                  placeholder='{"roles": ["ADMIN"], "percentage": 50}'
                  className="font-mono text-sm"
                  rows={6}
                />
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">{t('createDialog.rulesHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!form.key.trim() || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingFlag ? t('save') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
