'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

import type { SchoolDetail } from './types';

interface SchoolCasesTabProps {
  school: SchoolDetail;
}

export function SchoolCasesTab({ school }: SchoolCasesTabProps) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t('school.cases.title')}
        </CardTitle>
        <CardDescription>{t('school.cases.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {school.cases && school.cases.length > 0 ? (
          <div className="space-y-4">
            {school.cases.map((case_) => (
              <div key={case_.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={case_.result === 'ADMITTED' ? 'default' : 'secondary'}>
                      {case_.result === 'ADMITTED'
                        ? t('cases.result.admitted')
                        : case_.result === 'REJECTED'
                          ? t('cases.result.rejected')
                          : case_.result === 'WAITLISTED'
                            ? t('cases.result.waitlisted')
                            : case_.result}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {case_.year} {case_.round}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {case_.gpaRange && <span>GPA: {case_.gpaRange}</span>}
                  {case_.satRange && <span>SAT: {case_.satRange}</span>}
                </div>
                {case_.tags && case_.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {case_.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('school.cases.noData')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('school.cases.beFirst')}</p>
            <Button className="mt-4" onClick={() => router.push('/cases')}>
              {t('school.cases.submitCase')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
