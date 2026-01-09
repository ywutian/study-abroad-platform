import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
  encryptedData: string;
  iv: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly masterKey: Buffer;

  constructor(private configService: ConfigService) {
    const envKey = this.configService.get<string>('VAULT_ENCRYPTION_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    
    if (!envKey) {
      if (nodeEnv === 'production') {
        throw new Error('FATAL: VAULT_ENCRYPTION_KEY environment variable is required in production');
      }
      this.logger.warn('VAULT_ENCRYPTION_KEY not set! Using insecure default key for development only.');
      this.masterKey = crypto.scryptSync('dev-secret-key-change-in-prod', 'dev-vault-salt-v1', this.keyLength);
    } else if (envKey.length === 64) {
      // Hex-encoded 256-bit key
      this.masterKey = Buffer.from(envKey, 'hex');
    } else {
      // Derive key from passphrase with unique salt
      const salt = this.configService.get<string>('VAULT_KEY_SALT') || 'vault-encryption-salt-v1';
      this.masterKey = crypto.scryptSync(envKey, salt, this.keyLength);
    }
  }

  /**
   * Derive a user-specific key from the master key and user ID
   */
  private deriveUserKey(userId: string): Buffer {
    return crypto.scryptSync(this.masterKey, userId, this.keyLength);
  }

  /**
   * Encrypt data for a specific user
   */
  encrypt(plainText: string, userId: string): EncryptedData {
    try {
      const userKey = this.deriveUserKey(userId);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, userKey, iv, {
        authTagLength: this.authTagLength,
      });

      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Append auth tag to encrypted data
      const authTag = cipher.getAuthTag();
      encrypted += authTag.toString('hex');

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data for a specific user
   */
  decrypt(encryptedData: string, iv: string, userId: string): string {
    try {
      const userKey = this.deriveUserKey(userId);
      const ivBuffer = Buffer.from(iv, 'hex');
      
      // Extract auth tag from end of encrypted data
      const authTagLength = this.authTagLength * 2; // hex encoded
      const authTag = Buffer.from(encryptedData.slice(-authTagLength), 'hex');
      const encryptedText = encryptedData.slice(0, -authTagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, userKey, ivBuffer, {
        authTagLength: this.authTagLength,
      });
      
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Decryption failed - data may be corrupted or tampered with');
    }
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const randomBytes = crypto.randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Hash sensitive metadata (for searching without decryption)
   */
  hashForSearch(value: string, userId: string): string {
    return crypto
      .createHmac('sha256', this.deriveUserKey(userId))
      .update(value.toLowerCase())
      .digest('hex')
      .substring(0, 16);
  }
}


