'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SectionConfig } from '../pdf/types';
import { resolveTemplate } from '../pdf/templates';
import { registerFonts } from '../pdf/fonts/register';

// Dynamic import: @react-pdf/renderer is client-only and heavy
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const ResumeDocumentDynamic = dynamic(
  () => import('./preview-renderer').then((m) => ({ default: m.PreviewDocument })),
  { ssr: false }
);

interface ResumePreviewProps {
  sections: SectionConfig[];
  templateId: string;
  maxPages?: number;
}

export function ResumePreview({ sections, templateId, maxPages = 1 }: ResumePreviewProps) {
  const [zoom, setZoom] = useState(100);

  // Register fonts once
  useMemo(() => registerFonts(), []);

  const visibleSections = useMemo(() => sections.filter((s) => s.isVisible), [sections]);

  return (
    <div className="flex h-full flex-col">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <Badge variant="outline" className="text-xs">
          Preview
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          <PDFViewer
            width={612}
            height={792}
            showToolbar={false}
            className="rounded border shadow-sm"
          >
            <ResumeDocumentDynamic sections={visibleSections} templateId={templateId} />
          </PDFViewer>
        </div>
      </div>
    </div>
  );
}
