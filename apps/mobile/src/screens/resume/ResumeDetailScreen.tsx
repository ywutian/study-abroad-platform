import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResumeStatus, resumeRoutes, type Resume, type ResumeSection } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Card,
  CardContent,
  ErrorState,
  Input,
  Loading,
  Select,
  Switch,
  useToast,
} from '@/components/ui';
import { fontSize, fontWeight, spacing, useColors } from '@/utils/theme';
import { summarizeResumeSection } from './resume-preview';

export default function ResumeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ResumeStatus>(ResumeStatus.DRAFT);
  const [refreshing, setRefreshing] = useState(false);
  const resume = useQuery<Resume>({
    queryKey: ['resume', id],
    queryFn: () => apiClient.get(resumeRoutes.byId(id!)),
    enabled: !!id,
  });
  useEffect(() => {
    if (resume.data) {
      setTitle(resume.data.title);
      setStatus(resume.data.status);
    }
  }, [resume.data]);
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['resume', id] }),
      queryClient.invalidateQueries({ queryKey: ['resumes'] }),
    ]);
  };
  const update = useMutation({
    mutationFn: () =>
      apiClient.put<Resume>(resumeRoutes.byId(id!), { title: title.trim(), status }),
    onSuccess: async () => {
      toast.success(t('resume.saved'));
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const sectionUpdate = useMutation({
    mutationFn: ({ sectionId, isVisible }: { sectionId: string; isVisible: boolean }) =>
      apiClient.put(resumeRoutes.section(id!, sectionId), { isVisible }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const reorder = useMutation({
    mutationFn: (sectionIds: string[]) =>
      apiClient.put(resumeRoutes.reorderSections(id!), { sectionIds }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const importProfile = useMutation({
    mutationFn: () => apiClient.post(resumeRoutes.importProfile(id!)),
    onSuccess: async () => {
      toast.success(t('resume.imported'));
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const ordered = [...(resume.data?.sections ?? [])].sort((a, b) => a.order - b.order);
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((section) => section.id));
  };
  const refresh = async () => {
    setRefreshing(true);
    await resume.refetch();
    setRefreshing(false);
  };
  if (resume.isLoading) return <Loading fullScreen />;
  if (resume.isError || !resume.data)
    return <ErrorState description={t('resume.loadError')} onRetry={() => void refresh()} />;
  return (
    <PageContainer onRefresh={refresh} refreshing={refreshing} variant="tool">
      <PageHeader
        title={resume.data.title}
        description={t('resume.managerDescription')}
        icon="document-text-outline"
        variant="tool"
      />
      <Card>
        <CardContent style={styles.form}>
          <Input label={t('resume.name')} value={title} onChangeText={setTitle} maxLength={100} />
          <Select
            label={t('resume.status')}
            value={status}
            onChange={(value) => setStatus(value as ResumeStatus)}
            options={Object.values(ResumeStatus).map((value) => ({ value, label: value }))}
          />
          <Button
            loading={update.isPending}
            disabled={!title.trim() || update.isPending}
            onPress={() => update.mutate()}
          >
            {t('common.save')}
          </Button>
          <Button
            variant="outline"
            loading={importProfile.isPending}
            onPress={() =>
              Alert.alert(t('resume.importProfile'), t('resume.importConfirm'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.confirm'), onPress: () => importProfile.mutate() },
              ])
            }
          >
            {t('resume.importProfile')}
          </Button>
        </CardContent>
      </Card>
      <Text style={[styles.heading, { color: colors.foreground }]}>{t('resume.sections')}</Text>
      {ordered.map((section, index) => (
        <SectionRow
          key={section.id}
          section={section}
          colors={colors}
          onToggle={() =>
            sectionUpdate.mutate({ sectionId: section.id, isVisible: !section.isVisible })
          }
          onUp={() => move(index, -1)}
          onDown={() => move(index, 1)}
          disabled={reorder.isPending || sectionUpdate.isPending}
          emptyLabel={t('resume.emptySection')}
        />
      ))}
      <Text style={[styles.note, { color: colors.foregroundMuted }]}>
        {t('resume.webEditorNote')}
      </Text>
      <Button variant="ghost" onPress={() => router.back()}>
        {t('common.back')}
      </Button>
    </PageContainer>
  );
}

function SectionRow({
  section,
  colors,
  onToggle,
  onUp,
  onDown,
  disabled,
  emptyLabel,
}: {
  section: ResumeSection;
  colors: ReturnType<typeof useColors>;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  disabled: boolean;
  emptyLabel: string;
}) {
  const preview = summarizeResumeSection(section.content);
  return (
    <Card style={styles.section}>
      <CardContent style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {section.title || section.type}
          </Text>
          <Text style={[styles.note, { color: colors.foregroundMuted }]}>{section.type}</Text>
          <View style={styles.preview}>
            {preview.length ? (
              preview.map((line) => (
                <Text
                  key={line}
                  numberOfLines={2}
                  style={[styles.previewLine, { color: colors.foregroundMuted }]}
                >
                  {line}
                </Text>
              ))
            ) : (
              <Text style={[styles.previewLine, { color: colors.foregroundMuted }]}>
                {emptyLabel}
              </Text>
            )}
          </View>
        </View>
        <Button size="sm" variant="ghost" disabled={disabled} onPress={onUp}>
          ↑
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled} onPress={onDown}>
          ↓
        </Button>
        <Switch
          value={section.isVisible}
          onValueChange={onToggle}
          disabled={disabled}
          accessibilityLabel={section.title}
        />
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  section: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  note: { fontSize: fontSize.sm, marginTop: spacing.sm },
  preview: { gap: spacing.xs, marginTop: spacing.sm },
  previewLine: { fontSize: fontSize.sm },
});
