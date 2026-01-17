'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Search, User, GraduationCap, Award, BookOpen, Loader2, ChevronRight } from 'lucide-react';

interface PublicProfile {
  id: string;
  userId: string;
  grade?: string;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string;
  visibility: string;
  _count?: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

interface ProfileSelectorProps {
  onSelect: (profile: PublicProfile) => void;
  selectedProfileId?: string;
}

const GRADE_KEYS: Record<string, string> = {
  FRESHMAN: 'freshman',
  SOPHOMORE: 'sophomore',
  JUNIOR: 'junior',
  SENIOR: 'senior',
  GAP_YEAR: 'gapYear',
};

export function ProfileSelector({ onSelect, selectedProfileId }: ProfileSelectorProps) {
  const t = useTranslations('profile');
  const [search, setSearch] = useState('');

  // Fetch public profiles
  // apiClient 已自动解包 { success, data } -> data
  // 后端 getPublicProfiles() 返回 { data: [...profiles] }
  // 经 TransformInterceptor 包装后为 { success, data: { data: [...] } }
  // apiClient 解包后得到 { data: [...profiles] }
  const { data: profilesResponse, isLoading } = useQuery({
    queryKey: ['publicProfiles', search],
    queryFn: () =>
      apiClient.get<{ data: PublicProfile[] }>('/hall/public-profiles', {
        params: search ? { search } : undefined,
      }),
  });

  const profileList = profilesResponse?.data || [];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('selector.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Profile list */}
      <ScrollArea className="h-[350px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profileList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <User className="mb-2 h-12 w-12 opacity-50" />
            <p>{t('selector.noProfiles')}</p>
            <p className="text-sm">{t('selector.noProfilesHint')}</p>
          </div>
        ) : (
          <div className="space-y-2 pr-4">
            {profileList.map((profile) => (
              <Card
                key={profile.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedProfileId === profile.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => onSelect(profile)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Avatar placeholder */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                    <User className="h-6 w-6" />
                  </div>

                  {/* Profile info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {profile.grade && (
                        <Badge variant="secondary" className="text-xs">
                          {GRADE_KEYS[profile.grade]
                            ? t(`grades.${GRADE_KEYS[profile.grade]}`)
                            : profile.grade}
                        </Badge>
                      )}
                      {profile.targetMajor && (
                        <span className="text-sm font-medium truncate">{profile.targetMajor}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {profile.gpa && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          GPA {Number(profile.gpa).toFixed(2)}/{profile.gpaScale || 4.0}
                        </span>
                      )}
                      {profile._count?.activities && profile._count.activities > 0 && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {profile._count.activities} {t('selector.activities')}
                        </span>
                      )}
                      {profile._count?.awards && profile._count.awards > 0 && (
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {profile._count.awards} {t('selector.awards')}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
