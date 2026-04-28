import {
  attachInstitutionNames,
  buildPayloadRows,
  parseCsv,
} from '../../../scripts/import-ipeds-csv';

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
        schoolNameNorm: 'university of california, davis',
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

  it('parses official IPEDS ADM SAT/ACT component percentile fields', () => {
    const rows = parseCsv(
      [
        'UNITID,APPLCN,ADMSSN,SATVR25,SATMT25,SATVR50,SATMT50,SATVR75,SATMT75,ACTCM25,ACTCM50,ACTCM75',
        '166683,33489,1337,740,780,760,790,780,800,34,35,36',
      ].join('\n'),
    );

    expect(buildPayloadRows(rows)).toEqual([
      expect.objectContaining({
        unitid: '166683',
        acceptanceRate: 3.99,
        sat25: 1520,
        satAvg: 1550,
        sat75: 1580,
        act25: 34,
        actAvg: 35,
        act75: 36,
      }),
    ]);
  });

  it('attaches institution names from the official HD file by UNITID', () => {
    const admRows = parseCsv(
      ['UNITID,APPLCN,ADMSSN', '110644,98869,41353'].join('\n'),
    );
    const hdRows = parseCsv(
      ['\uFEFFUNITID,INSTNM', '110644,"University of California, Davis"'].join(
        '\n',
      ),
    );

    expect(buildPayloadRows(attachInstitutionNames(admRows, hdRows))).toEqual([
      expect.objectContaining({
        unitid: '110644',
        schoolNameNorm: 'university of california, davis',
      }),
    ]);
  });

  it('derives undergraduate international student pct from official EF A rows', () => {
    const rows = parseCsv(
      [
        'UNITID,EFALEVEL,EFTOTLT,EFNRALT',
        '166683,1,11920,3505',
        '166683,2,4576,505',
      ].join('\n'),
    );

    expect(buildPayloadRows(rows)).toEqual([
      expect.objectContaining({
        unitid: '166683',
        totalEnrollment: 4576,
        intlStudentPct: 11.04,
      }),
    ]);
  });

  it('derives first-time freshman international pct from official EF C residence rows', () => {
    const rows = parseCsv(
      [
        'UNITID,EFCSTATE,LINE,EFRES01',
        '110644,6,6,5206',
        '110644,90,90,1020',
        '110644,99,99,6577',
      ].join('\n'),
    );

    expect(buildPayloadRows(rows)).toEqual([
      expect.objectContaining({
        unitid: '110644',
        intlStudentPct: 15.51,
      }),
    ]);
  });
});
