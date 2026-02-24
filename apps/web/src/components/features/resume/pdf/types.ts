import type { ResumeSectionType } from '@study-abroad/shared';

// ─── Layout Types ───

export type LayoutType =
  | 'single-column'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'header-banner-single'
  | 'header-banner-columns'
  | 'equal-columns'
  | 'timeline';

// ─── Font Pairing Types ───

export type FontPairingId =
  | 'helvetica'
  | 'times'
  | 'roboto'
  | 'lato'
  | 'noto-sans-sc'
  | 'source-merriweather';

export interface FontPairing {
  id: FontPairingId;
  heading: string;
  body: string;
  label: string;
}

// ─── Theme Types ───

export type ThemeId =
  | 'navy'
  | 'charcoal'
  | 'forest'
  | 'teal'
  | 'indigo'
  | 'coral'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'black'
  | 'slate'
  | 'burgundy'
  | 'dark-green'
  | 'royal-blue';

export interface ResumeTheme {
  // Colors
  primary: string;
  secondary: string;
  background: string;
  sidebarBg: string;
  sidebarText: string;
  headerBg: string;
  headerText: string;
  text: string;
  textLight: string;
  border: string;

  // Typography
  fontFamily: {
    heading: string;
    body: string;
  };
  fontSize: {
    name: number;
    sectionTitle: number;
    body: number;
    small: number;
  };

  // Spacing (pt)
  spacing: {
    page: { x: number; y: number };
    sectionGap: number;
    itemGap: number;
    lineHeight: number;
    sidebarWidth: string;
  };

  // Decorations
  decorations: {
    sectionDivider: 'line' | 'double-line' | 'dots' | 'none';
    headingStyle: 'underline' | 'background' | 'border-left' | 'uppercase' | 'plain';
    bulletStyle: 'disc' | 'dash' | 'arrow' | 'square';
    borderRadius: number;
    showIcons: boolean;
    pageSize: 'LETTER' | 'A4';
    dateFormat: 'MMM YYYY' | 'MM/YYYY' | 'YYYY';
  };
}

// ─── Section Config ───

export interface SectionConfig {
  id: string;
  type: ResumeSectionType | string;
  title: string;
  content: Record<string, unknown>;
  isVisible: boolean;
}

// ─── Layout Props (passed to every Layout Engine) ───

export interface LayoutProps {
  data: ResumeData;
  theme: ResumeTheme;
  sections: SectionConfig[];
  sidebarSections?: SectionConfig[];
}

// ─── Resume Data (flattened for PDF rendering) ───

export interface ResumeData {
  sections: SectionConfig[];
}

// ─── Template Definition ───

export type TemplateCategory = 'professional' | 'modern' | 'creative' | 'academic' | 'minimal';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: TemplateCategory;
  recommendedFor: string[]; // ResumeType values
  layout: LayoutType;
  theme: ThemeId;
  fontPairing: FontPairingId;
  overrides?: Partial<ResumeTheme>;
}

// ─── Section Renderer Props ───

export interface SectionRendererProps {
  section: SectionConfig;
  theme: ResumeTheme;
  isLast?: boolean;
}
