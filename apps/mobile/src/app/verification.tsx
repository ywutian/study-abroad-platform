import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VerificationScreen } from '@/screens';

export default function VerificationPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('verification.title') }} />
      <VerificationScreen />
    </>
  );
}
