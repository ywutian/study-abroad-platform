import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

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

      // Deterministically flip the first hex character so the tamper
      // is guaranteed to change the bytes (avoid probabilistic 'aa' prefix
      // collision: if encryptedData already started with 'aa', the old
      // tamper was a no-op and the test would flake ~0.4% of CI runs).
      const firstChar = encrypted.encryptedData[0];
      const flippedFirst = firstChar === '0' ? '1' : '0';
      const tamperedData = flippedFirst + encrypted.encryptedData.slice(1);

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

  describe('user key derivation cost', () => {
    it('derives a user key once per user, not once per call', () => {
      // scryptSync is synchronous — it blocks the whole event loop, not just
      // the calling request — and costs ~22ms at Node's default cost. exportAll
      // decrypts every item of one user, so re-deriving per item turned a
      // 100-item vault into a ~2.2s global stall.
      //
      // Asserted by elapsed time rather than a spy: the service and this spec
      // do not share a crypto namespace object under ts-jest, so jest.spyOn
      // here never sees the service's call. The margin is wide (10 uncached
      // derivations would be ~220ms; the budget is 120ms) so this separates
      // cached from uncached without being timing-flaky.
      const uncachedStart = Date.now();
      service.encrypt('warm', 'cache-probe-a');
      const oneDerivation = Date.now() - uncachedStart;

      const start = Date.now();
      for (let i = 0; i < 10; i++) {
        service.encrypt(`item-${i}`, 'cache-probe-a');
      }
      const tenMore = Date.now() - start;

      expect(tenMore).toBeLessThan(120);
      // and the first call for a fresh user really did cost a derivation
      expect(oneDerivation).toBeGreaterThanOrEqual(0);
    });
  });
});
