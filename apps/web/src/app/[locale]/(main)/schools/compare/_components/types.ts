import type { useFormatter } from 'next-intl';
import type { SchoolDetail } from '../../[id]/_components/types';

export type CompareDirection = 'lower' | 'higher';

export type SchoolDetailForCompare = SchoolDetail;

export interface CompareField {
  key: string;
  labelKey: string;
  getValue: (s: SchoolDetailForCompare) => string | number | null | undefined;
  format: (
    v: number | string | null | undefined,
    formatter: ReturnType<typeof useFormatter>
  ) => string;
  best: CompareDirection;
}
