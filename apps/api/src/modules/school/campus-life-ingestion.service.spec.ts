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
    const bigFuture = {
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
      bigFuture as any,
    );

    const result = await service.ingest({ dryRun: true, limit: 1 });

    expect(result.tavily.scanned).toBe(1);
    expect(result.tavily.skipped).toBe(1);
    expect(appily.scrapeSchools).toHaveBeenCalledWith(1, undefined, {
      dryRun: true,
      onlyMissingCampusLife: true,
    });
    expect(bigFuture.scrapeSchools).toHaveBeenCalledWith(1, undefined, {
      dryRun: true,
      onlyMissingCampusLife: true,
    });
    expect(merger.merge).not.toHaveBeenCalled();
    expect(merger.markFieldsUnavailable).not.toHaveBeenCalled();
  });
});

describe('AppilyParser campus-life fields', () => {
  it('parses room, student orgs, countries, housing, meals, and safety services', () => {
    const parser = new AppilyParser('AppilyParserTest');
    const parsed = parser.parseSchoolData(
      '<html><body>Room and board: $18,200 Meal plan cost: $6,400 430 student organizations 82 countries represented Students living on campus: 76% Freshmen are required to live on campus. 24-hour security patrol and campus police.</body></html>',
      { id: 'school-1', name: 'Example University' },
    );

    expect(parsed?.data).toEqual(
      expect.objectContaining({
        roomAndBoard: 18200,
        mealPlanCost: 6400,
        studentOrgsCount: 430,
        countriesRepresented: 82,
        percentLivingOnCampus: 76,
        housingAvailable: true,
        housingRequiredYears: 1,
        campusSafetyServices: [
          '24-hour security patrol',
          'campus police/public safety office',
        ],
      }),
    );
  });
});
