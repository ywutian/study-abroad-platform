import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TeamsScreen } from '@/screens';

export default function TeamsPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('teams.title') }} />
      <TeamsScreen />
    </>
  );
}
