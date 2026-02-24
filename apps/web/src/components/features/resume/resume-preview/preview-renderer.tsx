'use client';

import React from 'react';
import type { SectionConfig } from '../pdf/types';
import { resolveTemplate } from '../pdf/templates';
import { ResumeDocument } from '../pdf/layouts';

interface PreviewDocumentProps {
  sections: SectionConfig[];
  templateId: string;
}

/**
 * Resolves a templateId into layout + theme, then renders the PDF document.
 * This is the bridge between the editor state and the @react-pdf rendering tree.
 */
export function PreviewDocument({ sections, templateId }: PreviewDocumentProps) {
  const { theme, layout } = resolveTemplate(templateId);

  return <ResumeDocument layout={layout} theme={theme} sections={sections} data={{ sections }} />;
}
