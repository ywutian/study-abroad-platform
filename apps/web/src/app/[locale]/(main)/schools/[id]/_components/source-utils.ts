/**
 * Maps data source identifiers to their canonical URLs.
 * Used to link provenance badges to the original data source.
 */

const SOURCE_URL_TEMPLATES: Record<string, string | ((ctx: SourceContext) => string | null)> = {
  COLLEGE_SCORECARD: (ctx) =>
    ctx.scorecardId ? `https://collegescorecard.ed.gov/school/?${ctx.scorecardId}` : null,
  IPEDS: (ctx) =>
    ctx.ipedsId
      ? `https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=${ctx.ipedsId}`
      : null,
  URBAN_INSTITUTE: (ctx) =>
    ctx.ipedsId
      ? `https://educationdata.urban.org/documentation/colleges.html#${ctx.ipedsId}`
      : null,
  BIGFUTURE: 'https://bigfuture.collegeboard.org/',
  APPILY: 'https://www.appily.com/',
};

interface SourceContext {
  scorecardId?: string;
  ipedsId?: string;
}

/**
 * Returns the URL for a given data source, or null if no URL can be constructed.
 */
export function getSourceUrl(source: string, context: SourceContext): string | null {
  const template = SOURCE_URL_TEMPLATES[source];
  if (!template) return null;
  if (typeof template === 'string') return template;
  return template(context);
}
