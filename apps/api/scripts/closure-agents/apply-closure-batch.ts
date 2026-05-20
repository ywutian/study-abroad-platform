#!/usr/bin/env tsx
/**
 * apply-closure-batch.ts — closure-v2 generic batch writer.
 *
 * Reads a JSON file of per-target decisions and applies them:
 *   - CLOSED  : writes the real value into the School column (when the field is
 *               a real School column) AND/OR School.metadata.provenance, then
 *               sets ClosureTarget.status=CLOSED.
 *   - UNAVAILABLE : sets ClosureTarget.status=UNAVAILABLE with a verified reason.
 *
 * NEVER fabricates — the caller (sub-agent) is responsible for verification.
 * Unverifiable ⇒ the caller must pass UNAVAILABLE with a reason, not a guessed
 * value.
 *
 * Input JSON shape:
 * {
 *   "decisions": [
 *     { "targetId": "...", "status": "CLOSED", "field": "eaAcceptanceRate",
 *       "schoolId": "...", "value": 12.3, "sourceUrl": "https://...",
 *       "confidence": 0.9, "tier": "OFFICIAL", "note": "CDS C21 ..." },
 *     { "targetId": "...", "status": "UNAVAILABLE", "field": "edAcceptanceRate",
 *       "schoolId": "...", "sourceUrl": "https://...",
 *       "reason": "School runs no Early Decision plan (Restrictive EA only)." }
 *   ]
 * }
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/apply-closure-batch.ts <file.json>
 */
import * as fs from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FETCHED_AT = new Date().toISOString();

/** Real School columns (Decimal/Int/Boolean) keyed by closure field name. */
const SCHOOL_COLUMN: Record<string, 'number' | 'boolean' | 'json'> = {
  acceptanceRate: 'number',
  intlAcceptanceRate: 'number',
  oosAcceptanceRate: 'number',
  transferAcceptanceRate: 'number',
  edAcceptanceRate: 'number',
  eaAcceptanceRate: 'number',
  ed2AcceptanceRate: 'number',
  yieldRate: 'number',
  sat25: 'number',
  sat75: 'number',
  satAvg: 'number',
  act25: 'number',
  act75: 'number',
  actAvg: 'number',
  graduationRate: 'number',
  retentionRate: 'number',
  percentNeedMet: 'number',
  averageNetPrice: 'number',
  studentFacultyRatio: 'number',
  totalEnrollment: 'number',
  needBlindInternational: 'boolean',
  gpaDistribution: 'json',
};

interface Decision {
  targetId: string;
  status: 'CLOSED' | 'UNAVAILABLE';
  field: string;
  schoolId?: string;
  value?: number | boolean | object | null;
  sourceUrl?: string | null;
  confidence?: number | null;
  tier?: string | null;
  note?: string;
  reason?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: apply-closure-batch.ts <decisions.json>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    decisions: Decision[];
  };
  const decisions = raw.decisions ?? [];
  let closed = 0;
  let unavailable = 0;
  let schoolWrites = 0;
  let errors = 0;

  for (const d of decisions) {
    try {
      if (d.status === 'CLOSED') {
        // 1) write the real value into the School row (column + provenance)
        if (d.schoolId && d.value != null) {
          const colKind = SCHOOL_COLUMN[d.field];
          const school = await prisma.school.findUnique({
            where: { id: d.schoolId },
            select: { id: true, metadata: true },
          });
          if (school) {
            const meta = isRecord(school.metadata) ? school.metadata : {};
            const prov = isRecord(meta.provenance) ? meta.provenance : {};
            const data: Prisma.SchoolUpdateInput = {
              metadata: {
                ...meta,
                provenance: {
                  ...prov,
                  [d.field]: {
                    value: d.value,
                    sourceUrl: d.sourceUrl ?? null,
                    fetchedAt: FETCHED_AT,
                    verifiedBy: 'closure-v2-subagent',
                    confidence: d.confidence ?? null,
                    tier: d.tier ?? 'SCRAPED',
                    note: d.note ?? null,
                  },
                },
              } as Prisma.InputJsonValue,
            };
            if (colKind === 'number' && typeof d.value === 'number') {
              (data as Record<string, unknown>)[d.field] = d.value;
            } else if (colKind === 'boolean' && typeof d.value === 'boolean') {
              (data as Record<string, unknown>)[d.field] = d.value;
            } else if (colKind === 'json') {
              (data as Record<string, unknown>)[d.field] =
                d.value as Prisma.InputJsonValue;
            }
            await prisma.school.update({ where: { id: d.schoolId }, data });
            schoolWrites += 1;
          }
        }
        await prisma.$executeRaw`
          UPDATE "ClosureTarget"
          SET status='CLOSED'::"ClosureTargetStatus",
              "sourceUrl"=${d.sourceUrl ?? null},
              confidence=${d.confidence ?? null},
              tier=${d.tier ?? 'SCRAPED'},
              notes=${d.note ?? null},
              attempts=attempts+1,
              "lastAttemptAt"=now(), "updatedAt"=now()
          WHERE id=${d.targetId}`;
        closed += 1;
      } else {
        await prisma.$executeRaw`
          UPDATE "ClosureTarget"
          SET status='UNAVAILABLE'::"ClosureTargetStatus",
              "sourceUrl"=${d.sourceUrl ?? null},
              tier='UNAVAILABLE',
              "lastError"=${d.reason ?? 'Verified not publicly published.'},
              notes=${d.reason ?? null},
              attempts=attempts+1,
              "lastAttemptAt"=now(), "updatedAt"=now()
          WHERE id=${d.targetId}`;
        unavailable += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(
        `  ERROR ${d.field} ${d.targetId}:`,
        (err as Error).message,
      );
    }
  }
  console.log(
    `apply-closure-batch: CLOSED=${closed} UNAVAILABLE=${unavailable} ` +
      `schoolWrites=${schoolWrites} errors=${errors}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
