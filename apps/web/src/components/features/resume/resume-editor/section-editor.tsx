'use client';

import type { ResumeSection } from '@study-abroad/shared';
import { HeaderEditor } from './section-editors/header-editor';
import { EducationEditor } from './section-editors/education-editor';
import { ExperienceEditor } from './section-editors/experience-editor';
import { ActivitiesEditor } from './section-editors/activities-editor';
import { AwardsEditor } from './section-editors/awards-editor';
import { SkillsEditor } from './section-editors/skills-editor';
import { TestScoresEditor } from './section-editors/test-scores-editor';
import { ProjectsEditor } from './section-editors/projects-editor';
import { PublicationsEditor } from './section-editors/publications-editor';
import { CertificationsEditor } from './section-editors/certifications-editor';
import { CustomEditor } from './section-editors/custom-editor';

interface SectionEditorProps {
  section: ResumeSection;
  onChange: (content: Record<string, unknown>) => void;
}

export function SectionEditor({ section, onChange }: SectionEditorProps) {
  const content = section.content as Record<string, unknown>;

  switch (section.type) {
    case 'HEADER':
      return <HeaderEditor content={content} onChange={onChange} />;
    case 'EDUCATION':
      return <EducationEditor content={content} onChange={onChange} />;
    case 'TEST_SCORES':
      return <TestScoresEditor content={content} onChange={onChange} />;
    case 'RESEARCH':
    case 'WORK_EXPERIENCE':
    case 'TEACHING':
      return <ExperienceEditor content={content} onChange={onChange} type={section.type} />;
    case 'PROJECTS':
      return <ProjectsEditor content={content} onChange={onChange} />;
    case 'ACTIVITIES':
    case 'COMMUNITY_SERVICE':
      return <ActivitiesEditor content={content} onChange={onChange} />;
    case 'AWARDS':
      return <AwardsEditor content={content} onChange={onChange} />;
    case 'SKILLS':
      return <SkillsEditor content={content} onChange={onChange} />;
    case 'PUBLICATIONS':
      return <PublicationsEditor content={content} onChange={onChange} />;
    case 'CERTIFICATIONS':
      return <CertificationsEditor content={content} onChange={onChange} />;
    case 'CUSTOM':
    default:
      return <CustomEditor content={content} onChange={onChange} />;
  }
}
