import {
  collectTokenStorageRisks,
  detectChallengePoints,
  detectExportDownloadSurfaces,
  detectUiRoleGuards,
  flattenJsonKeys,
} from './probe';

describe('owned-site-assessment probe helpers', () => {
  it('flattens nested JSON keys', () => {
    expect(
      flattenJsonKeys({
        result: {
          applicant: { gpa: 3.9, sat: 1500 },
          schools: [{ id: '1', chance: 0.42 }],
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'result',
        'result.applicant',
        'result.applicant.gpa',
        'result.schools',
        'result.schools[].id',
      ]),
    );
  });

  it('detects script-readable token storage risks', () => {
    expect(
      collectTokenStorageRisks({
        localStorageKeys: ['accessToken'],
        sessionStorageKeys: ['uiState'],
      }),
    ).toEqual([
      'Script-readable storage key "accessToken" may contain bearer or session material.',
    ]);
  });

  it('detects challenge and role-guard markers', () => {
    expect(
      detectChallengePoints('Too many requests. Please verify you are human.'),
    ).toEqual(expect.arrayContaining(['human-verification', 'rate-limit']));
    expect(
      detectUiRoleGuards('Please sign in. Access denied. Admin only.'),
    ).toEqual(
      expect.arrayContaining(['access-denied', 'admin-only', 'login-required']),
    );
  });

  it('detects download-oriented surfaces', () => {
    expect(
      detectExportDownloadSurfaces([
        'Export CSV',
        'Download XLSX',
        'Open profile',
      ]),
    ).toEqual(expect.arrayContaining(['Download XLSX', 'Export CSV']));
  });
});
