import { BadRequestException } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { ForumUploadService } from './forum-upload.service';

describe('ForumUploadService', () => {
  let service: ForumUploadService;
  let storage: jest.Mocked<Pick<StorageService, 'uploadForumImage'>>;

  const imageFile = {
    buffer: Buffer.from('image'),
    mimetype: 'image/png',
    originalname: 'photo.png',
    size: 1024,
  } as Express.Multer.File;

  beforeEach(() => {
    storage = {
      uploadForumImage: jest.fn().mockResolvedValue({
        key: 'forum/user-1/image.png',
        url: 'http://localhost:4101/uploads/forum/user-1/image.png',
        provider: 'local',
      }),
    };
    service = new ForumUploadService(storage as StorageService);
  });

  it('uploads valid forum images', async () => {
    const result = await service.uploadImages('user-1', [imageFile]);

    expect(result).toEqual([
      expect.objectContaining({
        key: 'forum/user-1/image.png',
        mimeType: 'image/png',
        size: 1024,
      }),
    ]);
    expect(storage.uploadForumImage).toHaveBeenCalled();
  });

  it('rejects unsupported image types', async () => {
    await expect(
      service.uploadImages('user-1', [
        { ...imageFile, mimetype: 'application/pdf' },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects more than six images', async () => {
    await expect(
      service.uploadImages(
        'user-1',
        Array.from({ length: 7 }, () => imageFile),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
