import React from 'react';
import type { SectionConfig, ResumeTheme } from '../types';
import { HeaderSection } from './header-section';
import { EducationSection } from './education-section';
import { ExperienceSection } from './experience-section';
import { ProjectsSection } from './projects-section';
import { ActivitiesSection } from './activities-section';
import { AwardsSection } from './awards-section';
import { SkillsSection } from './skills-section';
import { TestScoresSection } from './test-scores-section';
import { PublicationsSection } from './publications-section';
import { CertificationsSection } from './certifications-section';
import { CustomSection } from './custom-section';

interface RenderSectionProps {
  section: SectionConfig;
  theme: ResumeTheme;
  isLast?: boolean;
}

/**
 * Dispatches to the correct section renderer based on section.type.
 * Used by all Layout Engines to render their section lists.
 */
export function RenderSection({ section, theme, isLast }: RenderSectionProps) {
  if (!section.isVisible) return null;

  const props = { section, theme, isLast };

  switch (section.type) {
    case 'HEADER':
      return <HeaderSection {...props} />;
    case 'EDUCATION':
      return <EducationSection {...props} />;
    case 'RESEARCH':
    case 'WORK_EXPERIENCE':
    case 'TEACHING':
      return <ExperienceSection {...props} />;
    case 'PROJECTS':
      return <ProjectsSection {...props} />;
    case 'ACTIVITIES':
    case 'COMMUNITY_SERVICE':
      return <ActivitiesSection {...props} />;
    case 'AWARDS':
      return <AwardsSection {...props} />;
    case 'SKILLS':
      return <SkillsSection {...props} />;
    case 'TEST_SCORES':
      return <TestScoresSection {...props} />;
    case 'PUBLICATIONS':
      return <PublicationsSection {...props} />;
    case 'CERTIFICATIONS':
      return <CertificationsSection {...props} />;
    case 'CUSTOM':
    default:
      return <CustomSection {...props} />;
  }
}

export { HeaderSection, HeaderSectionSidebar, HeaderSectionBanner } from './header-section';
