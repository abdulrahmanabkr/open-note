import type { ChangeEvent } from 'react';
import type { Taxonomy } from '../api/types';
import { levelLabel } from '../lib/format';
import { FilterIcon } from './Icons';

export interface FilterValues {
  schoolId: string;
  departmentId: string;
  level: string;
  noteType: string;
  sort: string;
}

interface NoteFiltersProps {
  taxonomy: Taxonomy | null;
  values: FilterValues;
  total?: number;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
}

export function NoteFilters({ taxonomy, values, total, onChange, onReset }: NoteFiltersProps) {
  const selectedSchool = taxonomy?.schools.find((school) => String(school.id) === values.schoolId);
  const departments = selectedSchool
    ? selectedSchool.departments
    : (taxonomy?.schools ?? []).flatMap((school) => school.departments);

  const activeCount = [values.schoolId, values.departmentId, values.level, values.noteType].filter(Boolean).length;

  const handle = (key: keyof FilterValues) => (event: ChangeEvent<HTMLSelectElement>) => {
    if (key === 'schoolId') {
      onChange({ schoolId: event.target.value, departmentId: '' });
      return;
    }
    onChange({ [key]: event.target.value });
  };

  return (
    <div className="filters">
      <div className="filters__title">
        <span className="filters__label">
          <FilterIcon size={17} /> Filter notes
        </span>
        {typeof total === 'number' ? (
          <span className="filters__count">
            {total} {total === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
      </div>

      <div className="filters__grid">
        <label className="field field--compact">
          <span className="field__label">School / faculty</span>
          <select value={values.schoolId} onChange={handle('schoolId')}>
            <option value="">All schools</option>
            {taxonomy?.schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--compact">
          <span className="field__label">Department</span>
          <select value={values.departmentId} onChange={handle('departmentId')}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--compact">
          <span className="field__label">Level</span>
          <select value={values.level} onChange={handle('level')}>
            <option value="">All levels</option>
            {taxonomy?.levels.map((level) => (
              <option key={level} value={level}>
                {levelLabel(level)}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--compact">
          <span className="field__label">Note type</span>
          <select value={values.noteType} onChange={handle('noteType')}>
            <option value="">Any type</option>
            {taxonomy?.noteTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--compact filters__sort">
          <span className="field__label">Sort by</span>
          <select value={values.sort} onChange={handle('sort')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="popular">Most viewed</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </label>

        {activeCount > 0 ? (
          <button type="button" className="btn btn--ghost btn--sm filters__reset" onClick={onReset}>
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
