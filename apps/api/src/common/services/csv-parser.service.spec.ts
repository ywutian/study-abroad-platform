import { BadRequestException } from '@nestjs/common';
import { CsvParserService } from './csv-parser.service';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  describe('parseCaseCsv', () => {
    it('should parse a valid CSV with required fields', () => {
      const csv = 'school_name,year,result\nMIT,2025,ADMITTED';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].schoolName).toBe(
        'Massachusetts Institute of Technology',
      );
      expect(result.valid[0].year).toBe(2025);
      expect(result.valid[0].result).toBe('ADMITTED');
      expect(result.valid[0].source).toBe('csv_import');
    });

    it('should throw on empty CSV', () => {
      expect(() => service.parseCaseCsv('')).toThrow(BadRequestException);
    });

    it('should skip empty rows', () => {
      const csv = 'school_name,year,result\n\nMIT,2025,ADMITTED\n\n';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
    });

    it('should report error for missing required fields', () => {
      const csv =
        'school_name,year,result\n,2025,ADMITTED\nMIT,,ADMITTED\nMIT,2025,';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].field).toBe('school_name');
      expect(result.errors[1].field).toBe('year');
      expect(result.errors[2].field).toBe('result');
    });

    it('should validate year range', () => {
      const csv =
        'school_name,year,result\nMIT,1999,ADMITTED\nMIT,2101,ADMITTED';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('year');
    });

    it('should handle quoted fields with commas', () => {
      const csv =
        'school_name,year,result\n"University of California, Berkeley",2025,ADMITTED';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].schoolName).toContain('California');
    });

    it('should handle escaped quotes in fields', () => {
      const csv = 'school_name,year,result\n"He said ""hello""",2025,ADMITTED';
      const result = service.parseCaseCsv(csv);

      // School name won't resolve but should parse correctly
      expect(result.valid).toHaveLength(1);
    });

    it('should support Chinese headers', () => {
      const csv = '学校名称,申请年份,结果\nMIT,2025,录取';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].result).toBe('ADMITTED');
    });

    it('should normalize result values', () => {
      const csv =
        'school_name,year,result\nMIT,2025,admitted\nMIT,2025,rej\nMIT,2025,wl\nMIT,2025,deferred';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(4);
      expect(result.valid[0].result).toBe('ADMITTED');
      expect(result.valid[1].result).toBe('REJECTED');
      expect(result.valid[2].result).toBe('WAITLISTED');
      expect(result.valid[3].result).toBe('DEFERRED');
    });

    it('should reject unknown result values', () => {
      const csv = 'school_name,year,result\nMIT,2025,INVALID_RESULT';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('result');
      expect(result.errors[0].message).toContain('Invalid');
    });

    it('should parse optional academic fields', () => {
      const csv =
        'school_name,year,result,round,major,gpa,sat,act,toefl\nMIT,2025,ADMITTED,ED,CS,3.9,1550,35,115';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
      const entry = result.valid[0];
      expect(entry.round).toBe('ED');
      expect(entry.major).toBe('CS');
      expect(entry.gpa?.range).toBe('3.9');
      expect(entry.sat?.range).toBe('1550');
      expect(entry.act?.range).toBe('35');
      expect(entry.toefl?.range).toBe('115');
    });

    it('should parse semicolon-separated activities and awards', () => {
      const csv =
        'school_name,year,result,activities,awards\nMIT,2025,ADMITTED,"Research - Lab work;Debate - Captain","USAMO Qualifier;Intel ISEF"';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].activities).toBeDefined();
      expect(result.valid[0].activities!.length).toBeGreaterThan(0);
      expect(result.valid[0].awards).toBeDefined();
      expect(result.valid[0].awards!.length).toBeGreaterThan(0);
    });

    it('should handle CRLF line endings', () => {
      const csv =
        'school_name,year,result\r\nMIT,2025,ADMITTED\r\nStanford,2025,REJECTED';
      const result = service.parseCaseCsv(csv);

      expect(result.valid).toHaveLength(2);
    });

    it('should return totalRows count', () => {
      const csv =
        'school_name,year,result\nMIT,2025,ADMITTED\nStanford,2025,REJECTED';
      const result = service.parseCaseCsv(csv);

      expect(result.totalRows).toBe(2);
    });
  });
});
