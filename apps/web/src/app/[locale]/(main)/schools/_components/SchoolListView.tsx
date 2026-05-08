'use client';

import { type SchoolSortBy } from '@/components/features/schools/school-filters';
import { SchoolCard } from './SchoolCard';
import { type School } from './schools-types';

interface SchoolListViewProps {
  schools: School[];
  hasAuth: boolean;
  onToggleSelection: (school: School, checked: boolean) => void;
  isSchoolSelected: (id: string) => boolean;
  addedSchools: Set<string>;
  onAddToList: (id: string, round: string) => void;
  isAddingToList: boolean;
  sortBy: SchoolSortBy;
  onSortByChange: (s: SchoolSortBy) => void;
  density: 'comfortable' | 'compact';
}

export function SchoolListView({
  schools,
  hasAuth,
  onToggleSelection,
  isSchoolSelected,
  addedSchools,
  onAddToList,
  isAddingToList,
  density,
}: SchoolListViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {schools.map((school) => (
        <SchoolCard
          key={school.id}
          school={school}
          viewMode="list"
          density={density}
          hasAuth={hasAuth}
          isSelected={isSchoolSelected(school.id)}
          isAdded={addedSchools.has(school.id)}
          onToggleSelection={onToggleSelection}
          onAddToList={onAddToList}
          isAddingToList={isAddingToList}
        />
      ))}
    </div>
  );
}
