import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ResumeDetailScreen } from '@/screens';

export default function ResumeDetailPage() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('resume.title') }} />
      <ResumeDetailScreen />
    </>
  );
}
