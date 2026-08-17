import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadResult {
  key: string;
  url: string;
  provider: string;
}

export interface StorageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

type SchoolMediaKind = 'LOGO' | 'CAMPUS_COVER';

/** Object-key prefixes owned by a user, not by a school or the platform. */
export const USER_OBJECT_KEY_PREFIXES = [
  'verification/',
  'outcome-evidence/',
  'forum/',
] as const;

/**
 * Turn a stored URL or key into an owned object key, or null if it is not
 * ours (external avatars, dicebear, empty). Used by account purge so we
 * never `deleteFile` a third-party URL.
 */
export function extractOwnedObjectKey(
  ref: string | null | undefined,
): string | null {
  if (!ref) return null;
  const trimmed = ref.trim().split(/[?#]/)[0];
  if (!trimmed || trimmed.includes('..')) return null;
  for (const prefix of USER_OBJECT_KEY_PREFIXES) {
    const idx = trimmed.indexOf(prefix);
    if (idx >= 0) {
      const key = trimmed.slice(idx);
      return key.includes('..') ? null : key;
    }
  }
  return null;
}

/**
 * 存储后端类型
 *
 * - local: 本地文件系统（默认，适合开发/小规模部署）
 * - s3: AWS S3 或兼容存储（MinIO、阿里云 OSS S3 兼容模式等）
 * - oss: 阿里云 OSS（需安装 ali-oss）
 * - cos: 腾讯云 COS（需安装 cos-nodejs-sdk-v5）
 *
 * 配置方式：设置 STORAGE_TYPE 环境变量
 */
type StorageProvider = 'local' | 's3' | 'oss' | 'cos';

/**
 * 通用存储服务
 *
 * 当前实现：本地存储（开发环境友好）
 *
 * 扩展云存储时，根据选择的云服务商：
 * 1. 安装对应 SDK
 * 2. 配置相应环境变量
 * 3. 设置 STORAGE_TYPE
 *
 * 示例环境变量：
 * ```
 * # 本地存储（默认）
 * STORAGE_TYPE=local
 * STORAGE_LOCAL_PATH=./uploads
 *
 * # 阿里云 OSS
 * STORAGE_TYPE=oss
 * OSS_REGION=oss-cn-hangzhou
 * OSS_ACCESS_KEY_ID=xxx
 * OSS_ACCESS_KEY_SECRET=xxx
 * OSS_BUCKET=your-bucket
 *
 * # 腾讯云 COS
 * STORAGE_TYPE=cos
 * COS_SECRET_ID=xxx
 * COS_SECRET_KEY=xxx
 * COS_BUCKET=your-bucket
 * COS_REGION=ap-guangzhou
 *
 * # AWS S3 / MinIO
 * STORAGE_TYPE=s3
 * AWS_REGION=us-east-1
 * AWS_ACCESS_KEY_ID=xxx
 * AWS_SECRET_ACCESS_KEY=xxx
 * AWS_S3_BUCKET=your-bucket
 * AWS_S3_ENDPOINT=  # MinIO 需要设置
 * ```
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: StorageProvider;
  private readonly localBasePath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.storageType = this.configService.get('STORAGE_TYPE') || 'local';
    this.localBasePath =
      this.configService.get('STORAGE_LOCAL_PATH') || './uploads';
    this.baseUrl = this.configService.get('APP_URL') || 'http://localhost:4101';
  }

  async onModuleInit() {
    if (this.storageType === 'local') {
      try {
        await fs.mkdir(this.localBasePath, { recursive: true });
        await fs.mkdir(path.join(this.localBasePath, 'verification'), {
          recursive: true,
        });
        this.logger.log(`Local storage initialized: ${this.localBasePath}`);
      } catch (error) {
        this.logger.error('Failed to create local storage directory', error);
      }
    } else {
      // Validate cloud storage credentials at startup
      if (!this.isCloudStorageConfigured()) {
        throw new InternalServerErrorException(
          `Storage type "${this.storageType}" selected but required credentials are missing. ` +
            'Check environment variables for your storage provider.',
        );
      }
      this.logger.log(`Storage type: ${this.storageType}`);
    }
  }

  /**
   * 上传验证材料
   */
  async uploadVerificationFile(
    userId: string,
    file: StorageFile,
  ): Promise<UploadResult> {
    const fileExt = this.extFromMime(file.mimetype);
    const fileHash = crypto.randomBytes(16).toString('hex');
    const key = `verification/${userId}/${fileHash}${fileExt}`;

    switch (this.storageType) {
      case 'local':
        return this.uploadLocal(key, file.buffer);
      case 's3':
        return this.uploadS3(key, file.buffer, file.mimetype);
      case 'oss':
        return this.uploadOSS(key, file.buffer);
      case 'cos':
        return this.uploadCOS(key, file.buffer);
      default:
        return this.uploadLocal(key, file.buffer);
    }
  }

  /**
   * Upload an outcome evidence document (acceptance letter / portal screenshot).
   * Per M6.6: enables document_verified outcome tier in the prediction system.
   */
  async uploadOutcomeEvidence(
    userId: string,
    file: StorageFile,
  ): Promise<UploadResult> {
    const fileExt = this.extFromMime(file.mimetype);
    const fileHash = crypto.randomBytes(16).toString('hex');
    const key = `outcome-evidence/${userId}/${fileHash}${fileExt}`;

    switch (this.storageType) {
      case 'local':
        return this.uploadLocal(key, file.buffer);
      case 's3':
        return this.uploadS3(key, file.buffer, file.mimetype);
      case 'oss':
        return this.uploadOSS(key, file.buffer);
      case 'cos':
        return this.uploadCOS(key, file.buffer);
      default:
        return this.uploadLocal(key, file.buffer);
    }
  }

  /**
   * Upload a forum image attachment.
   */
  async uploadForumImage(
    userId: string,
    file: StorageFile,
  ): Promise<UploadResult> {
    const fileExt = this.extFromMime(file.mimetype);
    const fileHash = crypto.randomBytes(16).toString('hex');
    const key = `forum/${userId}/${fileHash}${fileExt}`;

    switch (this.storageType) {
      case 'local':
        return this.uploadLocal(key, file.buffer);
      case 's3':
        return this.uploadS3(key, file.buffer, file.mimetype);
      case 'oss':
        return this.uploadOSS(key, file.buffer);
      case 'cos':
        return this.uploadCOS(key, file.buffer);
      default:
        return this.uploadLocal(key, file.buffer);
    }
  }

  /**
   * Upload an approved/candidate school media asset.
   */
  async uploadSchoolMedia(
    schoolId: string,
    type: SchoolMediaKind,
    file: StorageFile & { hash?: string },
  ): Promise<UploadResult> {
    const fileExt = this.extFromMime(file.mimetype);
    const fileHash = file.hash || crypto.randomBytes(16).toString('hex');
    const key = `schools/${schoolId}/${type.toLowerCase()}/${fileHash}${fileExt}`;

    switch (this.storageType) {
      case 'local':
        return this.uploadLocal(key, file.buffer);
      case 's3':
        return this.uploadS3(key, file.buffer, file.mimetype);
      case 'oss':
        return this.uploadOSS(key, file.buffer);
      case 'cos':
        return this.uploadCOS(key, file.buffer);
      default:
        return this.uploadLocal(key, file.buffer);
    }
  }

  /**
   * The stored extension is derived from the VALIDATED mime type, never from
   * the uploaded filename.
   *
   * Every upload path already allowlists `file.mimetype` (forum images,
   * outcome evidence, chat attachments) — but the key used to be built from
   * `path.extname(file.originalname)`, which the client also controls and
   * which wins over this map. Sending `Content-Type: image/png` with
   * `filename="x.html"` passed every allowlist and stored `<hash>.html`.
   * With STORAGE_TYPE defaulting to 'local' — and the production Cloud Run
   * deploy not setting it — that file is then served by express.static from
   * the API's own origin as text/html.
   *
   * Unknown types fall back to `.bin` rather than throwing: it keeps any
   * upload path not enumerated here working, and octet-stream downloads
   * instead of rendering. What must never happen is an attacker-chosen
   * extension, and this map is the only thing that decides one now.
   */
  private extFromMime(mimetype: string): string {
    switch (mimetype) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      case 'application/pdf':
        return '.pdf';
      case 'application/msword':
        return '.doc';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      case 'audio/mpeg':
        return '.mp3';
      case 'audio/wav':
        return '.wav';
      case 'audio/ogg':
        return '.ogg';
      default:
        return '.bin';
    }
  }

  /**
   * 本地存储上传
   */
  private async uploadLocal(key: string, data: Buffer): Promise<UploadResult> {
    const filePath = path.join(this.localBasePath, key);
    const dirPath = path.dirname(filePath);

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, data);

    const url = `${this.baseUrl}/uploads/${key}`;
    this.logger.debug(`文件已保存到本地: ${filePath}`);

    return { key, url, provider: 'local' };
  }

  /**
   * S3 兼容存储上传
   * 支持：AWS S3、MinIO、阿里云 OSS S3 兼容模式等
   */
  private async uploadS3(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      const bucket = this.configService.get<string>('AWS_S3_BUCKET');
      const region =
        this.configService.get<string>('AWS_REGION') || 'us-east-1';
      const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

      const client = new S3Client({
        region,
        credentials: {
          accessKeyId:
            this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
          secretAccessKey:
            this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
        },
        ...(endpoint && { endpoint, forcePathStyle: true }),
      });

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      );

      const url = endpoint
        ? `${endpoint}/${bucket}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      return { key, url, provider: 's3' };
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw error;
    }
  }

  /**
   * 阿里云 OSS 上传
   * 需要安装：pnpm add ali-oss
   */
  private async uploadOSS(key: string, data: Buffer): Promise<UploadResult> {
    try {
      const OSS = (await import('ali-oss')).default;

      const client = new OSS({
        region: this.configService.get('OSS_REGION')!,
        accessKeyId: this.configService.get('OSS_ACCESS_KEY_ID')!,
        accessKeySecret: this.configService.get('OSS_ACCESS_KEY_SECRET')!,
        bucket: this.configService.get('OSS_BUCKET')!,
      });

      const result = await client.put(key, data);

      return { key, url: result.url, provider: 'oss' };
    } catch (error) {
      this.logger.error('OSS upload failed', error);
      throw error;
    }
  }

  /**
   * 腾讯云 COS 上传
   * 需要安装：pnpm add cos-nodejs-sdk-v5
   */
  private async uploadCOS(key: string, data: Buffer): Promise<UploadResult> {
    try {
      const COS = (await import('cos-nodejs-sdk-v5')).default;

      const client = new COS({
        SecretId: this.configService.get('COS_SECRET_ID'),
        SecretKey: this.configService.get('COS_SECRET_KEY'),
      });

      const bucket = this.configService.get('COS_BUCKET');
      const region = this.configService.get('COS_REGION');

      await new Promise<void>((resolve, reject) => {
        client.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: key,
            Body: data,
          },
          (err) => {
            if (err)
              reject(
                err instanceof Error
                  ? err
                  : new Error(
                      typeof err === 'string' ? err : 'Storage upload failed',
                    ),
              );
            else resolve();
          },
        );
      });

      const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;

      return { key, url, provider: 'cos' };
    } catch (error) {
      this.logger.error('COS upload failed', error);
      throw error;
    }
  }

  /**
   * Delete an object. Missing keys are success (idempotent); any other
   * failure throws — account purge must not swallow a leftover blob.
   */
  async deleteFile(key: string): Promise<void> {
    this.assertSafeObjectKey(key);
    switch (this.storageType) {
      case 's3':
        await this.deleteS3(key);
        return;
      case 'oss':
        await this.deleteOSS(key);
        return;
      case 'cos':
        await this.deleteCOS(key);
        return;
      default:
        await this.deleteLocal(key);
    }
  }

  /**
   * Delete every key, then throw once if any failed. Tries the whole set so
   * one missing-permission object does not skip the rest.
   */
  async deleteFiles(keys: string[]): Promise<void> {
    const unique = [...new Set(keys.filter(Boolean))];
    const failures: string[] = [];
    for (const key of unique) {
      try {
        await this.deleteFile(key);
      } catch (err) {
        failures.push(
          `${key}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (failures.length > 0) {
      throw new InternalServerErrorException(
        `Storage delete failed for ${failures.length} key(s): ${failures.join('; ')}`,
      );
    }
  }

  /**
   * Local-disk listing of a user's objects. Cloud providers return [] here
   * and rely on DB-collected keys; the purge proof exercises local storage.
   */
  async listUserObjectKeys(userId: string): Promise<string[]> {
    if (
      !userId ||
      userId.includes('..') ||
      userId.includes('/') ||
      userId.includes('\\')
    ) {
      return [];
    }
    const keys: string[] = [];
    for (const prefix of USER_OBJECT_KEY_PREFIXES) {
      keys.push(...(await this.listKeysByPrefix(`${prefix}${userId}/`)));
    }
    return keys;
  }

  async listKeysByPrefix(prefix: string): Promise<string[]> {
    this.assertSafeObjectKey(prefix.replace(/\/+$/, '') || prefix);
    if (this.storageType !== 'local') {
      return [];
    }
    const absDir = path.resolve(this.localBasePath, prefix);
    const root = path.resolve(this.localBasePath);
    const rel = path.relative(root, absDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new InternalServerErrorException('Invalid storage prefix');
    }
    return this.walkLocalKeys(absDir, prefix.replace(/\/+$/, ''));
  }

  private async walkLocalKeys(
    absDir: string,
    keyPrefix: string,
  ): Promise<string[]> {
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const keys: string[] = [];
    for (const entry of entries) {
      const rel = `${keyPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        keys.push(
          ...(await this.walkLocalKeys(path.join(absDir, entry.name), rel)),
        );
      } else if (entry.isFile()) {
        keys.push(rel);
      }
    }
    return keys;
  }

  private assertSafeObjectKey(key: string): void {
    if (!key || key.includes('..') || path.isAbsolute(key)) {
      throw new InternalServerErrorException('Invalid storage key');
    }
  }

  private async deleteLocal(key: string): Promise<void> {
    const filePath = path.join(this.localBasePath, key);
    const root = path.resolve(this.localBasePath);
    const abs = path.resolve(filePath);
    if (
      path.relative(root, abs).startsWith('..') ||
      path.isAbsolute(path.relative(root, abs))
    ) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    try {
      await fs.unlink(abs);
      this.logger.debug(`文件已删除: ${abs}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async deleteS3(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } =
      await import('@aws-sdk/client-s3');
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
      ...(endpoint && { endpoint, forcePathStyle: true }),
    });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  private async deleteOSS(key: string): Promise<void> {
    const OSS = (await import('ali-oss')).default;
    const client = new OSS({
      region: this.configService.get('OSS_REGION')!,
      accessKeyId: this.configService.get('OSS_ACCESS_KEY_ID')!,
      accessKeySecret: this.configService.get('OSS_ACCESS_KEY_SECRET')!,
      bucket: this.configService.get('OSS_BUCKET')!,
    });
    try {
      await client.delete(key);
    } catch (error) {
      const status = (error as { status?: number; code?: string }).status;
      const code = (error as { code?: string }).code;
      if (status === 404 || code === 'NoSuchKey') return;
      throw error;
    }
  }

  private async deleteCOS(key: string): Promise<void> {
    const COS = (await import('cos-nodejs-sdk-v5')).default;
    const client = new COS({
      SecretId: this.configService.get('COS_SECRET_ID'),
      SecretKey: this.configService.get('COS_SECRET_KEY'),
    });
    const bucket = this.configService.get('COS_BUCKET');
    const region = this.configService.get('COS_REGION');
    await new Promise<void>((resolve, reject) => {
      client.deleteObject(
        { Bucket: bucket, Region: region, Key: key },
        (err) => {
          if (!err) {
            resolve();
            return;
          }
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404) {
            resolve();
            return;
          }
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }

  /**
   * 获取当前存储类型
   */
  getStorageType(): StorageProvider {
    return this.storageType;
  }

  /**
   * 检查云存储是否可用
   */
  isCloudStorageConfigured(): boolean {
    switch (this.storageType) {
      case 's3':
        return !!(
          this.configService.get('AWS_S3_BUCKET') &&
          this.configService.get('AWS_ACCESS_KEY_ID')
        );
      case 'oss':
        return !!(
          this.configService.get('OSS_BUCKET') &&
          this.configService.get('OSS_ACCESS_KEY_ID')
        );
      case 'cos':
        return !!(
          this.configService.get('COS_BUCKET') &&
          this.configService.get('COS_SECRET_ID')
        );
      default:
        return true; // local 始终可用
    }
  }
}
