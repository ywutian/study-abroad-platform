import {
  CampusReelStaticAdapter,
  parseCampusReelStaticHtml,
  resolveCampusReelSlug,
} from './campusreel-static.adapter';

const HTML_FIXTURE = `
  <html>
    <body>
      <section>
        <h3>What are your chances at Example University with SAT score 1400?</h3>
        <p>Students with SAT score 1400 have a 44% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with SAT score 1200?</h3>
        <p>Applicants with SAT 1200 have a 26% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with SAT score 1100?</h3>
        <p>Applicants with SAT 1100 have a 15% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with GPA 3.9?</h3>
        <p>Students with GPA 3.9 have a 41% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with GPA 3.5?</h3>
        <p>Students with GPA 3.5 have a 27% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with GPA 3.2?</h3>
        <p>Students with GPA 3.2 have a 16% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with GPA 3.0?</h3>
        <p>Students with GPA 3.0 have a <10% chance of admission.</p>
      </section>
      <section>
        <h3>What are your chances at Example University with GPA 2.5?</h3>
        <p>Students with GPA 2.5 have a <10% chance of admission.</p>
      </section>
    </body>
  </html>
`;

describe('CampusReelStaticAdapter', () => {
  it('parses all canonical SAT and GPA buckets from HTML', () => {
    const parsed = parseCampusReelStaticHtml(
      HTML_FIXTURE,
      'https://example.com/campusreel',
    );

    expect(parsed.sat.map((bucket) => bucket.key)).toEqual([
      'SAT_1400',
      'SAT_1200',
      'SAT_1100',
    ]);
    expect(parsed.gpa.map((bucket) => bucket.key)).toEqual([
      'GPA_3_9',
      'GPA_3_5',
      'GPA_3_2',
      'GPA_3_0',
      'GPA_2_5',
    ]);
    expect(parsed.sourceUrl).toBe('https://example.com/campusreel');
  });

  it('normalizes threshold buckets to 0.05 with low confidence', () => {
    const parsed = parseCampusReelStaticHtml(HTML_FIXTURE);
    const gpa30 = parsed.gpa.find((bucket) => bucket.key === 'GPA_3_0');

    expect(gpa30?.probability).toBeCloseTo(0.05, 6);
    expect(gpa30?.confidence).toBe('low');
    expect(gpa30?.rawProbability).toBe('<10');
  });

  it('resolves slug from metadata override, manual override, then fallback slugify', () => {
    expect(
      resolveCampusReelSlug({
        id: 'school-1',
        name: 'Any School',
        metadata: { slugs: { campusreel: 'custom-school-slug' } },
      }),
    ).toBe('custom-school-slug');

    expect(
      resolveCampusReelSlug({
        id: 'school-2',
        name: 'Massachusetts Institute of Technology',
        metadata: null,
      }),
    ).toBe('massachusetts-institute-of-technology-mit');

    expect(
      resolveCampusReelSlug({
        id: 'school-3',
        name: 'Example University',
        metadata: null,
      }),
    ).toBe('example-university');
  });

  it('evaluates the nearest SAT and GPA buckets and averages them', () => {
    const adapter = new CampusReelStaticAdapter();
    const parsed = parseCampusReelStaticHtml(HTML_FIXTURE);
    const evaluation = adapter.evaluateProfile(
      {
        gpa: 3.6,
        testScores: [{ type: 'SAT', score: 1320 }],
        activities: [],
        awards: [],
      },
      {
        id: 'school-4',
        name: 'Example University',
      },
      parsed,
    );

    expect(evaluation?.satMatch?.key).toBe('SAT_1400');
    expect(evaluation?.gpaMatch?.key).toBe('GPA_3_5');
    expect(evaluation?.probability).toBeCloseTo((0.44 + 0.27) / 2, 6);
  });
});
