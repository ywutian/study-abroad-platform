import { describe, expect, it } from 'vitest';

import { mapApiErrorToKey } from './api-error-map';

describe('mapApiErrorToKey', () => {
  it('maps known backend messages to their i18n key (substring match)', () => {
    expect(mapApiErrorToKey('Email already registered')).toBe('emailAlreadyRegistered');
    expect(mapApiErrorToKey('Invalid credentials')).toBe('invalidCredentials');
    // the verify-email paths we just hardened
    expect(mapApiErrorToKey('Please verify your email to continue')).toBe('emailNotVerified');
    expect(mapApiErrorToKey('Invalid verification token')).toBe('invalidVerificationToken');
  });

  it('matches regex patterns (case-insensitive)', () => {
    expect(mapApiErrorToKey('Widget ALREADY EXISTS somewhere')).toBe('alreadyExists');
  });

  it('respects order — a specific rule wins over the generic /already exists/', () => {
    expect(mapApiErrorToKey('School already exists in your list')).toBe('schoolAlreadyInList');
  });

  it('returns null for an unmapped message', () => {
    expect(mapApiErrorToKey('Some completely novel error')).toBeNull();
  });
});
