import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
    this.storageType = (this.configService.get('STORAGE_TYPE') ||
      'local') as StorageProvider;
    this.localBasePath =
      this.configService.get('STORAGE_LOCAL_PATH') || './uploads';
    this.baseUrl = this.configService.get('APP_URL') || 'http://localhost:3001';
  }

  async onModuleInit() {
    if (this.storageType === 'local') {
      // 确保本地存储目录存在
      try {
        await fs.mkdir(this.localBasePath, { recursive: true });
        await fs.mkdir(path.join(this.localBasePath, 'verification'), {
          recursive: true,
        });
        this.logger.log(`本地存储已初始化: ${this.localBasePath}`);
      } catch (error) {
        this.logger.error('创建本地存储目录失败', error);
      }
    } else {
      this.logger.log(`存储类型: ${this.storageType}（需要安装对应 SDK）`);
    }
  }

  /**
   * 上传验证材料
   */
  async uploadVerificationFile(
    userId: string,
    file: StorageFile,
  ): Promise<UploadResult> {
    const fileExt = path.extname(file.originalname);
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

      const bucket = this.configService.get('AWS_S3_BUCKET');
      const region = this.configService.get('AWS_REGION') || 'us-east-1';
      const endpoint = this.configService.get('AWS_S3_ENDPOINT');

      const client = new S3Client({
        region,
        credentials: {
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') || '',
          secretAccessKey:
            this.configService.get('AWS_SECRET_ACCESS_KEY') || '',
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
      this.logger.error('S3 上传失败，降级到本地存储', error);
      return this.uploadLocal(key, data);
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
      this.logger.error('OSS 上传失败，降级到本地存储', error);
      return this.uploadLocal(key, data);
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
            if (err) reject(err);
            else resolve();
          },
        );
      });

      const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;

      return { key, url, provider: 'cos' };
    } catch (error) {
      this.logger.error('COS 上传失败，降级到本地存储', error);
      return this.uploadLocal(key, data);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<void> {
    switch (this.storageType) {
      case 'local':
        await this.deleteLocal(key);
        break;
      // 云存储删除逻辑可按需添加
      default:
        await this.deleteLocal(key);
    }
  }

  private async deleteLocal(key: string): Promise<void> {
    const filePath = path.join(this.localBasePath, key);
    try {
      await fs.unlink(filePath);
      this.logger.debug(`文件已删除: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
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
