'use client';

import type { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { cn, getSchoolName } from '@/lib/utils';
import type { CompareField, SchoolDetailForCompare } from './types';
import { CATEGORY_FIELDS } from './compare-fields';
import { getBestIndex } from './compare-utils';

interface CompareTableProps {
  schools: SchoolDetailForCompare[];
  fields: CompareField[];
  locale: string;
  format: ReturnType<typeof useFormatter>;
  t: ReturnType<typeof useTranslations>;
}

function CategoryRows({
  categoryKey,
  fields,
  schools,
  format,
  t,
}: {
  categoryKey: string;
  fields: CompareField[];
  schools: SchoolDetailForCompare[];
  format: ReturnType<typeof useFormatter>;
  t: ReturnType<typeof useTranslations>;
}) {
  const fieldKeys = CATEGORY_FIELDS[categoryKey];
  if (!fieldKeys) return null;
  const categoryFields = fields.filter((f) => fieldKeys.includes(f.key));

  return (
    <>
      {/* Category header row */}
      <tr>
        <td
          colSpan={schools.length + 1}
          className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-t border-border"
        >
          {t(`categories.${categoryKey}`)}
        </td>
      </tr>
      {/* Field rows */}
      {categoryFields.map((field) => {
        const bestIdx = getBestIndex(schools, field);
        return (
          <tr key={field.key} className="border-t border-border">
            <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
              {t(field.labelKey)}
            </td>
            {schools.map((school, idx) => {
              const raw = field.getValue(school);
              const formatted = field.format(raw, format);
              const isBest = bestIdx === idx;
              return (
                <td
                  key={school.id}
                  className={cn(
                    'px-4 py-3 text-sm text-center',
                    isBest ? 'text-primary font-bold' : 'text-foreground'
                  )}
                >
                  {formatted}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

export function CompareTable({ schools, fields, locale, format, t }: CompareTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-[180px]">
                {t('field')}
              </th>
              {schools.map((school) => (
                <th
                  key={school.id}
                  className="px-4 py-3 text-center text-sm font-semibold text-foreground"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[180px]">{getSchoolName(school, locale)}</span>
                    {school.usNewsRank && (
                      <span className="text-xs font-normal text-muted-foreground">
                        #{school.usNewsRank} US News
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(CATEGORY_FIELDS).map((cat) => (
              <CategoryRows
                key={cat}
                categoryKey={cat}
                fields={fields}
                schools={schools}
                format={format}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
