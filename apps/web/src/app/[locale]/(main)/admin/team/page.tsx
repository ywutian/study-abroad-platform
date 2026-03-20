'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersRound } from 'lucide-react';
import { MembersTab } from './_components/members-tab';
import { InvitesTab } from './_components/invites-tab';
import { PermissionsTab } from './_components/permissions-tab';
import { ActivityTab } from './_components/activity-tab';

export default function AdminTeamPage() {
  const t = useTranslations('admin');
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get('tab') || 'members';

  const handleTabChange = (value: string) => {
    router.replace(`/admin/team?tab=${value}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title={t('team.title')}
        description={t('team.description')}
        icon={UsersRound}
        color="violet"
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          <TabsTrigger value="members">{t('team.tabs.members')}</TabsTrigger>
          <TabsTrigger value="invites">{t('team.tabs.invites')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('team.tabs.permissions')}</TabsTrigger>
          <TabsTrigger value="activity">{t('team.tabs.activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6 space-y-6">
          <MembersTab />
        </TabsContent>
        <TabsContent value="invites" className="mt-6 space-y-6">
          <InvitesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-6 space-y-6">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-6 space-y-6">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
