import { ProfileBankService } from './profile-bank.service';

describe('ProfileBankService', () => {
  const service = new ProfileBankService({} as never);

  it('generates deterministic profiles for a fixed seed', () => {
    const first = service.generateProfiles({
      count: 5,
      seed: 123,
      cohortTag: 'distill-corpus-v1',
    });
    const second = service.generateProfiles({
      count: 5,
      seed: 123,
      cohortTag: 'distill-corpus-v1',
    });

    expect(first).toEqual(second);
  });

  it('assigns labels, cohort tag, and mixed test regimes', () => {
    const profiles = service.generateProfiles({
      count: 12,
      seed: 20260422,
      cohortTag: 'distill-corpus-v1',
    });

    expect(profiles[0]?.label).toBe('distill-001');
    expect(profiles[11]?.label).toBe('distill-012');
    expect(
      profiles.every((profile) => profile.cohortTag === 'distill-corpus-v1'),
    ).toBe(true);

    const regimes = new Set(
      profiles.map((profile) => {
        const score = profile.profileJson.testScores.find(
          (item) => item.type === 'SAT' || item.type === 'ACT',
        );
        return score?.type ?? 'TEST_OPTIONAL';
      }),
    );

    expect(regimes).toEqual(new Set(['SAT', 'ACT', 'TEST_OPTIONAL']));
  });

  it('keeps GPA and nationality distributions bounded for a 200-profile corpus', () => {
    const profiles = service.generateProfiles({
      count: 200,
      seed: 20260422,
      cohortTag: 'distill-corpus-v1',
    });

    const gpaBucketCounts = new Map<string, number>();
    const nationalityCounts = new Map<string, number>();

    for (const profile of profiles) {
      const gpa = profile.profileJson.gpa ?? 0;
      const bucketStart = Math.floor((gpa - 2.5) / 0.3) * 0.3 + 2.5;
      const bucketLabel = `${bucketStart.toFixed(1)}-${(bucketStart + 0.3).toFixed(1)}`;
      gpaBucketCounts.set(
        bucketLabel,
        (gpaBucketCounts.get(bucketLabel) ?? 0) + 1,
      );

      const nationality = profile.profileJson.nationality ?? 'UNKNOWN';
      nationalityCounts.set(
        nationality,
        (nationalityCounts.get(nationality) ?? 0) + 1,
      );
    }

    expect(Math.max(...gpaBucketCounts.values())).toBeLessThanOrEqual(40);
    expect(
      Array.from(nationalityCounts.values()).sort((a, b) => a - b),
    ).toEqual([40, 40, 40, 40, 40]);
  });
});
