/**
 * replay-v3-cases.ts
 *
 * Replay the 4 (AdmissionCase × PredictionResult) pairs through the current
 * CounselorEngine via the /admin/predictions/distillation/dry-run endpoint to
 * see how the new rules engine scores them vs the legacy v3-enterprise output.
 *
 * Requires API running on localhost:4101 and an admin JWT.
 *
 *   pnpm tsx scripts/replay-v3-cases.ts
 */
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4101/api/v1';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';

type Case = {
  schoolName: string;
  schoolId: string;
  round: string;
  actualResult: string;
  v3Probability: number;
  gpaRange: string | null;
  satRange: string | null;
  toeflRange: string | null;
  tags: string[];
  major: string | null;
};

function midpoint(range: string | null): number | null {
  if (!range) return null;
  const m = range.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const s = range.match(/(\d+(?:\.\d+)?)/);
  return s ? Number(s[1]) : null;
}

function buildProfile(c: Case) {
  const gpa = midpoint(c.gpaRange);
  const sat = midpoint(c.satRange);
  const toefl = midpoint(c.toeflRange);
  const testScores: Array<{ type: string; score: number }> = [];
  if (sat !== null) testScores.push({ type: 'SAT', score: sat });
  if (toefl !== null) testScores.push({ type: 'TOEFL', score: toefl });

  const activities = c.tags.map((tag) => ({
    name: tag,
    category: 'other',
    role: 'participant',
  }));

  return {
    gpa: gpa ?? undefined,
    gpaScale: 4.0,
    targetMajor: c.major ?? undefined,
    testScores,
    activities,
    awards: [],
    isLegacy: c.tags.includes('legacy'),
    isFirstGen: c.tags.includes('first_gen'),
    recruitedAthlete: c.tags.includes('athlete'),
  };
}

async function main() {
  // Login
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const login = await loginRes.json();
  const token: string = login?.data?.accessToken;
  if (!token) {
    console.error('Login failed:', login);
    process.exit(1);
  }

  // Fetch the 4 cases
  const prisma = new PrismaClient();
  const cases = await prisma.$queryRaw<Case[]>`
    SELECT
      s.name AS "schoolName",
      ac."schoolId",
      ac.round,
      ac.result::text AS "actualResult",
      pr.probability::float AS "v3Probability",
      ac."gpaRange",
      ac."satRange",
      ac."toeflRange",
      ac.tags,
      ac.major
    FROM "AdmissionCase" ac
    JOIN "Profile" prof ON prof."userId" = ac."userId"
    JOIN "PredictionResult" pr ON pr."profileId" = prof.id AND pr."schoolId" = ac."schoolId"
    JOIN "School" s ON s.id = ac."schoolId"
    WHERE ac.result IN ('ADMITTED','REJECTED')
      AND pr.source = 'prediction'
    ORDER BY pr.probability ASC
  `;
  console.log(`Replaying ${cases.length} cases through CounselorEngine...\n`);

  const results: Array<{
    school: string;
    round: string;
    actual: string;
    v3: string;
    counselor: string;
    delta: string;
    counselorTier: string | null;
  }> = [];

  for (const c of cases) {
    const profile = buildProfile(c);
    const dryRunRes = await fetch(`${API}/admin/predictions/distillation/dry-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile,
        schoolIds: [c.schoolId],
        applicationRound: c.round,
        engine: 'counselor',
        locale: 'en',
      }),
    });
    const body = await dryRunRes.json();
    if (!dryRunRes.ok) {
      console.error(`Failed for ${c.schoolName}:`, JSON.stringify(body).slice(0, 300));
      continue;
    }
    const result = body?.data?.results?.[0] ?? body?.results?.[0];
    if (!result) {
      console.error(`No result for ${c.schoolName}:`, JSON.stringify(body).slice(0, 300));
      continue;
    }
    const newProb = Number(result.probability);
    const delta = newProb - c.v3Probability;
    results.push({
      school: c.schoolName,
      round: c.round,
      actual: c.actualResult,
      v3: `${(c.v3Probability * 100).toFixed(1)}%`,
      counselor: `${(newProb * 100).toFixed(1)}%`,
      delta: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp`,
      counselorTier: result.tier ?? null,
    });
  }

  console.log('═══ v3 vs CounselorEngine on 4 real ADMITTED cases ═══');
  console.table(results);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
