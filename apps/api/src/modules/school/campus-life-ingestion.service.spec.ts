import {
  CampusLifeIngestionService,
  extractNicheCampusGradesFromTavilyResults,
  loadTavilyKeys,
} from './campus-life-ingestion.service';
import { AppilyParser } from './scrapers/appily.scraper';

describe('CampusLifeIngestionService', () => {
  it('extracts Niche campus grades from Tavily indexed snippets', () => {
    const result = extractNicheCampusGradesFromTavilyResults([
      {
        url: 'https://www.niche.com/colleges/example-university/',
        content:
          'Overall Grade A+. Crime & Safety grade A-. Student Life grade B+. Campus Food grade B.',
      },
    ]);

    expect(result).toEqual({
      nicheOverallGrade: 'A+',
      nicheSafetyGrade: 'A-',
      nicheLifeGrade: 'B+',
      nicheFoodGrade: 'B',
    });
  });

  it('loads Tavily key rotation from env', () => {
    expect(
      loadTavilyKeys({
        TAVILY_API_KEY: 'primary',
        TAVILY_API_KEY_1: 'primary',
        TAVILY_API_KEY_2: 'secondary',
      }),
    ).toEqual(['primary', 'secondary']);
  });

  it('dry-runs without writing Tavily results', async () => {
    const prisma = {
      school: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'school-1',
            name: 'Example University',
            metadata: {},
            nicheOverallGrade: null,
            nicheSafetyGrade: null,
            nicheLifeGrade: null,
            nicheFoodGrade: null,
          },
        ]),
      },
    };
    const merger = {
      merge: jest.fn(),
      markFieldsUnavailable: jest.fn(),
    };
    const appily = {
      scrapeSchools: jest.fn().mockResolvedValue({
        scraped: 1,
        updated: 1,
        failed: 0,
        skipped: 0,
        dryRun: true,
      }),
    };
    const service = new CampusLifeIngestionService(
      prisma as any,
      merger as any,
      appily as any,
    );

    const result = await service.ingest({ dryRun: true, limit: 1 });

    expect(result.tavily.scanned).toBe(1);
    expect(result.tavily.skipped).toBe(1);
    expect(appily.scrapeSchools).toHaveBeenCalledWith(1, undefined, {
      dryRun: true,
      onlyMissingCampusLife: true,
    });
    expect(merger.merge).not.toHaveBeenCalled();
    expect(merger.markFieldsUnavailable).not.toHaveBeenCalled();
  });
});

describe('AppilyParser campus-life fields', () => {
  it('parses room and board, student orgs, and countries represented', () => {
    const parser = new AppilyParser('AppilyParserTest');
    const parsed = parser.parseSchoolData(
      '<html><body>Room and board: $18,200 430 student organizations 82 countries represented</body></html>',
      { id: 'school-1', name: 'Example University' },
    );

    expect(parsed?.data).toEqual(
      expect.objectContaining({
        roomAndBoard: 18200,
        studentOrgsCount: 430,
        countriesRepresented: 82,
      }),
    );
  });
});
