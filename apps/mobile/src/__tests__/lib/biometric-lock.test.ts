import { shouldActivateBiometricLock } from '@/lib/security/biometric-lock';

describe('biometric app lock policy', () => {
  it.each(['inactive', 'background'] as const)(
    'locks an authenticated session when iOS becomes %s',
    (state) => {
      expect(shouldActivateBiometricLock(state, true, 'true')).toBe(true);
    }
  );

  it('does not lock while the app remains active', () => {
    expect(shouldActivateBiometricLock('active', true, 'true')).toBe(false);
  });

  it('does not lock signed-out or opted-out sessions', () => {
    expect(shouldActivateBiometricLock('background', false, 'true')).toBe(false);
    expect(shouldActivateBiometricLock('background', true, 'false')).toBe(false);
  });
});
