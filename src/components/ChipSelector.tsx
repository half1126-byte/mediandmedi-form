'use client';

interface ChipSelectorProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  max?: number;
}

export default function ChipSelector({
  options,
  selected,
  onChange,
  multiple = true,
  max,
}: ChipSelectorProps) {
  const toggle = (item: string) => {
    if (!multiple) {
      onChange(selected.includes(item) ? [] : [item]);
      return;
    }

    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, item]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
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
            {option}
          </button>
        );
      })}
    </div>
  );
}
