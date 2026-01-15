import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService, EncryptedData } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'VAULT_ENCRYPTION_KEY')
        return 'test-encryption-key-for-unit-tests';
      if (key === 'VAULT_KEY_SALT') return 'test-salt';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const userId = 'user-123';
      const plainText = 'sensitive data to encrypt';

      const encrypted = service.encrypt(plainText, userId);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted.encryptedData).not.toBe(plainText);

      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        userId,
      );
      expect(decrypted).toBe(plainText);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const userId = 'user-123';
      const plainText = 'same data';

      const encrypted1 = service.encrypt(plainText, userId);
      const encrypted2 = service.encrypt(plainText, userId);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should produce different ciphertext for different users', () => {
      const plainText = 'shared secret';

      const encrypted1 = service.encrypt(plainText, 'user-1');
      const encrypted2 = service.encrypt(plainText, 'user-2');

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
    });

    it('should fail to decrypt with wrong user ID', () => {
      const plainText = 'secret';
      const encrypted = service.encrypt(plainText, 'user-1');

      expect(() => {
        service.decrypt(encrypted.encryptedData, encrypted.iv, 'user-2');
      }).toThrow('Decryption failed');
    });

    it('should fail to decrypt tampered data', () => {
      const userId = 'user-123';
      const plainText = 'original data';
      const encrypted = service.encrypt(plainText, userId);

      // Tamper with the encrypted data
      const tamperedData = 'aa' + encrypted.encryptedData.slice(2);

      expect(() => {
        service.decrypt(tamperedData, encrypted.iv, userId);
      }).toThrow('Decryption failed');
    });

    it('should handle empty string', () => {
      const userId = 'user-123';
      const plainText = '';

      const encrypted = service.encrypt(plainText, userId);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        userId,
      );

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const userId = 'user-123';
      const plainText = '中文测试 🔐 émojis & spëcial chârs';

      const encrypted = service.encrypt(plainText, userId);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        userId,
      );

      expect(decrypted).toBe(plainText);
    });

    it('should handle large data', () => {
      const userId = 'user-123';
      const plainText = 'x'.repeat(100000); // 100KB

      const encrypted = service.encrypt(plainText, userId);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        userId,
      );

      expect(decrypted).toBe(plainText);
    });
  });

  describe('generatePassword', () => {
    it('should generate password of specified length', () => {
      const password = service.generatePassword(20);
      expect(password.length).toBe(20);
    });

    it('should generate different passwords each time', () => {
      const password1 = service.generatePassword(16);
      const password2 = service.generatePassword(16);
      expect(password1).not.toBe(password2);
    });

    it('should use default length of 16', () => {
      const password = service.generatePassword();
      expect(password.length).toBe(16);
    });
  });

  describe('hashForSearch', () => {
    it('should produce consistent hash for same input', () => {
      const userId = 'user-123';
      const value = 'searchable value';

      const hash1 = service.hashForSearch(value, userId);
      const hash2 = service.hashForSearch(value, userId);

      expect(hash1).toBe(hash2);
    });

    it('should be case insensitive', () => {
      const userId = 'user-123';

      const hash1 = service.hashForSearch('TEST', userId);
      const hash2 = service.hashForSearch('test', userId);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different users', () => {
      const value = 'same value';

      const hash1 = service.hashForSearch(value, 'user-1');
      const hash2 = service.hashForSearch(value, 'user-2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return 16 character hash', () => {
      const hash = service.hashForSearch('any value', 'user-123');
      expect(hash.length).toBe(16);
    });
  });
});
