import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { ForumImageInputDto } from './dto';

const FORUM_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FORUM_IMAGES = 6;
const MAX_FORUM_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ForumUploadService {
  constructor(private storageService: StorageService) {}

  async uploadImages(
    userId: string,
    files: Express.Multer.File[] = [],
  ): Promise<ForumImageInputDto[]> {
    if (!files.length) {
      throw new BadRequestException('No images uploaded');
    }
    if (files.length > MAX_FORUM_IMAGES) {
      throw new BadRequestException('A post can include up to 6 images');
    }

    return Promise.all(files.map((file) => this.uploadImage(userId, file)));
  }

  private async uploadImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ForumImageInputDto> {
    if (!FORUM_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported forum image type');
    }
    if (file.size > MAX_FORUM_IMAGE_BYTES) {
      throw new BadRequestException('Forum images must be 10MB or smaller');
    }

    const result = await this.storageService.uploadForumImage(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });

    return {
      key: result.key,
      url: result.url,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
