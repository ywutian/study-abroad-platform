'use client';

import { useTranslations } from 'next-intl';
import { Compass, Flame, Home, Newspaper, Plus, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Community } from './forum-types';

interface CommunitySidebarProps {
  communities: Community[];
  selectedCommunityId: string | null;
  activeFeed: 'popular' | 'home' | 'latest';
  onSelectFeed: (feed: 'popular' | 'home' | 'latest') => void;
  onSelectCommunity: (community: Community) => void;
  onCreateCommunity: () => void;
  onToggleFollow: (community: Community) => void;
}

export function CommunitySidebar({
  communities,
  selectedCommunityId,
  activeFeed,
  onSelectFeed,
  onSelectCommunity,
  onCreateCommunity,
  onToggleFollow,
}: CommunitySidebarProps) {
  const t = useTranslations('forum');
  const myCommunities = communities.filter((community) => community.isFollowing);
  const recommendedCommunities = communities.filter((community) => !community.isFollowing);

  const feedItems = [
    { key: 'popular' as const, icon: Flame, label: t('feedPopular') },
    { key: 'latest' as const, icon: Newspaper, label: t('feedNews') },
    { key: 'home' as const, icon: Home, label: t('feedHome') },
  ];

  return (
    <aside className="space-y-5">
      <div className="space-y-1">
        {feedItems.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${
              activeFeed === key && !selectedCommunityId
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
            onClick={() => onSelectFeed(key)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <button
          className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors hover:bg-muted"
          onClick={onCreateCommunity}
        >
          <Plus className="h-4 w-4" />
          {t('startCommunity')}
        </button>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {t('myCommunities')}
        </div>
        <div className="space-y-1">
          {(myCommunities.length ? myCommunities : communities.slice(0, 4)).map((community) => (
            <CommunityRow
              key={community.id}
              community={community}
              selected={selectedCommunityId === community.id}
              postCountLabel={t('communityPostCount', { count: community.postCount })}
              officialLabel={t('officialCommunity')}
              followLabel={community.isFollowing ? t('unfollowCommunity') : t('followCommunity')}
              onSelect={() => onSelectCommunity(community)}
              onToggleFollow={() => onToggleFollow(community)}
            />
          ))}
          {myCommunities.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('noFollowedCommunities')}</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Compass className="h-3.5 w-3.5" />
          {t('recommendedCommunities')}
        </div>
        <div className="space-y-1">
          {recommendedCommunities.slice(0, 8).map((community) => (
            <CommunityRow
              key={community.id}
              community={community}
              selected={selectedCommunityId === community.id}
              postCountLabel={t('communityPostCount', { count: community.postCount })}
              officialLabel={t('officialCommunity')}
              followLabel={community.isFollowing ? t('unfollowCommunity') : t('followCommunity')}
              onSelect={() => onSelectCommunity(community)}
              onToggleFollow={() => onToggleFollow(community)}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function CommunityRow({
  community,
  selected,
  postCountLabel,
  officialLabel,
  followLabel,
  onSelect,
  onToggleFollow,
}: {
  community: Community;
  selected: boolean;
  postCountLabel: string;
  officialLabel: string;
  followLabel: string;
  onSelect: () => void;
  onToggleFollow: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
        selected ? 'bg-muted' : 'hover:bg-muted/70'
      }`}
    >
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onSelect}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {community.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">r/{community.name}</span>
          <span className="block text-xs text-muted-foreground">
            {postCountLabel}
            {community.isOfficial && (
              <Badge className="ml-1 h-4 px-1 text-2xs">{officialLabel}</Badge>
            )}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onToggleFollow}
        aria-label={followLabel}
      >
        <Star className={`h-4 w-4 ${community.isFollowing ? 'fill-current text-primary' : ''}`} />
      </Button>
    </div>
  );
}
