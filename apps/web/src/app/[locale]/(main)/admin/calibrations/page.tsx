'use client';

import {
  BarChart3,
  Brain,
  Database,
  Gauge,
  GitBranch,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Workflow,
} from 'lucide-react';
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
const WorkflowTab = dynamic(
  () =>
    import('./_components/workflow-tab').then((m) => ({
      default: m.WorkflowTab,
    })),
  { ssr: false }
);
const PoliciesTab = dynamic(
  () =>
    import('./_components/policies-tab').then((m) => ({
      default: m.PoliciesTab,
    })),
  { ssr: false }
);
const OutcomesTab = dynamic(
  () =>
    import('./_components/outcomes-tab').then((m) => ({
      default: m.OutcomesTab,
    })),
  { ssr: false }
);
const RealCasesTab = dynamic(
  () =>
    import('./_components/real-cases-tab').then((m) => ({
      default: m.RealCasesTab,
    })),
  { ssr: false }
);
const BenchmarkTab = dynamic(
  () =>
    import('./_components/benchmark-tab').then((m) => ({
      default: m.BenchmarkTab,
    })),
  { ssr: false }
);
const DistillationTab = dynamic(
  () =>
    import('./_components/distillation-tab').then((m) => ({
      default: m.DistillationTab,
    })),
  { ssr: false }
);

const VALID_TABS = [
  'diagnosis',
  'school-calibrations',
  'system',
  'workflow',
  'policies',
  'outcomes',
  'real-cases',
  'benchmark',
  'distillation',
] as const;
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
  {
    value: 'workflow' as const,
    icon: Workflow,
    labelKey: 'admin.calibrations.tabs.workflow',
  },
  {
    value: 'policies' as const,
    icon: GitBranch,
    labelKey: 'admin.calibrations.tabs.policies',
  },
  {
    value: 'outcomes' as const,
    icon: ShieldCheck,
    labelKey: 'admin.calibrations.tabs.outcomes',
  },
  {
    value: 'real-cases' as const,
    icon: Upload,
    labelKey: 'admin.calibrations.tabs.realCases',
  },
  {
    value: 'benchmark' as const,
    icon: Gauge,
    labelKey: 'admin.calibrations.tabs.benchmark',
  },
  {
    value: 'distillation' as const,
    icon: Database,
    labelKey: 'admin.calibrations.tabs.distillation',
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
        <TabsContent value="workflow" className="mt-4">
          <WorkflowTab />
        </TabsContent>
        <TabsContent value="policies" className="mt-4">
          <PoliciesTab />
        </TabsContent>
        <TabsContent value="outcomes" className="mt-4">
          <OutcomesTab />
        </TabsContent>
        <TabsContent value="real-cases" className="mt-4">
          <RealCasesTab />
        </TabsContent>
        <TabsContent value="benchmark" className="mt-4">
          <BenchmarkTab />
        </TabsContent>
        <TabsContent value="distillation" className="mt-4">
          <DistillationTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
