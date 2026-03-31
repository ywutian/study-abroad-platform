import { Test, TestingModule } from '@nestjs/testing';
import { PredictionCacheService } from './prediction-cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionResultDto } from './dto';

describe('PredictionCacheService', () => {
  let service: PredictionCacheService;
  let redis: RedisService;

  const mockResult: PredictionResultDto = {
    schoolId: 'school-1',
    schoolName: 'MIT',
    probability: 0.45,
    probabilityLow: 0.35,
    probabilityHigh: 0.55,
    confidence: 'medium',
    tier: 'reach',
    factors: [
      {
        name: 'GPA',
        impact: 'positive',
        weight: 0.3,
        detail: 'GPA 3.85 is competitive',
      },
    ],
    suggestions: ['Consider research'],
    comparison: {
      gpaPercentile: 85,
      testScorePercentile: 80,
      activityStrength: 'strong',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionCacheService,
        {
          provide: RedisService,
          useValue: {
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<PredictionCacheService>(PredictionCacheService);
    redis = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCacheKey', () => {
    it('should build cache key in correct format', () => {
      const key = service.getCacheKey('profile-1', 'school-1');
      expect(key).toBe('prediction:profile-1:school-1');
    });

    it('should produce unique keys for different profiles', () => {
      const key1 = service.getCacheKey('profile-1', 'school-1');
      const key2 = service.getCacheKey('profile-2', 'school-1');
      expect(key1).not.toBe(key2);
    });

    it('should produce unique keys for different schools', () => {
      const key1 = service.getCacheKey('profile-1', 'school-1');
      const key2 = service.getCacheKey('profile-1', 'school-2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashProfileData', () => {
    it('should return a string hash', () => {
      const hash = service.hashProfileData({
        gpa: 3.85,
        gpaScale: 4,
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [{}],
        awards: [{ level: 'NATIONAL' }],
      });

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should return different hashes for different profiles', () => {
      const hash1 = service.hashProfileData({
        gpa: 3.85,
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [],
      });

      const hash2 = service.hashProfileData({
        gpa: 3.5,
        testScores: [{ type: 'SAT', score: 1400 }],
        activities: [],
        awards: [],
      });

      expect(hash1).not.toBe(hash2);
    });

    it('should return same hash for identical profiles', () => {
      const profile = {
        gpa: 3.85,
        gpaScale: 4,
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [{ level: 'NATIONAL' }],
      };

      const hash1 = service.hashProfileData(profile);
      const hash2 = service.hashProfileData(profile);

      expect(hash1).toBe(hash2);
    });

    it('should handle empty/undefined fields gracefully', () => {
      const hash = service.hashProfileData({
        gpa: undefined,
        gpaScale: undefined,
        testScores: [],
        activities: [],
        awards: [],
      });

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle missing education field', () => {
      const hash = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [],
      });

      expect(typeof hash).toBe('string');
    });

    it('should include high school info in hash when present', () => {
      const hashWithoutHs = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [],
      });

      const hashWithHs = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [],
        education: [
          {
            schoolType: 'HIGH_SCHOOL',
            highSchoolId: 'hs-1',
            highSchool: { tier: 4 },
          },
        ],
      });

      expect(hashWithoutHs).not.toBe(hashWithHs);
    });

    it('should ignore non-high-school education entries', () => {
      const hashNoEdu = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [],
      });

      const hashWithCollege = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [],
        education: [
          {
            schoolType: 'COLLEGE',
            highSchoolId: null,
            highSchool: null,
          },
        ],
      });

      expect(hashNoEdu).toBe(hashWithCollege);
    });

    it('should sort award levels for consistent hashing', () => {
      const hash1 = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [{ level: 'NATIONAL' }, { level: 'STATE' }],
      });

      const hash2 = service.hashProfileData({
        gpa: 3.5,
        testScores: [],
        activities: [],
        awards: [{ level: 'STATE' }, { level: 'NATIONAL' }],
      });

      expect(hash1).toBe(hash2);
    });
  });

  describe('getFromCache', () => {
    it('should return null on cache miss', async () => {
      (redis.getJSON as jest.Mock).mockResolvedValue(null);

      const result = await service.getFromCache('profile-1', 'school-1');

      expect(result).toBeNull();
      expect(redis.getJSON).toHaveBeenCalledWith(
        'prediction:profile-1:school-1',
      );
    });

    it('should return cached result with fromCache flag on hit', async () => {
      const cachedData = {
        ...mockResult,
        cachedAt: '2026-03-30T10:00:00Z',
        _profileHash: 'abc123',
      };
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const result = await service.getFromCache('profile-1', 'school-1');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
      expect(result!.cachedAt).toBe('2026-03-30T10:00:00Z');
      // _profileHash should be stripped from the result
      expect((result as any)._profileHash).toBeUndefined();
    });

    it('should return null when profileHash does not match (stale cache)', async () => {
      const cachedData = {
        ...mockResult,
        _profileHash: 'old-hash',
      };
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const result = await service.getFromCache(
        'profile-1',
        'school-1',
        'new-hash',
      );

      expect(result).toBeNull();
    });

    it('should return cached result when profileHash matches', async () => {
      const cachedData = {
        ...mockResult,
        _profileHash: 'matching-hash',
        cachedAt: '2026-03-30T10:00:00Z',
      };
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const result = await service.getFromCache(
        'profile-1',
        'school-1',
        'matching-hash',
      );

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
    });

    it('should return cached result when no profileHash is provided for validation', async () => {
      const cachedData = {
        ...mockResult,
        _profileHash: 'some-hash',
        cachedAt: '2026-03-30T10:00:00Z',
      };
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const result = await service.getFromCache('profile-1', 'school-1');

      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
    });

    it('should return cached result when cached entry has no _profileHash', async () => {
      const cachedData = {
        ...mockResult,
        cachedAt: '2026-03-30T10:00:00Z',
      };
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedData);

      const result = await service.getFromCache(
        'profile-1',
        'school-1',
        'some-hash',
      );

      // When cached._profileHash is falsy, hash check is skipped
      expect(result).toBeDefined();
      expect(result!.fromCache).toBe(true);
    });

    it('should return null and log warning when Redis throws', async () => {
      (redis.getJSON as jest.Mock).mockRejectedValue(
        new Error('Redis connection refused'),
      );

      const result = await service.getFromCache('profile-1', 'school-1');

      expect(result).toBeNull();
    });
  });

  describe('saveToCache', () => {
    it('should store result in Redis with TTL', async () => {
      await service.saveToCache('profile-1', 'school-1', mockResult);

      expect(redis.setJSON).toHaveBeenCalledWith(
        'prediction:profile-1:school-1',
        expect.objectContaining({
          ...mockResult,
          cachedAt: expect.any(String),
        }),
        86400,
      );
    });

    it('should include profileHash in stored value when provided', async () => {
      await service.saveToCache('profile-1', 'school-1', mockResult, 'my-hash');

      expect(redis.setJSON).toHaveBeenCalledWith(
        'prediction:profile-1:school-1',
        expect.objectContaining({
          _profileHash: 'my-hash',
        }),
        86400,
      );
    });

    it('should store undefined profileHash when not provided', async () => {
      await service.saveToCache('profile-1', 'school-1', mockResult);

      expect(redis.setJSON).toHaveBeenCalledWith(
        'prediction:profile-1:school-1',
        expect.objectContaining({
          _profileHash: undefined,
        }),
        86400,
      );
    });

    it('should not throw when Redis write fails (graceful degradation)', async () => {
      (redis.setJSON as jest.Mock).mockRejectedValue(new Error('Redis OOM'));

      await expect(
        service.saveToCache('profile-1', 'school-1', mockResult),
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete cache keys for all specified schools', async () => {
      await service.invalidateUserCache('profile-1', [
        'school-1',
        'school-2',
        'school-3',
      ]);

      expect(redis.del).toHaveBeenCalledTimes(3);
      expect(redis.del).toHaveBeenCalledWith('prediction:profile-1:school-1');
      expect(redis.del).toHaveBeenCalledWith('prediction:profile-1:school-2');
      expect(redis.del).toHaveBeenCalledWith('prediction:profile-1:school-3');
    });

    it('should handle empty schoolIds array', async () => {
      await service.invalidateUserCache('profile-1', []);

      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should not throw when Redis deletion fails (graceful degradation)', async () => {
      (redis.del as jest.Mock).mockRejectedValue(new Error('Redis timeout'));

      await expect(
        service.invalidateUserCache('profile-1', ['school-1']),
      ).resolves.not.toThrow();
    });
  });
});
