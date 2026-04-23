import { SchoolMatcherService } from './school-matcher.service';

describe('SchoolMatcherService', () => {
  const prisma = {
    school: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'mit',
          name: 'Massachusetts Institute of Technology',
          nameNorm: 'massachusetts institute of technology',
        },
        {
          id: 'ucla',
          name: 'University of California, Los Angeles',
          nameNorm: 'university of california los angeles',
        },
        {
          id: 'ucb',
          name: 'University of California, Berkeley',
          nameNorm: 'university of california berkeley',
        },
      ]),
    },
  };

  let service: SchoolMatcherService;

  beforeEach(() => {
    service = new SchoolMatcherService(prisma as never);
  });

  it('matches by explicit schoolId first', async () => {
    const index = await service.loadSchoolIndex();
    const result = service.matchSchool(
      { schoolId: 'mit', schoolName: 'Anything Else' },
      index,
    );

    expect(result).toEqual({
      kind: 'ok',
      school: expect.objectContaining({ id: 'mit' }),
      matchType: 'id',
    });
  });

  it('matches common aliases', async () => {
    const index = await service.loadSchoolIndex();
    const result = service.matchSchool({ schoolName: 'MIT' }, index);

    expect(result).toEqual({
      kind: 'ok',
      school: expect.objectContaining({ id: 'mit' }),
      matchType: 'alias',
    });
  });

  it('returns ambiguous when substring matches multiple schools', async () => {
    const index = await service.loadSchoolIndex();
    const result = service.matchSchool(
      { schoolName: 'University of California' },
      index,
    );

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('suggests close matches for unmatched input', async () => {
    const index = await service.loadSchoolIndex();
    const suggestions = service.suggestSchools('Massachusetts Tech', index, 2);

    expect(suggestions[0]?.id).toBe('mit');
  });
});
