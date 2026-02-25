'use client';

import { PDFViewer } from '@react-pdf/renderer';
import { PreviewDocument } from './preview-renderer';
import { registerFonts } from '../pdf/fonts/register';
import type { SectionConfig } from '../pdf/types';

// Register fonts immediately when this module loads (before any render)
registerFonts();

interface PDFViewerInnerProps {
  sections: SectionConfig[];
  templateId: string;
  width: number;
  height: number;
}

export default function PDFViewerInner({
  sections,
  templateId,
  width,
  height,
}: PDFViewerInnerProps) {
  return (
    <PDFViewer
      width={width}
      height={height}
      showToolbar={false}
      className="rounded border shadow-sm"
    >
      <PreviewDocument sections={sections} templateId={templateId} />
    </PDFViewer>
  );
}
