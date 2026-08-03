'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
// Reuse the gallery's essay-type labels so the proper nouns (Common App,
// UC PIQ, etc.) stay in i18n and the i18n linter doesn't flag them.
import { getEssayTypeLabel as getEssayTypeLabelUtil } from '@/lib/utils/admission';
import { useQuery } from '@tanstack/react-query';
import { Search, FileDown, Bookmark, AlertCircle, X } from 'lucide-react';

import { useAuthStore } from '@/stores/auth';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api/client';
import { counselorRoutes } from '@study-abroad/shared';
import { PageContainer, PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Briefcase } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PatternRow {
  id: string;
  school: { id: string; name: string; nameZh?: string };
  year: number;
  result: string;
  essayType?: string;
  promptNumber?: number;
  promptExcerpt: string | null;
  hookExcerpt: string | null;
  isVerified: boolean;
  sourceArchive?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
}

interface PatternsResponse {
  items: PatternRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  archives: string[];
}

/**
 * Counselor pattern-search workbench (B2B 暗线 · PR 2 · §D).
 *
 * Hard gates:
 *   - Role gate: COUNSELOR / ADMIN / SUPER_ADMIN. Non-counselors see a 403
 *     stub before any data fetch lands. The page itself is the second line
 *     of defence — the BACKEND endpoint is the first (gated via @Roles).
 *   - SEO gate: `robots: noindex, nofollow` via the route's metadata block.
 *     This surface should not show up in any web search. The cross-link
 *     from the public site is also conditional on role in the header nav.
 *
 * Phase-2 placeholders intentionally left as UI-only:
 *   - "Saved queries" — Bookmark icon, no backend persistence yet.
 *   - "Export lesson plan PDF" — Download icon, toasts a stub message.
 */
export default function CounselorPatternsPage() {
  const t = useTranslations('counselor.patterns');
  const tGallery = useTranslations('essayGallery');
  const getTypeLabel = (type: string) =>
    getEssayTypeLabelUtil(type, (key: string) => tGallery(key));
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  const [school, setSchool] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [essayType, setEssayType] = useState<string>('ALL');
  const [archive, setArchive] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const isAllowed =
    !!user && (user.role === 'COUNSELOR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

  // Soft client redirect: the page mounts → role unknown → settles → if
  // wrong, send to /. The backend is the hard gate; this just avoids a
  // brief flash of an unusable surface for non-counselors who reached
  // here via a stale link.
  useEffect(() => {
    if (accessToken && user && !isAllowed) {
      router.replace('/');
    }
  }, [accessToken, user, isAllowed, router]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      page: String(page),
      pageSize: '50',
    };
    if (school) params.school = school;
    if (resultFilter !== 'ALL') params.result = resultFilter;
    if (essayType !== 'ALL') params.essayType = essayType;
    if (archive !== 'ALL') params.archive = archive;
    return params;
  }, [school, resultFilter, essayType, archive, page]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['counselor-patterns', queryParams],
    queryFn: () =>
      apiClient.get<PatternsResponse>(counselorRoutes.essayPatterns(), {
        params: queryParams,
      }),
    enabled: isAllowed,
  });

  // ── 403 stub for unauth / wrong-role visitors ────────────────────────
  if (!accessToken || (user && !isAllowed)) {
    return (
      <PageContainer maxWidth="medium">
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t('forbidden.title')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('forbidden.body')}</p>
            <Button onClick={() => router.push('/')}>{t('forbidden.cta')}</Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const items = data?.items ?? [];

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Briefcase}
        color="indigo"
        actions={
          <div className="flex items-center gap-2">
            {/* Phase-2 placeholders — explicit UI, no backend wiring yet. */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled>
                    <Bookmark className="h-3.5 w-3.5" />
                    {t('savedQueries')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('phase2Hint')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.info(t('exportPdfStub'))}
            >
              <FileDown className="h-3.5 w-3.5" />
              {t('exportLessonPlan')}
            </Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('filters.schoolPlaceholder')}
            value={school}
            onChange={(e) => {
              setSchool(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Select
          value={resultFilter}
          onValueChange={(v) => {
            setResultFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder={t('filters.result')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('filters.allResults')}</SelectItem>
            <SelectItem value="ADMITTED">{t('filters.admitted')}</SelectItem>
            <SelectItem value="REJECTED">{t('filters.rejected')}</SelectItem>
            <SelectItem value="WAITLISTED">{t('filters.waitlisted')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={essayType}
          onValueChange={(v) => {
            setEssayType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder={t('filters.essayType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('filters.allTypes')}</SelectItem>
            <SelectItem value="COMMON_APP">{getTypeLabel('COMMON_APP')}</SelectItem>
            <SelectItem value="UC">{getTypeLabel('UC')}</SelectItem>
            <SelectItem value="SUPPLEMENTAL">{getTypeLabel('SUPPLEMENTAL')}</SelectItem>
            <SelectItem value="WHY_SCHOOL">{getTypeLabel('WHY_SCHOOL')}</SelectItem>
            <SelectItem value="OTHER">{getTypeLabel('OTHER')}</SelectItem>
          </SelectContent>
        </Select>

        {data?.archives && data.archives.length > 0 && (
          <Select
            value={archive}
            onValueChange={(v) => {
              setArchive(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder={t('filters.archive')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('filters.allArchives')}</SelectItem>
              {data.archives.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(school || resultFilter !== 'ALL' || essayType !== 'ALL' || archive !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSchool('');
              setResultFilter('ALL');
              setEssayType('ALL');
              setArchive('ALL');
              setPage(1);
            }}
            className="text-xs h-9 px-2"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground mb-3">
        {isLoading ? t('loading') : t('resultsCount', { count: data?.total ?? 0 })}
      </p>

      {/* Dense table */}
      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-8 text-center text-sm text-destructive">{t('loadError')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">{t('columns.school')}</th>
                    <th className="px-4 py-2.5">{t('columns.year')}</th>
                    <th className="px-4 py-2.5">{t('columns.result')}</th>
                    <th className="px-4 py-2.5">{t('columns.essayType')}</th>
                    <th className="px-4 py-2.5">{t('columns.prompt')}</th>
                    <th className="px-4 py-2.5">{t('columns.hook')}</th>
                    <th className="px-4 py-2.5">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        {t('empty')}
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          {row.school?.nameZh || row.school?.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.year}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-2xs">
                            {row.result}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.essayType || '-'}
                          {row.promptNumber ? ` #${row.promptNumber}` : ''}
                        </td>
                        <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">
                          {row.promptExcerpt || '-'}
                        </td>
                        <td className="px-4 py-3 max-w-[320px] truncate text-foreground/70 italic">
                          {row.hookExcerpt || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => router.push(`/cases/essays/${row.id}`)}
                          >
                            {t('viewDetail')}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {t('prev')}
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
