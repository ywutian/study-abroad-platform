/**
 * prediction-data-landscape.ts
 *
 * Survey what real prediction-vs-outcome data exists in the database
 * across multiple sources. Highlights:
 *  - AdmissionCase population (peer historical data, no current-user prediction)
 *  - PredictionResult population (current predictions, no outcome yet)
 *  - The (small) overlap where both exist for the same (user, school)
 *  - Slice both populations by year/round/result/tier
 *
 * No prediction engine call — pure SQL aggregations over real data.
 *
 *   pnpm tsx scripts/prediction-data-landscape.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function table(title: string, rows: unknown[]) {
  console.log(`\n═══ ${title} ═══`);
  if (Array.isArray(rows) && rows.length === 0) {
    console.log('(empty)');
    return;
  }
  console.table(rows);
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'n/a';
  return (Number(n) * 100).toFixed(1) + '%';
}

async function main(): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────
  // 1. AdmissionCase population (peer historical data)
  // ─────────────────────────────────────────────────────────────────────
  const acTotal = await prisma.admissionCase.count();
  const acBinary = await prisma.admissionCase.count({
    where: { result: { in: ['ADMITTED', 'REJECTED'] } },
  });
  console.log(`AdmissionCase: ${acTotal} total, ${acBinary} with binary label (ADMITTED/REJECTED)`);

  const acByYearRound = await prisma.$queryRaw<
    Array<{ year: number; round: string | null; admits: bigint; rejects: bigint; n: bigint }>
  >`
    SELECT year, round,
           COUNT(*) FILTER (WHERE result = 'ADMITTED') AS admits,
           COUNT(*) FILTER (WHERE result = 'REJECTED') AS rejects,
           COUNT(*) AS n
    FROM "AdmissionCase"
    WHERE result IN ('ADMITTED','REJECTED')
    GROUP BY year, round
    ORDER BY year DESC, round
  `;
  table(
    'AdmissionCase by year × round',
    acByYearRound.map((r) => ({
      year: r.year,
      round: r.round ?? '(none)',
      n: Number(r.n),
      admits: Number(r.admits),
      rejects: Number(r.rejects),
      admitRate: pct(Number(r.admits) / Number(r.n)),
    }))
  );

  const acBySchool = await prisma.$queryRaw<
    Array<{ name: string; n: bigint; admits: bigint; selectivity: number | null }>
  >`
    SELECT s.name,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE ac.result = 'ADMITTED') AS admits,
           s."acceptanceRate"::float AS selectivity
    FROM "AdmissionCase" ac
    JOIN "School" s ON s.id = ac."schoolId"
    WHERE ac.result IN ('ADMITTED','REJECTED')
    GROUP BY s.id, s.name, s."acceptanceRate"
    ORDER BY n DESC, s.name
    LIMIT 15
  `;
  table(
    'AdmissionCase by school (top 15)',
    acBySchool.map((r) => ({
      school: r.name,
      n: Number(r.n),
      admits: Number(r.admits),
      admitRate: pct(Number(r.admits) / Number(r.n)),
      schoolPublishedRate: r.selectivity !== null ? `${Number(r.selectivity).toFixed(1)}%` : 'n/a',
    }))
  );

  // ─────────────────────────────────────────────────────────────────────
  // 2. PredictionResult population
  // ─────────────────────────────────────────────────────────────────────
  const prByTier = await prisma.$queryRaw<
    Array<{
      tier: string | null;
      round: string | null;
      n: bigint;
      avg_p: number;
      min_p: number;
      max_p: number;
    }>
  >`
    SELECT tier, "applicationRound" AS round, COUNT(*) AS n,
           AVG(probability)::float AS avg_p,
           MIN(probability)::float AS min_p,
           MAX(probability)::float AS max_p
    FROM "PredictionResult"
    WHERE source = 'prediction'
    GROUP BY tier, "applicationRound"
    ORDER BY tier, "applicationRound"
  `;
  table(
    'PredictionResult by tier × round (source=prediction)',
    prByTier.map((r) => ({
      tier: r.tier ?? '(none)',
      round: r.round ?? '(none)',
      n: Number(r.n),
      meanP: pct(Number(r.avg_p)),
      minP: pct(Number(r.min_p)),
      maxP: pct(Number(r.max_p)),
    }))
  );

  // Probability distribution
  const probDist = await prisma.$queryRaw<Array<{ bucket: string; n: bigint }>>`
    SELECT
      CASE
        WHEN probability < 0.1 THEN '00–10%'
        WHEN probability < 0.2 THEN '10–20%'
        WHEN probability < 0.3 THEN '20–30%'
        WHEN probability < 0.4 THEN '30–40%'
        WHEN probability < 0.5 THEN '40–50%'
        WHEN probability < 0.6 THEN '50–60%'
        WHEN probability < 0.7 THEN '60–70%'
        WHEN probability < 0.8 THEN '70–80%'
        WHEN probability < 0.9 THEN '80–90%'
        ELSE '90–100%'
      END AS bucket,
      COUNT(*) AS n
    FROM "PredictionResult"
    WHERE source = 'prediction'
    GROUP BY 1
    ORDER BY 1
  `;
  table(
    'PredictionResult probability distribution',
    probDist.map((r) => ({ bucket: r.bucket, n: Number(r.n) }))
  );

  // ─────────────────────────────────────────────────────────────────────
  // 3. The overlap: real (prediction, outcome) pairs
  // ─────────────────────────────────────────────────────────────────────
  const overlap = await prisma.$queryRaw<
    Array<{
      schoolName: string;
      actualResult: string;
      actualRound: string | null;
      predictedProb: number;
      predictedTier: string | null;
      predictedRound: string | null;
      modelVersion: string | null;
    }>
  >`
    SELECT
      s.name AS "schoolName",
      ac.result::text AS "actualResult",
      ac.round AS "actualRound",
      pr.probability::float AS "predictedProb",
      pr.tier AS "predictedTier",
      pr."applicationRound" AS "predictedRound",
      pr."modelVersion" AS "modelVersion"
    FROM "AdmissionCase" ac
    INNER JOIN "Profile" prof ON prof."userId" = ac."userId"
    INNER JOIN "PredictionResult" pr
      ON pr."profileId" = prof.id AND pr."schoolId" = ac."schoolId"
    INNER JOIN "School" s ON s.id = ac."schoolId"
    WHERE ac.result IN ('ADMITTED', 'REJECTED')
      AND pr.source = 'prediction'
    ORDER BY pr.probability ASC
  `;
  table(
    `Real prediction × outcome pairs (${overlap.length} total)`,
    overlap.map((r) => ({
      school: r.schoolName,
      actual: r.actualResult,
      actualRound: r.actualRound ?? '?',
      predicted: pct(Number(r.predictedProb)),
      predictedTier: r.predictedTier ?? '?',
      predictedRound: r.predictedRound ?? '?',
      modelVersion: r.modelVersion ?? '?',
      verdict:
        r.actualResult === 'ADMITTED' && Number(r.predictedProb) >= 0.5
          ? '✓ correct admit'
          : r.actualResult === 'REJECTED' && Number(r.predictedProb) < 0.5
            ? '✓ correct reject'
            : r.actualResult === 'ADMITTED'
              ? '✗ FALSE NEGATIVE'
              : '✗ FALSE POSITIVE',
    }))
  );

  if (overlap.length > 0) {
    const probs = overlap.map((r) => Number(r.predictedProb));
    const labels = overlap.map((r) => (r.actualResult === 'ADMITTED' ? 1 : 0));
    const brier = probs.reduce((a, p, i) => a + (p - labels[i]) ** 2, 0) / probs.length;
    const accuracy = probs.filter((p, i) => (p >= 0.5 ? 1 : 0) === labels[i]).length / probs.length;
    const meanPred = probs.reduce((a, p) => a + p, 0) / probs.length;
    const admitRate = labels.reduce((a, x) => a + x, 0) / labels.length;
    console.log(
      `\nOverlap metrics: n=${overlap.length}, Brier=${brier.toFixed(4)}, ` +
        `Accuracy@0.5=${pct(accuracy)}, Mean predicted=${pct(meanPred)}, ` +
        `Actual admit rate=${pct(admitRate)}`
    );
    console.log(
      `(Brier ≤ 0.20 is the target; with n=${overlap.length} this is informative but noisy.)`
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. Gap analysis
  // ─────────────────────────────────────────────────────────────────────
  const gap = await prisma.$queryRaw<
    Array<{ predictions: bigint; cases: bigint; overlap: bigint; verifiedLabels: bigint }>
  >`
    SELECT
      (SELECT COUNT(*) FROM "PredictionResult" WHERE source = 'prediction') AS predictions,
      (SELECT COUNT(*) FROM "AdmissionCase" WHERE result IN ('ADMITTED','REJECTED')) AS cases,
      (SELECT COUNT(*)
         FROM "AdmissionCase" ac
         JOIN "Profile" prof ON prof."userId" = ac."userId"
         JOIN "PredictionResult" pr ON pr."profileId" = prof.id AND pr."schoolId" = ac."schoolId"
         WHERE ac.result IN ('ADMITTED','REJECTED') AND pr.source = 'prediction') AS overlap,
      (SELECT COUNT(*) FROM "PredictionOutcomeLabelRecord"
         WHERE status IN ('COUNSELOR_VERIFIED','DOCUMENT_VERIFIED')) AS "verifiedLabels"
  `;
  const g = gap[0];
  console.log('\n═══ Gap Analysis ═══');
  console.log(`Predictions in DB:         ${Number(g.predictions)}`);
  console.log(`AdmissionCase (binary):    ${Number(g.cases)}`);
  console.log(`Overlap (joinable):        ${Number(g.overlap)}`);
  console.log(`Verified outcome labels:   ${Number(g.verifiedLabels)}`);
  console.log(
    `\n→ Of ${Number(g.predictions)} predictions, only ${Number(g.overlap)} have a matching real outcome.`
  );
  console.log(
    `→ Of ${Number(g.cases)} historical cases, only ${Number(g.overlap)} apply to a current user the platform has predicted for.`
  );
  console.log(
    `→ The 99 cases are peer reference data (Stanford / MIT / etc. anonymized admits), not current-user outcomes.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
