import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ProfileAnalysisScreen from '@/screens/profile/ProfileAnalysisScreen';

export default function ProfileAnalysisPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('applicationAnalysis.title') }} />
      <ProfileAnalysisScreen />
    </>
  );
}
