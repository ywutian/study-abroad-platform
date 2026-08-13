import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');
const webRoot = path.resolve(__dirname, '..', '..', '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

describe('prediction page scroll ownership', () => {
  it('does not trap the selector and What-if panel in an inner vertical scroller', () => {
    const stickySelector = page.match(/const STICKY_SELECTOR\s*=\s*([\s\S]*?);/)?.[1] ?? '';

    expect(stickySelector).toContain('lg:sticky');
    expect(stickySelector).not.toContain('overflow-y-auto');
    expect(stickySelector).not.toContain('max-h-');
  });

  it('keeps What-if in the same normal-flow column as the selector', () => {
    expect(page).toMatch(
      /<div className={`min-w-0 \$\{STICKY_SELECTOR\} lg:pr-1`}>[\s\S]*?<SchoolSelectorCard[\s\S]*?<PredictionWhatIfPanel/
    );
  });
});

describe('feedback acceptance contracts', () => {
  it('keeps the heavy prediction explanation behind collapsed native details', () => {
    const detailPane = read('components/features/prediction/PredictionDetailPane.tsx');
    expect(detailPane).toContain('<details className="space-y-1.5">');
    expect(detailPane).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
  });

  it('keeps dashboard priorities in the requested order and weight', () => {
    const dashboard = read('app/[locale]/(main)/dashboard/page.tsx');
    const timelineIndex = dashboard.indexOf('<DashboardEventsTimeline');
    const commandCenterIndex = dashboard.indexOf('<DashboardCommandCenter');
    const trendingIndex = dashboard.indexOf('<DashboardTrending');
    const sidebarIndex = dashboard.indexOf('<aside');
    const setupIndex = dashboard.indexOf('<DashboardSetupProgress');
    const quickAskIndex = dashboard.indexOf('<DashboardQuickAsk');

    expect(timelineIndex).toBeGreaterThan(0);
    expect(timelineIndex).toBeLessThan(commandCenterIndex);
    expect(commandCenterIndex).toBeLessThan(trendingIndex);
    expect(trendingIndex).toBeLessThan(sidebarIndex);
    expect(sidebarIndex).toBeLessThan(setupIndex);
    expect(sidebarIndex).toBeLessThan(quickAskIndex);

    const setup = read('app/[locale]/(main)/dashboard/_components/dashboard-setup-progress.tsx');
    expect(setup).toContain('<Progress value={percent} className="h-1.5" />');
  });

  it('keeps timeline purpose and generation consequence visible before action', () => {
    const en = JSON.parse(read('messages/en.json')) as {
      timeline: {
        description: string;
        schoolTimelines: { pendingSchoolsDesc: string; generateTimeline: string };
      };
    };
    const zh = JSON.parse(read('messages/zh.json')) as typeof en;

    for (const messages of [en, zh]) {
      expect(messages.timeline.description.length).toBeGreaterThan(20);
      expect(messages.timeline.schoolTimelines.pendingSchoolsDesc.length).toBeGreaterThan(20);
      expect(messages.timeline.schoolTimelines.generateTimeline.length).toBeGreaterThan(0);
    }
  });
});
