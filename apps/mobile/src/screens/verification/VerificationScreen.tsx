import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  caseRoutes,
  verificationRoutes,
  VERIFICATION_PROOF_TYPE,
  type VerificationAccountStatus,
  type VerificationProofType,
  type VerificationRequest,
  type VerificationSubmission,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query/query-keys';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Loading,
  Select,
  useToast,
} from '@/components/ui';
import { borderRadius, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';
import { validateVerificationFile } from './verification-file';

interface MyCase {
  id: string;
  year?: number;
  school?: { name?: string; nameZh?: string };
  schoolName?: string;
}

interface SelectedProofFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export default function VerificationScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [caseId, setCaseId] = useState('');
  const [proofType, setProofType] = useState<VerificationProofType>(
    VERIFICATION_PROOF_TYPE.OFFER_LETTER
  );
  const [file, setFile] = useState<SelectedProofFile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const status = useQuery<VerificationAccountStatus>({
    queryKey: ['verification', 'status'],
    queryFn: () => apiClient.get(verificationRoutes.status()),
  });
  const requests = useQuery<VerificationRequest[]>({
    queryKey: ['verification', 'my'],
    queryFn: () => apiClient.get(verificationRoutes.my()),
  });
  const cases = useQuery<MyCase[]>({
    queryKey: qk.cases.mine(),
    queryFn: () => apiClient.get(caseRoutes.mine()),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!caseId || !file) throw new Error(t('verification.missingFields'));
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const payload: VerificationSubmission = {
        caseId,
        proofType,
        proofData: `data:${file.mimeType};base64,${base64}`,
      };
      return apiClient.post<VerificationRequest>(verificationRoutes.submit(), payload);
    },
    onSuccess: async () => {
      toast.success(t('verification.submitSuccess'));
      setFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['verification'] }),
        queryClient.invalidateQueries({ queryKey: qk.cases.mine() }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    let size = asset.size;
    if (size == null) {
      const info = await FileSystem.getInfoAsync(asset.uri);
      size = info.exists ? info.size : undefined;
    }
    const validation = validateVerificationFile({
      name: asset.name,
      mimeType: asset.mimeType,
      size,
    });
    if ('error' in validation && validation.error === 'too_large') {
      toast.error(t('verification.fileTooLarge'));
      return;
    }
    if ('error' in validation) {
      toast.error(t('verification.invalidFile'));
      return;
    }
    setFile({
      uri: asset.uri,
      name: asset.name,
      size: size!,
      mimeType: validation.mimeType,
    });
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([status.refetch(), requests.refetch(), cases.refetch()]);
    setRefreshing(false);
  };

  if (status.isLoading || requests.isLoading || cases.isLoading) return <Loading fullScreen />;
  if (status.isError || requests.isError || cases.isError) {
    return <ErrorState description={t('verification.loadError')} onRetry={() => void refresh()} />;
  }

  return (
    <PageContainer onRefresh={refresh} refreshing={refreshing} variant="tool">
      <PageHeader
        title={t('verification.title')}
        description={t('verification.description')}
        icon="shield-checkmark-outline"
        color={colors.success}
        variant="tool"
      />

      <View style={[styles.status, { backgroundColor: withOpacity(colors.success, 0.12) }]}>
        <Text style={[styles.statusTitle, { color: colors.foreground }]}>
          {t('verification.currentStatus')}
        </Text>
        <Text style={[styles.statusValue, { color: colors.success }]}>
          {status.data?.identityVerified
            ? t('verification.approved')
            : (status.data?.status ?? t('verification.notVerified'))}
        </Text>
      </View>

      <Card>
        <CardContent style={styles.form}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {t('verification.submitTitle')}
          </Text>
          <Select
            label={t('verification.case')}
            placeholder={t('verification.selectCase')}
            value={caseId}
            onChange={setCaseId}
            options={(cases.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.school?.nameZh || item.school?.name || item.schoolName || item.id}${item.year ? ` · ${item.year}` : ''}`,
            }))}
          />
          <Select
            label={t('verification.proofType')}
            value={proofType}
            onChange={(value) => setProofType(value as VerificationProofType)}
            options={[
              { value: VERIFICATION_PROOF_TYPE.OFFER_LETTER, label: t('verification.offerLetter') },
              {
                value: VERIFICATION_PROOF_TYPE.ENROLLMENT_PROOF,
                label: t('verification.enrollmentProof'),
              },
              { value: VERIFICATION_PROOF_TYPE.STUDENT_ID, label: t('verification.studentId') },
            ]}
          />
          <Button variant="outline" onPress={() => void pickFile()}>
            {file?.name ?? t('verification.chooseFile')}
          </Button>
          <Text style={[styles.hint, { color: colors.foregroundMuted }]}>
            {t('verification.fileHint')}
          </Text>
          <Button
            disabled={!caseId || !file || submit.isPending}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          >
            {t('verification.submit')}
          </Button>
          {(cases.data ?? []).length === 0 && (
            <Text style={[styles.hint, { color: colors.warning }]}>
              {t('verification.noCases')}
            </Text>
          )}
        </CardContent>
      </Card>

      <Text style={[styles.heading, { color: colors.foreground }]}>
        {t('verification.history')}
      </Text>
      {(requests.data ?? []).length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t('verification.empty.title')}
          description={t('verification.empty.description')}
        />
      ) : (
        requests.data?.map((item) => (
          <Card key={item.id} style={styles.requestCard}>
            <CardContent style={styles.requestRow}>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                  {item.case?.school?.nameZh || item.case?.school?.name || item.proofType}
                </Text>
                <Text style={[styles.hint, { color: colors.foregroundMuted }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                {!!item.reviewNote && (
                  <Text style={[styles.hint, { color: colors.error }]}>{item.reviewNote}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.badge,
                  {
                    color:
                      item.status === 'APPROVED'
                        ? colors.success
                        : item.status === 'REJECTED'
                          ? colors.error
                          : colors.warning,
                  },
                ]}
              >
                {item.status}
              </Text>
            </CardContent>
          </Card>
        ))
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  status: { borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  statusTitle: { fontSize: fontSize.sm },
  statusValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.xs },
  form: { gap: spacing.md },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hint: { fontSize: fontSize.sm },
  requestCard: { marginBottom: spacing.sm },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  itemTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  badge: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
