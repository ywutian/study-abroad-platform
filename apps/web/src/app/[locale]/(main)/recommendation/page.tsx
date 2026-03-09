'use client';

import { useEffect } from 'react';
import { useRouter } from '@/lib/i18n/navigation';

/**
 * Smart recommendation has been merged into Schools (学校库).
 * Redirect to schools with AI Recommendation tab.
 */
export default function RecommendationPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/schools?tab=recommend');
  }, [router]);
  return null;
}
