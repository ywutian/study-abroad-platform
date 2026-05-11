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
  const makeService = () => {
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
      { get: jest.fn().mockReturnValue('test') } as any,
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
});
