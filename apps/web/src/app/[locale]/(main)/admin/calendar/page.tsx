'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout';
import { Calendar, Globe } from 'lucide-react';
import { DeadlinesTab } from './_components/deadlines-tab';
import { EventsTab } from './_components/events-tab';

const VALID_TABS = ['deadlines', 'events'] as const;
type CalendarTab = (typeof VALID_TABS)[number];

export default function AdminCalendarPage() {
  const t = useTranslations('admin');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as CalendarTab)
    ? (searchParams.get('tab') as CalendarTab)
    : 'deadlines';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'deadlines') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/calendar${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title={t('sidebar.calendar')}
        description={t('calendar.description')}
        icon={Calendar}
        color="blue"
      />

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="deadlines" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('sidebar.deadlines')}
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('sidebar.events')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deadlines">
            <DeadlinesTab />
          </TabsContent>

          <TabsContent value="events">
            <EventsTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
