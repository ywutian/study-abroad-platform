import { getSchool } from './_components/get-school';
import { SchoolDetailClient } from './_components/school-detail-client';

/**
 * Server shell. The interactive body lives in _components/school-detail-client.
 *
 * It used to be `'use client'` and fetched the school in a useQuery, so the
 * server-rendered HTML was the empty app shell — no <h1>, ~48 characters of
 * nav, nothing for a crawler to index across all ~243 detail pages. Prefetching
 * here means the client component has its data on the first render pass and its
 * output lands in the initial HTML.
 *
 * Not converted to server components wholesale on purpose: tabs, bookmarking,
 * the prediction call and the AI chat entry are all genuinely interactive, and
 * rewriting them would be a large change for no additional crawler benefit.
 */
export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // null on a failed prefetch — the client component falls back to fetching.
  const school = await getSchool(id);

  return <SchoolDetailClient initialSchool={school} />;
}
