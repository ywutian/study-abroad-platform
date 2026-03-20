import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReferralScreen } from '@/screens';

export default function ReferralPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('referral.title') }} />
      <ReferralScreen />
    </>
  );
}
