'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { ResumeSettings } from '@study-abroad/shared';
import type { SectionConfig } from '../pdf/types';

// Single dynamic import — keeps PDFViewer + PreviewDocument in same chunk (no SSR).
const PDFViewerInner = dynamic(() => import('./pdf-viewer-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface ResumePreviewProps {
  sections: SectionConfig[];
  templateId: string;
  settings?: ResumeSettings;
  maxPages?: number;
}

export function ResumePreview({ sections, templateId, settings }: ResumePreviewProps) {
  const visibleSections = useMemo(() => sections.filter((s) => s.isVisible), [sections]);

  // Stabilize settings object reference to avoid unnecessary PDF re-renders
  const stableSettings = useMemo(() => settings, [JSON.stringify(settings)]);

  return (
    <div className="flex h-full flex-col">
      {/* PDF Viewer — fills entire panel, browser PDF viewer has its own zoom/toolbar */}
      <div className="flex-1">
        <PDFViewerInner
          sections={visibleSections}
          templateId={templateId}
          settings={stableSettings}
        />
      </div>
    </div>
  );
}
