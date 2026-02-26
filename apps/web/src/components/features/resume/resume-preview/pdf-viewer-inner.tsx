'use client';

import { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Loader2 } from 'lucide-react';
import type { ResumeSettings } from '@study-abroad/shared';
import { PreviewDocument } from './preview-renderer';
import { registerFonts } from '../pdf/fonts/register';
import type { SectionConfig } from '../pdf/types';

// Register fonts immediately when this module loads (before any render)
registerFonts();

interface PDFViewerInnerProps {
  sections: SectionConfig[];
  templateId: string;
  settings?: ResumeSettings;
}

/**
 * Renders a PDF preview using pdf().toBlob() + iframe instead of PDFViewer.
 * This avoids react-pdf's reconciler bugs with dynamic children (issue #3164).
 * The iframe fills its parent container; the browser's built-in PDF viewer provides zoom/toolbar.
 */
export default function PDFViewerInner({ sections, templateId, settings }: PDFViewerInnerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const blob = await pdf(
          <PreviewDocument sections={sections} templateId={templateId} settings={settings} />
        ).toBlob();

        if (cancelled) return;

        const newUrl = URL.createObjectURL(blob);

        // Revoke previous URL to avoid memory leaks
        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = newUrl;

        setUrl(newUrl);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('PDF render failed:', err);
        setError(err instanceof Error ? err.message : 'PDF render failed');
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [sections, templateId, settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-destructive/10 text-sm text-destructive">
        PDF render error: {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <iframe src={url} className="h-full w-full border-0" title="PDF" />;
}
