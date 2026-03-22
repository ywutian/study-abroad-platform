'use client';

import { BarChart3, Brain, SlidersHorizontal } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from '@/lib/i18n/navigation';

const OverviewTab = dynamic(
  () =>
    import('./_components/overview-tab').then((m) => ({
      default: m.OverviewTab,
    })),
  { ssr: false }
);
const SchoolCalibrationsTab = dynamic(
  () =>
    import('./_components/school-calibrations-tab').then((m) => ({
      default: m.SchoolCalibrationsTab,
    })),
  { ssr: false }
);
const SystemCalibrationTab = dynamic(
  () =>
    import('./_components/system-calibration-tab').then((m) => ({
      default: m.SystemCalibrationTab,
    })),
  { ssr: false }
);

const VALID_TABS = ['diagnosis', 'school-calibrations', 'system'] as const;
type CalibrationTab = (typeof VALID_TABS)[number];

const TAB_CONFIG = [
  {
    value: 'diagnosis' as const,
    icon: BarChart3,
    labelKey: 'admin.calibrations.tabs.diagnosis',
  },
  {
    value: 'school-calibrations' as const,
    icon: SlidersHorizontal,
    labelKey: 'admin.calibrations.tabs.schoolCalibrations',
  },
  {
    value: 'system' as const,
    icon: Brain,
    labelKey: 'admin.calibrations.tabs.systemCalibration',
  },
];

export default function AdminCalibrationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as CalibrationTab)
    ? (searchParams.get('tab') as CalibrationTab)
    : 'diagnosis';
  const [activeTab, setActiveTab] = useState<CalibrationTab>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as CalibrationTab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'diagnosis') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/calibrations${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  };

  return (
    <>
      <PageHeader
        title={t('admin.calibrations.title')}
        description={t('admin.calibrations.description')}
        icon={SlidersHorizontal}
        color="violet"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          {TAB_CONFIG.map(({ value, icon: Icon, labelKey }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="diagnosis" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="school-calibrations" className="mt-4">
          <SchoolCalibrationsTab />
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <SystemCalibrationTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
