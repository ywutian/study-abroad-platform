import { A_LEVEL_UCAS, IGCSE_GRADE_POINTS } from './test-score-constants';

export interface SubjectEntry {
  subject: string;
  score: string;
  level?: 'HL' | 'SL';
}

/** Minimal subset of the Add-Score form values the payload builder reads. */
export interface TestScoreValues {
  score?: string;
  satReading?: string;
  satMath?: string;
  actEnglish?: string;
  actMath?: string;
  actReading?: string;
  actScience?: string;
  toeflReading?: string;
  toeflListening?: string;
  toeflSpeaking?: string;
  toeflWriting?: string;
}

export interface TestScorePayload {
  score: number;
  subScores?: Record<string, number | string>;
}

/**
 * Pure builder for the persisted { score, subScores } of a test entry.
 * Extracted from the form's onSubmit so the branchy per-type logic is unit-
 * testable — the parts that fail silently if broken:
 *   - AP:     score = count of exams (there is no single "AP score")
 *   - IB:     score = diploma total (sum of subjects, out of 45)
 *   - TOEFL:  half-point (2026 scale) — parseFloat, NOT parseInt (5.5 must stay 5.5)
 *   - IELTS:  x.5 bands — same
 */
export function buildTestScorePayload(
  type: string,
  values: TestScoreValues,
  subjectEntries: SubjectEntry[]
): TestScorePayload {
  const num = (s?: string) => parseFloat(s || '0') || 0;
  const subScores: Record<string, number | string> = {};
  let score: number;

  if (type === 'AP') {
    for (const e of subjectEntries) {
      if (e.subject && e.score) subScores[e.subject] = parseInt(e.score);
    }
    score = Object.keys(subScores).length; // count of AP exams
  } else if (type === 'IB') {
    let sum = 0;
    for (const e of subjectEntries) {
      if (e.subject && e.score) {
        const key = e.level ? `${e.subject} (${e.level})` : e.subject;
        const v = parseInt(e.score);
        subScores[key] = v;
        sum += Number.isNaN(v) ? 0 : v;
      }
    }
    score = sum; // IB diploma total (out of 45)
  } else if (type === 'A_LEVEL') {
    for (const e of subjectEntries) {
      if (e.subject && e.score) subScores[e.subject] = e.score;
    }
    score = subjectEntries.reduce((s, e) => s + (A_LEVEL_UCAS[e.score] ?? 0), 0);
  } else if (type === 'IGCSE') {
    for (const e of subjectEntries) {
      if (e.subject && e.score) subScores[e.subject] = e.score;
    }
    score = subjectEntries.reduce((s, e) => s + (IGCSE_GRADE_POINTS[e.score] ?? 0), 0);
  } else if (type === 'SAT') {
    if (values.satReading) subScores.reading = parseInt(values.satReading);
    if (values.satMath) subScores.math = parseInt(values.satMath);
    score = num(values.score);
  } else if (type === 'ACT') {
    if (values.actEnglish) subScores.english = parseInt(values.actEnglish);
    if (values.actMath) subScores.math = parseInt(values.actMath);
    if (values.actReading) subScores.reading = parseInt(values.actReading);
    if (values.actScience) subScores.science = parseInt(values.actScience);
    score = num(values.score);
  } else if (type === 'TOEFL') {
    if (values.toeflReading) subScores.reading = num(values.toeflReading);
    if (values.toeflListening) subScores.listening = num(values.toeflListening);
    if (values.toeflSpeaking) subScores.speaking = num(values.toeflSpeaking);
    if (values.toeflWriting) subScores.writing = num(values.toeflWriting);
    score = num(values.score);
  } else {
    // IELTS (x.5 bands), Duolingo — single decimal-capable score.
    score = num(values.score);
  }

  return {
    score,
    subScores: Object.keys(subScores).length > 0 ? subScores : undefined,
  };
}
