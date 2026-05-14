'use client';

import { useTranslations } from 'next-intl';
import { Info, Plus, ShieldCheck, Star, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Community } from './forum-types';

interface ForumRightRailProps {
  communities: Community[];
  selectedCommunity: Community | null;
  onCreatePost: () => void;
  onCreateCommunity: () => void;
  onSelectCommunity: (community: Community) => void;
  onToggleFollow: (community: Community) => void;
  formatNumber: (num: number) => string;
}

export function ForumRightRail({
  communities,
  selectedCommunity,
  onCreatePost,
  onCreateCommunity,
  onSelectCommunity,
  onToggleFollow,
  formatNumber,
}: ForumRightRailProps) {
  const t = useTranslations('forum');
  const popularCommunities = [...communities]
    .sort((left, right) => right.postCount - left.postCount)
    .slice(0, 5);

  const title = selectedCommunity ? `r/${selectedCommunity.name}` : t('forumAboutTitle');
  const description = selectedCommunity?.description || t('redditForumDescription');

  return (
    <aside className="space-y-4">
      <Card className="py-0">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              {selectedCommunity ? t('communityAboutTitle') : t('forumOverviewTitle')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold leading-tight">{title}</h2>
                {selectedCommunity?.isOfficial && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {t('officialCommunity')}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={selectedCommunity ? t('postsStat') : t('communitiesStat')}
              value={formatNumber(selectedCommunity?.postCount ?? communities.length)}
            />
            <Stat
              label={selectedCommunity ? t('followersStat') : t('postsStat')}
              value={formatNumber(
                selectedCommunity?.followerCount ??
                  communities.reduce((total, community) => total + community.postCount, 0)
              )}
            />
          </div>

          <div className="space-y-2">
            <Button className="w-full justify-center gap-2" onClick={onCreatePost}>
              <Plus className="h-4 w-4" />
              {t('createPost')}
            </Button>
            {selectedCommunity ? (
              <Button
                variant={selectedCommunity.isFollowing ? 'outline' : 'secondary'}
                className="w-full justify-center gap-2"
                onClick={() => onToggleFollow(selectedCommunity)}
                aria-label={
                  selectedCommunity.isFollowing ? t('unfollowCommunity') : t('followCommunity')
                }
              >
                <Star
                  className={`h-4 w-4 ${
                    selectedCommunity.isFollowing ? 'fill-current text-primary' : ''
                  }`}
                />
                {selectedCommunity.isFollowing ? t('unfollowCommunity') : t('followCommunity')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={onCreateCommunity}
              >
                <Users className="h-4 w-4" />
                {t('startCommunity')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {popularCommunities.length > 0 && (
        <Card className="py-0">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('popularCommunities')}
            </div>
            <div className="space-y-1">
              {popularCommunities.map((community, index) => (
                <button
                  key={community.id}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
                  onClick={() => onSelectCommunity(community)}
                >
                  <span className="w-4 text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {community.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">r/{community.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('communityPostCount', { count: community.postCount })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold">{t('communityRulesTitle')}</div>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            <li>{t('communityRuleRespect')}</li>
            <li>{t('communityRuleSpecific')}</li>
            <li>{t('communityRulePrivacy')}</li>
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 px-3 py-2">
      <div className="text-base font-semibold leading-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
