export interface InternationalContext {
  isInternational: boolean;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
}

const US_CODES = new Set(['US', 'USA', 'UNITED STATES']);

export function detectInternationalStatus(profile: {
  nationality?: string | null;
  countryOfResidence?: string | null;
  citizenship?: string | null;
  educationSystem?: string | null;
  currentSchoolType?: string | null;
}): InternationalContext {
  const signals: string[] = [];

  if (profile.nationality && !US_CODES.has(profile.nationality.toUpperCase())) {
    signals.push('nationality_non_us');
  }

  if (profile.countryOfResidence && !US_CODES.has(profile.countryOfResidence.toUpperCase())) {
    signals.push('residence_non_us');
  }

  if (profile.citizenship && !US_CODES.has(profile.citizenship.toUpperCase())) {
    signals.push('citizenship_non_us');
  }

  const INTL_EDUCATION_SYSTEMS = new Set(['GAOKAO', 'A_LEVEL', 'IB', 'CANADIAN', 'AUSTRALIAN']);
  if (profile.educationSystem && INTL_EDUCATION_SYSTEMS.has(profile.educationSystem)) {
    signals.push('education_system_intl');
  }

  const INTL_SCHOOL_TYPES = new Set(['INTERNATIONAL', 'INTL_CN', 'INTL_OTHER']);
  if (profile.currentSchoolType && INTL_SCHOOL_TYPES.has(profile.currentSchoolType)) {
    signals.push('school_type_intl');
  }

  if (signals.length === 0) {
    return { isInternational: false, confidence: 'low', signals: [] };
  }

  const confidence =
    signals.length >= 2 ? 'high' : signals.includes('nationality_non_us') ? 'high' : 'medium';

  return { isInternational: true, confidence, signals };
}
