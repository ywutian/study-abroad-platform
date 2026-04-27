'use client';

import type { CdsBandRow } from '../page';

const GPA_BANDS = ['3.75-4.00', '3.50-3.74', '3.25-3.49', '3.00-3.24', '<3.00'];
const TEST_BANDS = ['1500-1600', '1400-1499', '1300-1399', '<1300', 'ANY'];

export function CdsBandCellMatrix({ rows }: { rows: CdsBandRow[] }) {
  const byCell = new Map(rows.map((row) => [`${row.gpaBand}:${row.testBand}`, row]));

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 text-left">GPA \\ Test</th>
            {TEST_BANDS.map((band) => (
              <th key={band} className="px-3 py-2 text-left">
                {band}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GPA_BANDS.map((gpaBand) => (
            <tr key={gpaBand} className="border-t">
              <th className="px-3 py-2 text-left font-medium">{gpaBand}</th>
              {TEST_BANDS.map((testBand) => {
                const row = byCell.get(`${gpaBand}:${testBand}`);
                return (
                  <td key={testBand} className="px-3 py-2">
                    {row ? `${(row.admitRate * 100).toFixed(1)}%` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
