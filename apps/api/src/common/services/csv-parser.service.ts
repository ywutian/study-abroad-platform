import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CASE_CSV_COLUMNS, CsvColumnDef } from '../constants/csv-templates';
import { CaseRound, CaseStandardFormat } from '../constants/data-formats';
import {
  normalizeCurriculum,
  normalizeHighSchoolType,
  normalizeResult,
  normalizeRound,
  normalizeSchoolName,
  parseActivitiesText,
  parseAwardsText,
  parseTestScoresFromRanges,
} from '../utils/import-normalizers';

export interface CsvParseError {
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult<T> {
  valid: T[];
  errors: CsvParseError[];
  totalRows: number;
}

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  /**
   * Parse CSV content into case standard format
   */
  parseCaseCsv(csvContent: string): CsvParseResult<CaseStandardFormat> {
    const rows = this.parseRawCsv(csvContent);
    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const headerMap = this.mapHeaders(headers, CASE_CSV_COLUMNS);
    const valid: CaseStandardFormat[] = [];
    const errors: CsvParseError[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every((c) => !c.trim())) continue;

      const rowNum = i + 1;
      const getValue = (key: string) => {
        const idx = headerMap[key];
        return idx !== undefined ? row[idx]?.trim() : undefined;
      };

      // Required fields
      const schoolName = getValue('school_name');
      const yearStr = getValue('year');
      const resultStr = getValue('result');

      if (!schoolName) {
        errors.push({ row: rowNum, field: 'school_name', message: 'Required' });
        continue;
      }
      if (!yearStr) {
        errors.push({ row: rowNum, field: 'year', message: 'Required' });
        continue;
      }
      if (!resultStr) {
        errors.push({ row: rowNum, field: 'result', message: 'Required' });
        continue;
      }

      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 2000 || year > 2100) {
        errors.push({
          row: rowNum,
          field: 'year',
          message: 'Must be 2000-2100',
        });
        continue;
      }

      const result = normalizeResult(resultStr);
      if (!result) {
        errors.push({
          row: rowNum,
          field: 'result',
          message: `Invalid: ${resultStr}`,
        });
        continue;
      }

      const entry: CaseStandardFormat = {
        source: 'csv_import',
        schoolName: normalizeSchoolName(schoolName) ?? schoolName,
        year,
        result,
      };

      // Optional fields
      const round = getValue('round');
      if (round) {
        const normalized = normalizeRound(round) as CaseRound | null;
        if (normalized) entry.round = normalized;
      }

      const major = getValue('major');
      if (major) entry.major = major;

      const gpa = getValue('gpa');
      const gpaScale = getValue('gpa_scale');
      if (gpa) {
        entry.gpa = {
          range: gpa,
          scale: (parseInt(gpaScale ?? '4', 10) as 4 | 5 | 100) || 4,
        };
      }

      const sat = getValue('sat');
      if (sat) entry.sat = { range: sat };

      const act = getValue('act');
      if (act) entry.act = { range: act };

      const toefl = getValue('toefl');
      if (toefl) entry.toefl = { range: toefl };

      const ielts = getValue('ielts');
      if (ielts) {
        const ieltsNum = parseFloat(ielts);
        if (!isNaN(ieltsNum)) entry.ielts = { overall: ieltsNum };
      }

      const activities = getValue('activities');
      if (activities) {
        entry.activities = parseActivitiesText(activities);
      }

      const awards = getValue('awards');
      if (awards) {
        entry.awards = parseAwardsText(awards);
      }

      // Generate structured test scores from ranges
      const testScores = parseTestScoresFromRanges(sat, act, toefl);
      if (testScores.length > 0) entry.testScores = testScores;

      const apCount = getValue('ap_count');
      const apSubjects = getValue('ap_subjects');
      if (apCount || apSubjects) {
        entry.ap = {
          count: apCount ? parseInt(apCount, 10) : undefined,
          subjects: apSubjects
            ? apSubjects
                .split(';')
                .filter(Boolean)
                .map((s) => s.trim())
            : undefined,
        };
      }

      const ibScore = getValue('ib_score');
      const ibPredicted = getValue('ib_predicted');
      if (ibScore || ibPredicted) {
        const ibNum = ibScore ? parseInt(ibScore, 10) : undefined;
        const predicted = ibPredicted
          ? ['yes', 'true', '1', '是'].includes(ibPredicted.toLowerCase())
          : undefined;
        entry.ib = {
          ...(ibNum && !isNaN(ibNum) ? { score: ibNum } : {}),
          ...(predicted !== undefined ? { predicted } : {}),
        };
      }

      const highSchoolType = getValue('high_school_type');
      if (highSchoolType) {
        const hsType = normalizeHighSchoolType(highSchoolType);
        if (hsType) entry.highSchoolType = hsType;
      }

      const curriculum = getValue('curriculum');
      if (curriculum) {
        const currType = normalizeCurriculum(curriculum);
        if (currType) entry.curriculumType = currType;
      }

      const demographicTags = getValue('demographic_tags');
      if (demographicTags) {
        entry.demographicTags = demographicTags
          .split(';')
          .filter(Boolean)
          .map((t) => t.trim());
      }

      const financialAid = getValue('financial_aid');
      if (financialAid) entry.financialAid = financialAid;

      const enrollmentStatus = getValue('enrollment_status');
      if (enrollmentStatus) entry.enrollmentStatus = enrollmentStatus;

      const narrative = getValue('narrative');
      if (narrative) entry.narrative = narrative;

      const tags = getValue('tags');
      if (tags)
        entry.tags = tags
          .split(';')
          .filter(Boolean)
          .map((t) => t.trim());

      const essayType = getValue('essay_type');
      const essayPrompt = getValue('essay_prompt');
      const essayContent = getValue('essay_content');
      if (essayType || essayPrompt || essayContent) {
        entry.essays = [
          {
            type: essayType ?? 'OTHER',
            prompt: essayPrompt,
            content: essayContent,
          },
        ];
      }

      const sourceUrl = getValue('source_url');
      if (sourceUrl) entry.sourceUrl = sourceUrl;

      valid.push(entry);
    }

    this.logger.log(
      `CSV parsed: ${valid.length} valid, ${errors.length} errors`,
    );
    return { valid, errors, totalRows: rows.length - 1 };
  }

  // ============================================
  // Internal CSV Parsing
  // ============================================

  private parseRawCsv(content: string): string[][] {
    const lines: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (inQuotes) {
        if (char === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field);
        field = '';
      } else if (char === '\n' || (char === '\r' && content[i + 1] === '\n')) {
        current.push(field);
        field = '';
        lines.push(current);
        current = [];
        if (char === '\r') i++;
      } else {
        field += char;
      }
    }

    // Last field/line
    if (field || current.length > 0) {
      current.push(field);
      lines.push(current);
    }

    return lines;
  }

  /**
   * Map headers (EN or ZH) to column indices
   */
  private mapHeaders(
    headers: string[],
    columns: CsvColumnDef[],
  ): Record<string, number> {
    const map: Record<string, number> = {};

    for (const col of columns) {
      const idx = headers.findIndex(
        (h) =>
          h === col.key ||
          h === col.headerEn.toLowerCase() ||
          h === col.headerZh,
      );
      if (idx !== -1) map[col.key] = idx;
    }

    return map;
  }
}
