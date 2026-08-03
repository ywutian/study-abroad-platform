import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  VaultItemType,
  vaultRoutes,
  type CreateVaultItemInput,
  type UpdateVaultItemInput,
  type VaultItem,
  type VaultItemDetail,
  type VaultStats,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  Modal,
  SearchBar,
  Select,
  useToast,
} from '@/components/ui';
import { borderRadius, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';

const TYPE_OPTIONS = [
  VaultItemType.CREDENTIAL,
  VaultItemType.PASSWORD,
  VaultItemType.DOCUMENT,
  VaultItemType.NOTE,
  VaultItemType.API_KEY,
  VaultItemType.OTHER,
];

export default function VaultScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | VaultItemType>('ALL');
  const [category, setCategory] = useState('ALL');
  const [detail, setDetail] = useState<VaultItemDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItemDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setDetail(null);
        setEditing(null);
        setFormOpen(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(
      () => () => {
        setDetail(null);
        setEditing(null);
        setFormOpen(false);
      },
      []
    )
  );

  const items = useQuery<VaultItem[]>({
    queryKey: ['vault', 'items', search, type, category],
    queryFn: () =>
      apiClient.get(vaultRoutes.list(), {
        params: {
          search: search || undefined,
          type: type === 'ALL' ? undefined : type,
          category: category === 'ALL' ? undefined : category,
        },
      }),
  });
  const stats = useQuery<VaultStats>({
    queryKey: ['vault', 'stats'],
    queryFn: () => apiClient.get(vaultRoutes.stats()),
  });
  const reveal = useMutation({
    mutationFn: (id: string) => apiClient.get<VaultItemDetail>(vaultRoutes.byId(id)),
    onSuccess: setDetail,
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(vaultRoutes.byId(id)),
    onSuccess: async () => {
      setDetail(null);
      toast.success(t('vault.deleted'));
      await queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([items.refetch(), stats.refetch()]);
    setRefreshing(false);
  };
  const confirmDelete = (item: VaultItemDetail) =>
    Alert.alert(t('vault.deleteTitle'), t('vault.deleteBody', { title: item.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(item.id) },
    ]);

  if (items.isLoading || stats.isLoading) return <Loading fullScreen />;
  if (items.isError || stats.isError)
    return <ErrorState description={t('vault.loadError')} onRetry={() => void refresh()} />;

  return (
    <PageContainer onRefresh={refresh} refreshing={refreshing} variant="tool">
      <PageHeader
        title={t('vault.title')}
        description={t('vault.description')}
        icon="lock-closed-outline"
        variant="tool"
      />
      <View style={styles.stats}>
        <Stat label={t('vault.total')} value={stats.data?.totalItems ?? 0} color={colors.primary} />
        <Stat
          label={t('vault.credentials')}
          value={stats.data?.credentialCount ?? 0}
          color={colors.warning}
        />
        <Stat
          label={t('vault.documents')}
          value={stats.data?.documentCount ?? 0}
          color={colors.info}
        />
      </View>
      <Button
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        {t('vault.add')}
      </Button>
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('vault.search')}
        style={styles.search}
      />
      <Select
        value={type}
        onChange={(value) => setType(value as 'ALL' | VaultItemType)}
        options={[
          { value: 'ALL', label: t('vault.all') },
          ...TYPE_OPTIONS.map((value) => ({ value, label: t(`vault.types.${value}`) })),
        ]}
      />
      <Select
        value={category}
        onChange={setCategory}
        options={[
          { value: 'ALL', label: t('vault.allCategories') },
          ...(stats.data?.categories ?? []).map((value) => ({ value, label: value })),
        ]}
      />

      {(items.data ?? []).length === 0 ? (
        <EmptyState
          icon="lock-closed-outline"
          title={t('vault.empty.title')}
          description={t('vault.empty.description')}
          action={{ label: t('vault.add'), onPress: () => setFormOpen(true) }}
        />
      ) : (
        items.data?.map((item) => (
          <Card key={item.id} onPress={() => reveal.mutate(item.id)} style={styles.card}>
            <CardContent style={styles.row}>
              <View style={[styles.icon, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
                <Text>🔐</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.caption, { color: colors.foregroundMuted }]}>
                  {item.category || t(`vault.types.${item.type}`)} ·{' '}
                  {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ color: colors.primary }}>
                {reveal.isPending && reveal.variables === item.id ? '…' : '›'}
              </Text>
            </CardContent>
          </Card>
        ))
      )}

      {formOpen && (
        <VaultForm
          visible
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      <Modal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        footer={
          detail ? (
            <View style={styles.footer}>
              <Button
                variant="outline"
                onPress={() => {
                  setEditing(detail);
                  setDetail(null);
                  setFormOpen(true);
                }}
              >
                {t('common.edit')}
              </Button>
              <Button variant="destructive" onPress={() => confirmDelete(detail)}>
                {t('common.delete')}
              </Button>
            </View>
          ) : undefined
        }
      >
        <Text
          selectable
          style={[styles.secret, { color: colors.foreground, backgroundColor: colors.muted }]}
        >
          {detail?.data}
        </Text>
      </Modal>
    </PageContainer>
  );
}

function VaultForm({
  visible,
  editing,
  onClose,
}: {
  visible: boolean;
  editing: VaultItemDetail | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<VaultItemType>(VaultItemType.CREDENTIAL);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState('');

  useEffect(() => {
    if (!visible) return;
    setType(editing?.type ?? VaultItemType.CREDENTIAL);
    setTitle(editing?.title ?? '');
    setCategory(editing?.category ?? '');
    setData(editing?.data ?? '');
  }, [editing, visible]);

  const save = useMutation({
    mutationFn: () => {
      const commonPayload = {
        title: title.trim(),
        data,
        category: category.trim() || undefined,
      } satisfies UpdateVaultItemInput;
      return editing
        ? apiClient.put(vaultRoutes.byId(editing.id), commonPayload)
        : apiClient.post(vaultRoutes.list(), {
            ...commonPayload,
            type,
          } satisfies CreateVaultItemInput);
    },
    onSuccess: async () => {
      toast.success(t('vault.saved'));
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const generate = useMutation({
    mutationFn: () =>
      apiClient.get<{ password: string }>(vaultRoutes.generatePassword(), {
        params: { length: 16 },
      }),
    onSuccess: (result) => setData(result.password),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editing ? t('vault.edit') : t('vault.add')}
      footer={
        <View style={styles.footer}>
          <Button variant="outline" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!title.trim() || !data || save.isPending}
            onPress={() => save.mutate()}
          >
            {t('common.save')}
          </Button>
        </View>
      }
    >
      <View style={styles.form}>
        <Select
          label={t('vault.type')}
          value={type}
          onChange={(value) => setType(value as VaultItemType)}
          disabled={!!editing}
          options={TYPE_OPTIONS.map((value) => ({ value, label: t(`vault.types.${value}`) }))}
        />
        <Input label={t('vault.itemTitle')} value={title} onChangeText={setTitle} maxLength={200} />
        <Input
          label={t('vault.category')}
          value={category}
          onChangeText={setCategory}
          maxLength={100}
        />
        <Input
          label={t('vault.content')}
          value={data}
          onChangeText={setData}
          multiline
          maxLength={50000}
          secureTextEntry={type === VaultItemType.PASSWORD || type === VaultItemType.API_KEY}
        />
        {(type === VaultItemType.PASSWORD ||
          type === VaultItemType.CREDENTIAL ||
          type === VaultItemType.API_KEY) && (
          <Button variant="outline" loading={generate.isPending} onPress={() => generate.mutate()}>
            {t('vault.generatePassword')}
          </Button>
        )}
      </View>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.stat, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  statLabel: { fontSize: fontSize.xs },
  search: { marginTop: spacing.md },
  card: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  itemTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  caption: { fontSize: fontSize.sm, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  secret: { padding: spacing.md, borderRadius: borderRadius.md, fontSize: fontSize.base },
  form: { gap: spacing.md },
});
