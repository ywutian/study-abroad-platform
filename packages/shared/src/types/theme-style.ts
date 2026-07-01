import type {
  ColorPalette,
  HeroVisualId,
  ThemeAppearanceOverrides,
  ThemeMode,
  ThemeStyleMeta,
} from '../design';

export type ThemeStyleStatus = 'draft' | 'approved' | 'active' | 'archived' | 'verified';
export type ThemeStyleValidationStatus = 'unknown' | 'passed' | 'warning' | 'failed';
export type ThemeCertificationStatus = 'passed' | 'warning' | 'failed';

export interface ThemeStyleActor {
  userId: string;
  email: string;
}

export interface ThemeStyleSavedByEntry extends ThemeStyleActor {
  savedAt: string;
}

export interface ThemeStyleValidationIssue {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface EnterpriseThemeIssue {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  scope: 'token' | 'contrast' | 'layout' | 'route' | 'metadata' | 'component';
  palette?: ColorPalette;
  heroVisual?: HeroVisualId;
  mode?: ThemeMode;
  route?: string;
}

export interface ThemeRouteAuditResult {
  route: string;
  role: 'guest' | 'user' | 'admin';
  status: 'covered' | 'not-run' | 'passed' | 'warning' | 'failed';
  viewportCoverage: Array<'desktop' | 'mobile' | 'wide'>;
  issueCount: number;
  issues: EnterpriseThemeIssue[];
}

export interface ThemeModeCertificationResult {
  mode: ThemeMode;
  tokenCompleteness: number;
  minimumContrastRatio: number;
  requiredContrastPairs: Record<string, number>;
  issues: EnterpriseThemeIssue[];
}

export interface ThemeButtonSurfaceAudit {
  variant:
    'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'warning' | 'success';
  mode: ThemeMode;
  foreground: string;
  background: string;
  adjacentSurface: string;
  textContrast: number;
  surfaceContrast: number;
  status: ThemeCertificationStatus;
}

export interface ThemeComponentStateAudit {
  component: 'button' | 'card' | 'input' | 'select' | 'tabs' | 'dialog' | 'toast' | 'dropdown';
  requiredStates: string[];
  supportedStates: string[];
  missingStates: string[];
  status: ThemeCertificationStatus;
}

export interface ThemeContrastSummary {
  minimumTextContrast: number;
  minimumSurfaceContrast: number;
  buttonVariantCount: number;
  riskCount: number;
}

export interface ThemeCertificationResult {
  palette: ColorPalette;
  heroVisual: HeroVisualId;
  appearanceOverrides: ThemeAppearanceOverrides;
  status: ThemeCertificationStatus;
  score: number;
  tokenCompleteness: number;
  contrastScore: number;
  darkLightParity: number;
  routeCoverage: number;
  modes: Record<ThemeMode, ThemeModeCertificationResult>;
  buttonSurfaceAudit: ThemeButtonSurfaceAudit[];
  componentStateAudit: ThemeComponentStateAudit[];
  contrastSummary: ThemeContrastSummary;
  routeAuditSummary: ThemeRouteAuditResult[];
  issues: EnterpriseThemeIssue[];
  certifiedAt: string;
}

export interface ThemeMatrixEntry {
  id: string;
  palette: ColorPalette;
  paletteLabelZh: string;
  paletteLabelEn: string;
  heroVisual: HeroVisualId;
  heroVisualLabelZh: string;
  heroVisualLabelEn: string;
  isDefault: boolean;
  isBrandVisual: boolean;
  certification: ThemeCertificationResult;
}

export interface ThemeCertificationResponse {
  generatedAt: string;
  defaultPalette: ColorPalette;
  defaultHeroVisual: HeroVisualId;
  total: number;
  passed: number;
  warning: number;
  failed: number;
  matrix: ThemeMatrixEntry[];
  diagnostics: {
    requiredRouteCount: number;
    requiredTokenCount: number;
    buttonVariantCount: number;
    issueCount: number;
  };
}

export interface ThemeStyleLibraryItem {
  id: string;
  signature: string;
  palette: ColorPalette;
  paletteLabelZh: string;
  paletteLabelEn: string;
  paletteDescriptionZh: string;
  paletteDescriptionEn: string;
  heroVisual: HeroVisualId;
  heroVisualLabelZh: string;
  heroVisualLabelEn: string;
  heroVisualDescriptionZh: string;
  heroVisualDescriptionEn: string;
  appearanceOverrides: ThemeAppearanceOverrides;
  styleMeta: ThemeStyleMeta;
  status: ThemeStyleStatus;
  validationStatus: ThemeStyleValidationStatus;
  validationErrors: ThemeStyleValidationIssue[];
  certificationStatus: ThemeCertificationStatus;
  certificationResult?: ThemeCertificationResult;
  routeAuditSummary: ThemeRouteAuditResult[];
  verifiedAt?: string;
  notes?: string;
  debugTags: string[];
  sourcePath?: string;
  sourceCommit?: string;
  voteCount: number;
  savedBy: ThemeStyleSavedByEntry[];
  createdBy: ThemeStyleActor;
  updatedBy: ThemeStyleActor;
  lastAction: 'saved' | 'updated' | 'verified' | 'archived' | 'rollback';
  revisionCreated: number;
  revisionUpdated: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeStyleTombstone {
  id: string;
  deletedAt: string;
  deletedBy: string;
  reason?: string;
}

export interface ThemeStyleDiagnostics {
  parseStatus: 'ok' | 'migrated' | 'recovered' | 'corrupt';
  checksumStatus: 'ok' | 'missing' | 'mismatch';
  itemCount: number;
  discardedItemCount: number;
  duplicateSignatureCount: number;
  unknownPaletteCount: number;
  unknownHeroVisualCount: number;
  issues: ThemeStyleValidationIssue[];
}

export interface ThemeStyleLibraryResponse {
  schemaVersion: 2;
  revision: number;
  checksum: string;
  updatedAt: string | null;
  updatedBy: ThemeStyleActor | null;
  items: ThemeStyleLibraryItem[];
  total: number;
  diagnostics: ThemeStyleDiagnostics;
}

export interface ThemeStyleSaveInput {
  palette?: string;
  heroVisual?: string;
  appearanceOverrides?: unknown;
  sourcePath?: string;
  expectedRevision?: number;
  clientRequestId?: string;
}

export interface ThemeStyleValidateInput {
  palette?: string;
  heroVisual?: string;
  appearanceOverrides?: unknown;
}

export interface ThemeStyleValidateResponse {
  valid: boolean;
  palette?: ColorPalette;
  heroVisual?: HeroVisualId;
  appearanceOverrides: ThemeAppearanceOverrides;
  styleMeta?: ThemeStyleMeta;
  issues: ThemeStyleValidationIssue[];
}

export interface ThemeStyleCertifyInput {
  palette?: string;
  heroVisual?: string;
  appearanceOverrides?: unknown;
  routeAuditSummary?: unknown;
}

export interface ThemeStylePatchInput {
  expectedRevision?: number;
  status?: ThemeStyleStatus;
  validationStatus?: ThemeStyleValidationStatus;
  validationErrors?: ThemeStyleValidationIssue[];
  certificationStatus?: ThemeCertificationStatus;
  routeAuditSummary?: ThemeRouteAuditResult[];
  notes?: string;
  debugTags?: string[];
  clientRequestId?: string;
}

export interface ThemeStyleRollbackInput {
  expectedRevision?: number;
  targetRevision?: number;
  targetAuditLogId?: string;
  reason?: string;
  dryRun?: boolean;
  clientRequestId?: string;
}
