'use client';

import React from 'react';
import type { ResumeSettings } from '@study-abroad/shared';
import type { SectionConfig } from '../pdf/types';
import { resolveTemplate } from '../pdf/templates';
import { ResumeDocument } from '../pdf/layouts';

interface PreviewDocumentProps {
  sections: SectionConfig[];
  templateId: string;
  settings?: ResumeSettings;
}

/**
 * Resolves a templateId into layout + theme, then renders the PDF document.
 * This is the bridge between the editor state and the @react-pdf rendering tree.
 * User settings (Layer 3) are applied on top of template defaults.
 */
export function PreviewDocument({ sections, templateId, settings }: PreviewDocumentProps) {
  const { theme, layout } = resolveTemplate(templateId, settings);

  return <ResumeDocument layout={layout} theme={theme} sections={sections} data={{ sections }} />;
}
