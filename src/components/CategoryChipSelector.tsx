'use client';

import { useState } from 'react';

interface CategoryChipSelectorProps {
  categories: Record<string, string[]>;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function CategoryChipSelector({
  categories,
  selected,
  onChange,
}: CategoryChipSelectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const countSelected = (items: string[]) =>
    items.filter((i) => selected.includes(i)).length;

  return (
    <div className="space-y-4">
      {Object.entries(categories).map(([category, items]) => {
        const isCollapsed = collapsed[category] || false;
        const selectedCount = countSelected(items);

        return (
          <div key={category}>
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 mb-2 w-full text-left"
            >
              <span className="text-sm font-semibold text-[#6B7280]">
                {category}
              </span>
              {selectedCount > 0 && (
                <span className="text-xs bg-[#2563EB] text-white rounded-full px-2 py-0.5">
                  {selectedCount}개
                </span>
              )}
              <svg
                className={`w-4 h-4 text-[#9CA3AF] ml-auto transition-transform ${
                  isCollapsed ? '' : 'rotate-180'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!isCollapsed && (
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isSelected = selected.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggle(item)}
                      className={`
                        h-10 px-4 rounded-full text-sm font-medium
                        transition-all duration-150 min-w-[44px] min-h-[44px]
                        ${
                          isSelected
                            ? 'bg-[#2563EB] text-white border border-transparent scale-[1.02]'
                            : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB]'
                        }
                      `}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
