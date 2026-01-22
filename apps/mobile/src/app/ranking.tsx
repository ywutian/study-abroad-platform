import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomRankingScreen } from '@/screens';

export default function RankingPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('ranking.title') }} />
      <CustomRankingScreen />
    </>
  );
}
