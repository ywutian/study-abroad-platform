import { buildPayloadRows, parseCsv } from '../../../scripts/import-ipeds-csv';

describe('import-ipeds-csv parser', () => {
  it('parses quoted CSV fields and derives admit rates from counts', () => {
    const rows = parseCsv(
      [
        'UNITID,Institution,APPLCN,ADMSSN,international_applicants,international_admitted,out_of_state_applicants,out_of_state_admitted,sat_25,sat_75',
        '110644,"University of California, Davis",98869,41353,18880,9569,12279,7038,1280,1460',
      ].join('\n'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].Institution).toBe('University of California, Davis');

    const payload = buildPayloadRows(rows);

    expect(payload).toEqual([
      expect.objectContaining({
        unitid: '110644',
        acceptanceRate: 41.83,
        intlAcceptanceRate: 50.68,
        oosAcceptanceRate: 57.32,
        sat25: 1280,
        sat75: 1460,
      }),
    ]);
  });

  it('accepts precomputed percentage columns when count fields are absent', () => {
    const rows = parseCsv(
      [
        'unitid,acceptanceRate,intlAcceptanceRate,oosAcceptanceRate,act25,act75',
        '166683,4.0,2.4,5.2,34,36',
      ].join('\n'),
    );

    expect(buildPayloadRows(rows)).toEqual([
      expect.objectContaining({
        unitid: '166683',
        acceptanceRate: 4,
        intlAcceptanceRate: 2.4,
        oosAcceptanceRate: 5.2,
        act25: 34,
        act75: 36,
      }),
    ]);
  });
});
