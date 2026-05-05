export type SmartSourceFamily =
  | 'OFFICIAL_SCHOOL'
  | 'GOVERNMENT'
  | 'STATE_SYSTEM'
  | 'SECONDARY_AGGREGATOR'
  | 'MANUAL_ADMIN'
  | 'HEURISTIC';

export interface SmartPlannerContext {
  schoolName: string;
  aliases: string[];
  rootDomain: string | null;
  state: string | null;
  field: string;
  lane: string;
  label: string;
  searchHints: string[];
  allowSecondary: boolean;
  secondaryDomains?: string[];
  governmentDomains?: string[];
  primarySourceFamily: SmartSourceFamily;
  acceptanceRate: number | null;
  usNewsRank: number | null;
}

export interface SmartSearchPlan {
  stage: number;
  kind: string;
  query: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  expectedSourceFamily: SmartSourceFamily;
}

const FALSE_POSITIVE_DOMAINS = [
  'reddit.com',
  'collegeconfidential.com',
  'quora.com',
  'lawschoolnumbers.com',
];

const STATE_SYSTEM_DOMAINS: Record<string, string[]> = {
  CA: ['universityofcalifornia.edu', 'calstate.edu'],
  NC: ['northcarolina.edu', 'unc.edu'],
  TX: ['utsystem.edu', 'tamu.edu'],
  FL: ['flbog.edu', 'fldoe.org'],
  GA: ['usg.edu'],
  NY: ['suny.edu'],
  WI: ['wisconsin.edu'],
};

export function buildSmartSearchPlans(
  context: SmartPlannerContext,
): SmartSearchPlan[] {
  const school = quote(context.schoolName);
  const aliases = context.aliases.slice(0, 3).map(quote);
  const nameQuery = [school, ...aliases].join(' OR ');
  const root = context.rootDomain ? [context.rootDomain] : undefined;
  const plans: SmartSearchPlan[] = [];
  const fieldPlans = fieldSpecificPlans(context, nameQuery);

  if (root) {
    plans.push({
      stage: 1,
      kind: 'official-root-field',
      query: `${school} ${fieldPlans.official}`,
      includeDomains: root,
      expectedSourceFamily: 'OFFICIAL_SCHOOL',
    });
    plans.push({
      stage: 2,
      kind: 'official-root-ir-news-profile',
      query: `${school} ("institutional research" OR OIR OR "common data set" OR factbook OR newsroom OR "class profile") ${fieldPlans.official}`,
      includeDomains: root,
      expectedSourceFamily: 'OFFICIAL_SCHOOL',
    });
  }

  const stateDomains = context.state
    ? STATE_SYSTEM_DOMAINS[context.state.toUpperCase()]
    : undefined;
  if (stateDomains?.length && fieldPlans.stateSystem) {
    plans.push({
      stage: 3,
      kind: 'state-system-dashboard',
      query: `${school} ${fieldPlans.stateSystem}`,
      includeDomains: stateDomains,
      expectedSourceFamily: 'STATE_SYSTEM',
    });
  }

  plans.push({
    stage: 4,
    kind: 'field-specific-global-official',
    query: `${nameQuery} ${fieldPlans.official}`,
    excludeDomains: FALSE_POSITIVE_DOMAINS,
    expectedSourceFamily: context.primarySourceFamily,
  });

  if (context.governmentDomains?.length && fieldPlans.government) {
    plans.push({
      stage: 5,
      kind: 'government-public-dataset',
      query: `${school} ${fieldPlans.government}`,
      includeDomains: context.governmentDomains,
      expectedSourceFamily: 'GOVERNMENT',
    });
  }

  if (context.allowSecondary && context.secondaryDomains?.length) {
    plans.push({
      stage: 6,
      kind: 'allowed-secondary',
      query: `${nameQuery} ${fieldPlans.secondary}`,
      includeDomains: context.secondaryDomains,
      expectedSourceFamily: 'SECONDARY_AGGREGATOR',
    });
  }

  plans.push({
    stage: 7,
    kind: 'wide-official-fallback',
    query: `${nameQuery} ${fieldPlans.fallback}`,
    excludeDomains: FALSE_POSITIVE_DOMAINS,
    expectedSourceFamily: context.primarySourceFamily,
  });

  return dedupePlans(plans);
}

function fieldSpecificPlans(context: SmartPlannerContext, nameQuery: string) {
  switch (context.field) {
    case 'edAcceptanceRate':
      return phrases(
        '"early decision" ("acceptance rate" OR "admit rate" OR admitted OR applicants) "class of 2029"',
        '"early decision" admissions statistics class profile',
        '"early decision acceptance rate"',
        '"early decision" "class of 2029"',
      );
    case 'eaAcceptanceRate':
      return phrases(
        '"early action" ("acceptance rate" OR "admit rate" OR admitted OR applicants) "class of 2029"',
        '"early action" admissions statistics class profile',
        '"early action acceptance rate"',
        '"early action" "class of 2029"',
      );
    case 'transferAcceptanceRate':
      return phrases(
        '"transfer applicants" admitted "Common Data Set" D2',
        '"transfer admission" applicants admitted',
        '"transfer acceptance rate"',
        '"transfer profile" admitted applicants',
      );
    case 'gpaDistribution':
      return phrases(
        '"Common Data Set" C11 GPA distribution percentage',
        '"first-time first-year" GPA distribution C11',
        '"GPA distribution" "Common Data Set"',
        '"freshman profile" "GPA distribution"',
      );
    case 'cdsAdmitBands':
      return phrases(
        '"admit rate" GPA SAT ACT table "Common Data Set" C9',
        '"admission rate by GPA" "SAT" "ACT"',
        '"GPA" "SAT" "admit rate"',
        '"admit-rate-by-GPA" "test score"',
      );
    case 'programRates':
      return phrases(
        '"admission by major" applicants admitted admit rate',
        '"program admit rate" applicants admitted',
        '"college admit rate" applicants admitted',
        '"first-year applicants admitted by college"',
      );
    case 'deadlines':
      return phrases(
        '"first-year application deadlines" ED EA RD',
        '"application deadline" "early decision" "regular decision"',
        '"Common App" deadlines',
        '"apply" deadlines first-year',
      );
    case 'essayPrompts':
      return phrases(
        '"supplemental essay prompts" "2025-26"',
        '"writing supplement" prompts',
        '"Common App" supplement essay prompts',
        '"supplemental essays"',
      );
    case 'rankings':
      return phrases(
        '"ranking" "US News" QS Forbes THE',
        '"best colleges" ranking',
        '"computer science ranking" "business ranking" "engineering ranking"',
        '"college rankings"',
      );
    case 'communityRatings':
      return phrases(
        '"student reviews" safety life food',
        '"campus safety" "student life" "campus food"',
        '"student ratings"',
        '"community reviews"',
      );
    case 'admissionCases':
      return phrases(
        '"admission case" result GPA SAT',
        '"accepted profile" GPA SAT admitted',
        '"student profile" admitted',
        '"admission results"',
      );
    case 'satMath25':
    case 'satMath75':
      return phrases(
        '"SAT Math" "middle 50"',
        '"SAT Math" 25th 75th percentile',
        '"Common Data Set" C9 "SAT Math"',
        '"admitted student profile" "SAT Math"',
      );
    case 'satReading25':
    case 'satReading75':
      return phrases(
        '"SAT ERW" "middle 50"',
        '"Evidence-Based Reading" 25th 75th percentile',
        '"Common Data Set" C9 "SAT Evidence-Based Reading"',
        '"admitted student profile" "SAT ERW"',
      );
    default:
      return phrases(
        context.searchHints.map(quote).join(' OR '),
        context.searchHints.slice(0, 2).map(quote).join(' '),
        context.searchHints[0]
          ? quote(context.searchHints[0])
          : quote(context.label),
        `${quote(context.label)} ${nameQuery}`,
      );
  }
}

function phrases(
  official: string,
  stateSystem: string,
  secondary: string,
  fallback: string,
) {
  return {
    official,
    stateSystem,
    government: stateSystem,
    secondary,
    fallback,
  };
}

function quote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '""';
  return trimmed.startsWith('"') ? trimmed : `"${trimmed}"`;
}

function dedupePlans(plans: SmartSearchPlan[]) {
  const seen = new Set<string>();
  return plans.filter((plan) => {
    const key = `${plan.kind}:${plan.query}:${plan.includeDomains?.join(',') ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
