import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

/**
 * The stored object key decides how the file is later served. With
 * STORAGE_TYPE defaulting to 'local' — and the production Cloud Run deploy
 * not setting it — uploads are served by express.static from the API's own
 * origin, and express.static picks Content-Type from the extension. So the
 * extension must never be something the uploader chose.
 */
describe('StorageService — key extension', () => {
  const service = () =>
    new StorageService({
      get: (k: string) =>
        k === 'STORAGE_TYPE'
          ? 'local'
          : k === 'APP_URL'
            ? 'http://api.test'
            : undefined,
    } as unknown as ConfigService);

  /** extFromMime is private; exercise it through the key builders. */
  const ext = (key: string) => key.slice(key.lastIndexOf('.'));

  const file = (mimetype: string, originalname: string) => ({
    buffer: Buffer.from('x'),
    mimetype,
    originalname,
  });

  it('ignores the uploaded filename and uses the validated mime', async () => {
    const svc = service();
    jest
      .spyOn(svc as never, 'uploadLocal')
      .mockImplementation(((key: string) =>
        Promise.resolve({ key, url: '', provider: 'local' })) as never);

    const r = await svc.uploadForumImage('u1', file('image/png', 'evil.html'));

    // the whole bug: `.html` from the filename used to win over the mime
    expect(ext(r.key)).toBe('.png');
    expect(r.key).not.toContain('.html');
  });

  it('never emits an executable extension for an unknown mime', async () => {
    const svc = service();
    jest
      .spyOn(svc as never, 'uploadLocal')
      .mockImplementation(((key: string) =>
        Promise.resolve({ key, url: '', provider: 'local' })) as never);

    const r = await svc.uploadForumImage(
      'u1',
      file('text/html', 'payload.html'),
    );

    // .bin serves as octet-stream — downloads instead of rendering
    expect(ext(r.key)).toBe('.bin');
  });

  it('keeps a legitimate document extension for verification uploads', async () => {
    const svc = service();
    jest
      .spyOn(svc as never, 'uploadLocal')
      .mockImplementation(((key: string) =>
        Promise.resolve({ key, url: '', provider: 'local' })) as never);

    const r = await svc.uploadVerificationFile(
      'u1',
      file('application/pdf', '../../etc/passwd'),
    );

    expect(ext(r.key)).toBe('.pdf');
    // and a traversal attempt in the filename cannot reach the key at all
    expect(r.key).not.toContain('..');
    expect(r.key).toMatch(/^verification\/u1\/[0-9a-f]{32}\.pdf$/);
  });
});

describe('StorageService — owned keys and deleteFile', () => {
  it('extracts verification/outcome/forum keys and rejects traversal', () => {
    const { extractOwnedObjectKey } =
      require('./storage.service') as typeof import('./storage.service');
    expect(
      extractOwnedObjectKey('https://cdn.example/verification/u1/a.pdf'),
    ).toBe('verification/u1/a.pdf');
    expect(extractOwnedObjectKey('outcome-evidence/u1/x.png')).toBe(
      'outcome-evidence/u1/x.png',
    );
    expect(extractOwnedObjectKey('https://dicebear.com/avatar.png')).toBeNull();
    expect(extractOwnedObjectKey('verification/../etc/passwd')).toBeNull();
  });
});
