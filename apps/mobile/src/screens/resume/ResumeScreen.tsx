import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ResumeFamily,
  ResumeType,
  ResumeVariantKind,
  resumeRoutes,
  type Resume,
  type ResumeSummary,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { fontSize, fontWeight, spacing, useColors } from '@/utils/theme';

export default function ResumeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const resumes = useQuery<ResumeSummary[]>({
    queryKey: ['resumes'],
    queryFn: () => apiClient.get(resumeRoutes.list()),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => apiClient.post<Resume>(resumeRoutes.duplicate(id)),
    onSuccess: async () => {
      toast.success(t('resume.duplicated'));
      await queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(resumeRoutes.byId(id)),
    onSuccess: async () => {
      toast.success(t('resume.deleted'));
      await queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const refresh = async () => {
    setRefreshing(true);
    await resumes.refetch();
    setRefreshing(false);
  };
  const confirmDelete = (item: ResumeSummary) =>
    Alert.alert(t('resume.deleteTitle'), t('resume.deleteBody', { title: item.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(item.id) },
    ]);

  if (resumes.isLoading) return <Loading fullScreen />;
  if (resumes.isError)
    return <ErrorState description={t('resume.loadError')} onRetry={() => void refresh()} />;
  return (
    <PageContainer onRefresh={refresh} refreshing={refreshing} variant="tool">
      <PageHeader
        title={t('resume.title')}
        description={t('resume.description')}
        icon="document-text-outline"
        variant="tool"
      />
      <Button onPress={() => setCreateOpen(true)}>{t('resume.create')}</Button>
      {(resumes.data ?? []).length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t('resume.empty.title')}
          description={t('resume.empty.description')}
          action={{ label: t('resume.create'), onPress: () => setCreateOpen(true) }}
        />
      ) : (
        resumes.data?.map((item) => (
          <Card
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/resume/${item.id}` as Href)}
          >
            <CardContent>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.caption, { color: colors.foregroundMuted }]}>
                    {item.status} · {item._count.sections} {t('resume.sections')} ·{' '}
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: colors.primary }}>›</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={duplicate.isPending}
                  onPress={() => duplicate.mutate(item.id)}
                >
                  {t('resume.duplicate')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onPress={() => confirmDelete(item)}
                >
                  {t('common.delete')}
                </Button>
              </View>
            </CardContent>
          </Card>
        ))
      )}
      <CreateResumeModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}

function CreateResumeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ResumeType>(ResumeType.COLLEGE_APPLICATION);
  const [importProfile, setImportProfile] = useState(true);
  const create = useMutation({
    mutationFn: () =>
      apiClient.post<Resume>(resumeRoutes.list(), {
        title: title.trim(),
        type,
        family: ResumeFamily.STUDY_ABROAD,
        variantKind: ResumeVariantKind.MASTER,
        importFromProfile: importProfile,
      }),
    onSuccess: async (resume) => {
      toast.success(t('resume.created'));
      setTitle('');
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.push(`/resume/${resume.id}` as Href);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('resume.create')}
      footer={
        <View style={styles.actions}>
          <Button variant="outline" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!title.trim() || create.isPending}
            loading={create.isPending}
            onPress={() => create.mutate()}
          >
            {t('resume.create')}
          </Button>
        </View>
      }
    >
      <View style={styles.form}>
        <Input label={t('resume.name')} value={title} onChangeText={setTitle} maxLength={100} />
        <Select
          label={t('resume.type')}
          value={type}
          onChange={(value) => setType(value as ResumeType)}
          options={Object.values(ResumeType).map((value) => ({
            value,
            label: t(`resume.types.${value}`),
          }))}
        />
        <Checkbox
          checked={importProfile}
          onPress={() => setImportProfile((value) => !value)}
          label={t('resume.importProfile')}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  caption: { fontSize: fontSize.sm, marginTop: spacing.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  form: { gap: spacing.md },
});
