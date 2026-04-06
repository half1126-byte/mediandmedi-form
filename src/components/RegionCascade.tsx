'use client';

import { useMemo } from 'react';
import regionsData from '@/data/regions.json';

const regions = regionsData as Record<string, Record<string, string[]>>;

interface RegionValue {
  city: string;
  district: string;
  dong?: string;
}

interface RegionCascadeProps {
  value: RegionValue;
  onChange: (value: RegionValue) => void;
}

export default function RegionCascade({ value, onChange }: RegionCascadeProps) {
  const cities = useMemo(() => Object.keys(regions), []);
  const districts = useMemo(
    () => (value.city ? Object.keys(regions[value.city] || {}) : []),
    [value.city]
  );
  const dongs = useMemo(
    () =>
      value.city && value.district
        ? regions[value.city]?.[value.district] || []
        : [],
    [value.city, value.district]
  );

  return (
    <div className="space-y-3">
      <select
        value={value.city}
        onChange={(e) =>
          onChange({ city: e.target.value, district: '', dong: '' })
        }
        className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base text-[#374151] bg-white"
      >
        <option value="">시/도 선택</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {value.city && (
        <select
          value={value.district}
          onChange={(e) =>
            onChange({ ...value, district: e.target.value, dong: '' })
          }
          className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base text-[#374151] bg-white"
        >
          <option value="">구/군 선택</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}

      {value.district && dongs.length > 0 && (
        <select
          value={value.dong || ''}
          onChange={(e) => onChange({ ...value, dong: e.target.value })}
          className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base text-[#374151] bg-white"
        >
          <option value="">동 선택 (선택사항)</option>
          {dongs.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}
    </div>
  );
}
