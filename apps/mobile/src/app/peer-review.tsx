import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PeerReviewScreen } from '@/screens';

export default function PeerReviewPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('peerReview.title') }} />
      <PeerReviewScreen />
    </>
  );
}
