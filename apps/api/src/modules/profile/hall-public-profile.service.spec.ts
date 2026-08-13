import { Prisma } from '@prisma/client';
import { HallPublicProfileService } from './hall-public-profile.service';

describe('HallPublicProfileService', () => {
  it('does not write a public snapshot when the user has no profile', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-1', profile: null }),
        update: jest.fn(),
      },
    };
    const service = new HallPublicProfileService(prisma as any);
    await expect(service.rebuildSnapshot('user-1')).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears the desensitized snapshot with Prisma JsonNull', async () => {
    const prisma = { user: { update: jest.fn().mockResolvedValue({}) } };
    const service = new HallPublicProfileService(prisma as any);
    await service.clearSnapshot('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { hallPublicProfile: Prisma.JsonNull },
    });
  });
});
