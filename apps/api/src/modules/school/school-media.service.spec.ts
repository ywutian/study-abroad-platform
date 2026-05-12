import {
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import { SchoolMediaService } from './school-media.service';

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer[0] = 0x89;
  buffer.write('PNG', 1, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function response(
  overrides: Partial<Response> & { body?: string | Buffer },
): Response {
  const body = overrides.body;
  return {
    ok: true,
    status: 200,
    url: 'https://www.example.edu/',
    headers: {
      get: jest.fn().mockReturnValue('text/html'),
    } as any,
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : ''),
    json: jest.fn().mockResolvedValue({}),
    arrayBuffer: jest
      .fn()
      .mockResolvedValue(
        body instanceof Buffer
          ? body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength,
            )
          : new ArrayBuffer(0),
      ),
    ...overrides,
  } as Response;
}

describe('SchoolMediaService', () => {
  const makeService = (options: { nodeEnv?: string } = {}) => {
    const prisma = {
      school: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'school-1',
            name: 'Example University',
            website: 'https://www.example.edu',
            mediaAssets: [],
          },
        ]),
      },
      schoolMediaAsset: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(async ({ data }) => ({ id: 'asset-1', ...data })),
      },
      $transaction: jest.fn(async (callbackOrQueries) => {
        if (typeof callbackOrQueries === 'function') {
          return callbackOrQueries({
            schoolMediaAsset: prisma.schoolMediaAsset,
          });
        }
        return Promise.all(callbackOrQueries);
      }),
    } as any;
    const storage = {
      getStorageType: jest.fn().mockReturnValue('local'),
      uploadSchoolMedia: jest.fn().mockResolvedValue({
        url: 'https://cdn.lumniedu.com/schools/school-1/campus.png',
      }),
    } as any;
    const service = new SchoolMediaService(
      {
        get: jest.fn((key: string) =>
          key === 'NODE_ENV' ? (options.nodeEnv ?? 'test') : 'test',
        ),
      } as any,
      prisma,
      storage,
      { invalidateSchoolCaches: jest.fn() } as any,
      { log: jest.fn() } as any,
    );
    return { service, prisma, storage };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts a relative official og:image and approves it when storage is publishable', async () => {
    const { service, prisma, storage } = makeService();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        response({
          url: 'https://www.example.edu/',
          body: '<meta property="og:image" content="/assets/campus.png">',
        }),
      )
      .mockResolvedValueOnce(
        response({
          body: pngHeader(1200, 630),
          headers: { get: jest.fn().mockReturnValue('image/png') } as any,
        }),
      );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'official',
      dryRun: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.example.edu/assets/campus.png',
      expect.any(Object),
    );
    expect(storage.uploadSchoolMedia).toHaveBeenCalledWith(
      'school-1',
      SchoolMediaType.CAMPUS_COVER,
      expect.objectContaining({ mimetype: 'image/png' }),
    );
    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SchoolMediaStatus.APPROVED,
          sourceType: SchoolMediaSourceType.OFFICIAL_WEBSITE,
          isPrimary: true,
          width: 1200,
          height: 630,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('rejects non-https official media and records a failed candidate without throwing', async () => {
    const { service, prisma } = makeService();
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        url: 'https://www.example.edu/',
        body: '<meta property="og:image" content="http://www.example.edu/campus.jpg">',
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'official',
      dryRun: false,
    });

    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SchoolMediaStatus.FAILED,
          failureReason: expect.stringContaining('Image URL must be HTTPS'),
        }),
      }),
    );
    expect(result.failed).toBe(1);
  });

  it('auto-approves auditable Wikimedia media before official media when production storage is local', async () => {
    const { service, prisma, storage } = makeService({ nodeEnv: 'production' });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/example-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Example.jpg',
                    mime: 'image/jpeg',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'official,wikimedia',
      dryRun: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('commons.wikimedia.org/w/api.php'),
      expect.any(Object),
    );
    expect(storage.uploadSchoolMedia).not.toHaveBeenCalled();
    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SchoolMediaStatus.APPROVED,
          sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
          isPrimary: true,
          originalUrl: 'https://upload.wikimedia.org/example-campus.jpg',
          sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
          storageUrl: undefined,
          failureReason: null,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('skips Wikimedia files that browsers cannot render directly', async () => {
    const { service, prisma } = makeService({ nodeEnv: 'production' });
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                title: 'File:Example campus guide.pdf',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/example-campus.pdf',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Example_campus_guide.pdf',
                    mime: 'application/pdf',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'Public domain' },
                      Artist: { value: 'Archive' },
                    },
                  },
                ],
              },
              '2': {
                title: 'File:Example campus.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/example-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Example_campus.jpg',
                    mime: 'image/jpeg',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'wikimedia',
      dryRun: false,
    });

    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalUrl: 'https://upload.wikimedia.org/example-campus.jpg',
          status: SchoolMediaStatus.APPROVED,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('prefers campus/building Wikimedia images over non-cover matches', async () => {
    const { service, prisma } = makeService({ nodeEnv: 'production' });
    prisma.school.findMany.mockResolvedValueOnce([
      {
        id: 'school-1',
        name: 'Duke University',
        aliases: [],
        website: 'https://duke.edu',
        mediaAssets: [],
      },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                title: 'File:2008-07-24 Duke University sanitation truck.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/duke-truck.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:2008-07-24_Duke_University_sanitation_truck.jpg',
                    mime: 'image/jpeg',
                    width: 3888,
                    height: 2592,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
              '2': {
                title: 'File:Duke University Chapel side in July 2025.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/duke-chapel.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Duke_University_Chapel_side_in_July_2025.jpg',
                    mime: 'image/jpeg',
                    width: 4080,
                    height: 3072,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'wikimedia',
      dryRun: false,
    });

    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalUrl: 'https://upload.wikimedia.org/duke-chapel.jpg',
          status: SchoolMediaStatus.APPROVED,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('matches common school aliases such as Caltech', async () => {
    const { service, prisma } = makeService({ nodeEnv: 'production' });
    prisma.school.findMany.mockResolvedValueOnce([
      {
        id: 'school-1',
        name: 'California Institute of Technology',
        aliases: [],
        website: 'https://caltech.edu',
        mediaAssets: [],
      },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                title: 'File:Caltech Campus.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/caltech-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Caltech_Campus.jpg',
                    mime: 'image/jpeg',
                    width: 4032,
                    height: 3024,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'wikimedia',
      dryRun: false,
    });

    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalUrl: 'https://upload.wikimedia.org/caltech-campus.jpg',
          status: SchoolMediaStatus.APPROVED,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('skips Wikimedia results that do not match the school name', async () => {
    const { service, prisma } = makeService({ nodeEnv: 'production' });
    prisma.school.findMany.mockResolvedValueOnce([
      {
        id: 'school-1',
        name: 'Wellesley College',
        website: 'https://www.wellesley.edu',
        mediaAssets: [],
      },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                title: 'File:Campus view, Babson College.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/babson-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Campus_view,_Babson_College.jpg',
                    mime: 'image/jpeg',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'Public domain' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
              '2': {
                title: 'File:Wellesley College campus.jpg',
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/wellesley-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Wellesley_College_campus.jpg',
                    mime: 'image/jpeg',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Wellesley Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'wikimedia',
      dryRun: false,
    });

    expect(prisma.schoolMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalUrl: 'https://upload.wikimedia.org/wellesley-campus.jpg',
          sourcePageUrl:
            'https://commons.wikimedia.org/wiki/File:Wellesley_College_campus.jpg',
          status: SchoolMediaStatus.APPROVED,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('promotes an existing pending Wikimedia candidate when production storage is local', async () => {
    const { service, prisma, storage } = makeService({ nodeEnv: 'production' });
    prisma.schoolMediaAsset.findFirst.mockResolvedValueOnce({
      id: 'asset-existing-wiki',
      schoolId: 'school-1',
      type: SchoolMediaType.CAMPUS_COVER,
      status: SchoolMediaStatus.PENDING_REVIEW,
      sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
      storageUrl: null,
      originalUrl: 'https://upload.wikimedia.org/example-campus.jpg',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Old.jpg',
      width: 1200,
      height: 800,
      hash: null,
    });
    prisma.schoolMediaAsset.findUnique.mockResolvedValue({
      id: 'asset-existing-wiki',
      schoolId: 'school-1',
      type: SchoolMediaType.CAMPUS_COVER,
      status: SchoolMediaStatus.APPROVED,
      sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
      storageUrl: null,
      originalUrl: 'https://upload.wikimedia.org/example-campus.jpg',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      width: 1200,
      height: 800,
      hash: null,
      isPrimary: true,
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        json: jest.fn().mockResolvedValue({
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    url: 'https://upload.wikimedia.org/example-campus.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Example.jpg',
                    mime: 'image/jpeg',
                    width: 1200,
                    height: 800,
                    extmetadata: {
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      Artist: { value: 'Example Photographer' },
                    },
                  },
                ],
              },
            },
          },
        }),
      }),
    );

    const result = await service.discoverMedia({
      limit: 1,
      source: 'wikimedia',
      dryRun: false,
    });

    expect(storage.uploadSchoolMedia).not.toHaveBeenCalled();
    expect(prisma.schoolMediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-existing-wiki' },
        data: expect.objectContaining({
          status: SchoolMediaStatus.APPROVED,
          storageUrl: null,
          originalUrl: 'https://upload.wikimedia.org/example-campus.jpg',
          sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
          isPrimary: true,
          failureReason: null,
        }),
      }),
    );
    expect(result.approved).toBe(1);
  });

  it('approves Wikimedia media by using the audited original URL when production storage is local', async () => {
    const { service, prisma, storage } = makeService({ nodeEnv: 'production' });
    prisma.schoolMediaAsset.findUnique.mockResolvedValue({
      id: 'asset-wiki',
      schoolId: 'school-1',
      type: SchoolMediaType.CAMPUS_COVER,
      status: SchoolMediaStatus.PENDING_REVIEW,
      sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
      storageUrl: null,
      originalUrl: 'https://upload.wikimedia.org/example-campus.png',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Example.png',
      width: 1200,
      height: 800,
      hash: null,
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({
        body: pngHeader(1200, 800),
        headers: { get: jest.fn().mockReturnValue('image/png') } as any,
      }),
    );

    await service.approveAsset('asset-wiki', 'admin-1');

    expect(storage.uploadSchoolMedia).not.toHaveBeenCalled();
    expect(prisma.schoolMediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-wiki' },
        data: expect.objectContaining({
          status: SchoolMediaStatus.APPROVED,
          storageUrl: null,
          isPrimary: true,
          width: 1200,
          height: 800,
        }),
      }),
    );
  });

  it('still blocks official website media approval in production when public storage is not configured', async () => {
    const { service, storage, prisma } = makeService({ nodeEnv: 'production' });
    prisma.schoolMediaAsset.findUnique.mockResolvedValue({
      id: 'asset-official',
      schoolId: 'school-1',
      type: SchoolMediaType.CAMPUS_COVER,
      status: SchoolMediaStatus.CANDIDATE,
      sourceType: SchoolMediaSourceType.OFFICIAL_WEBSITE,
      storageUrl: null,
      originalUrl: 'https://www.example.edu/campus.png',
      sourcePageUrl: 'https://www.example.edu/',
      width: 1200,
      height: 800,
      hash: null,
    });

    await expect(
      service.approveAsset('asset-official', 'admin-1'),
    ).rejects.toThrow('Public media storage is not configured for production');

    expect(storage.uploadSchoolMedia).not.toHaveBeenCalled();
  });
});
