import { teamRoutes } from '@study-abroad/shared';

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';
import { teamService } from '@/lib/api/services/team';

describe('mobile teamService compatibility contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests official recruitment contexts with the canonical query params', async () => {
    await teamService.getRecruitmentContextsBySourceTypeAndCompetitionId({
      sourceType: 'OFFICIAL',
      competitionId: 'comp-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      teamRoutes.recruitmentContextsBySourceTypeAndCompetitionId({
        sourceType: 'OFFICIAL',
        competitionId: 'comp-1',
      })
    );
  });

  it('loads private community contexts and public match pools from the new endpoints', async () => {
    await teamService.getCommunityContexts();
    await teamService.getMatchPools();

    expect(apiClient.get).toHaveBeenNthCalledWith(1, teamRoutes.communityContexts());
    expect(apiClient.get).toHaveBeenNthCalledWith(2, teamRoutes.matchPools());
  });

  it('preserves recruitmentContextId when creating and updating recruitment cards', async () => {
    const createPayload = {
      recruitmentContextId: 'ctx-1',
      competitionTrackId: 'ctx-1',
      headline: 'Need a presenter',
    };
    const updatePayload = {
      recruitmentContextId: 'ctx-2',
      competitionTrackId: 'ctx-2',
      headline: 'Updated headline',
    };

    await teamService.createRecruitment(createPayload);
    await teamService.updateRecruitment('card-1', updatePayload);

    expect(apiClient.post).toHaveBeenCalledWith(teamRoutes.recruitments(), createPayload);
    expect(apiClient.patch).toHaveBeenCalledWith(
      teamRoutes.recruitmentById('card-1'),
      updatePayload
    );
  });
});
