'use client';

import { SERVICES } from '@/data/services';

interface ServiceSelection {
  serviceId: string;
  quantity?: number;
}

interface ContractProductsProps {
  selected: ServiceSelection[];
  onChange: (selected: ServiceSelection[]) => void;
}

export default function ContractProducts({
  selected,
  onChange,
}: ContractProductsProps) {
  const isSelected = (id: string) => selected.some((s) => s.serviceId === id);

  const toggleService = (id: string) => {
    if (isSelected(id)) {
      onChange(selected.filter((s) => s.serviceId !== id));
    } else {
      onChange([...selected, { serviceId: id }]);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    onChange(
      selected.map((s) =>
        s.serviceId === id ? { ...s, quantity } : s
      )
    );
  };

  // 팀별로 그룹핑
  const teams = [...new Set(SERVICES.map((s) => s.team))];

  return (
    <div className="space-y-6">
      {teams.map((team) => (
        <div key={team}>
          <h4 className="text-sm font-semibold text-[#6B7280] mb-3">{team}</h4>
          <div className="space-y-2">
            {SERVICES.filter((s) => s.team === team).map((service) => {
              const sel = selected.find((s) => s.serviceId === service.id);
              const active = !!sel;

              return (
                <div
                  key={service.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${active ? 'border-[#2563EB] bg-blue-50' : 'border-[#E5E7EB] bg-white'}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`
                      w-6 h-6 rounded flex items-center justify-center flex-shrink-0
                      min-w-[44px] min-h-[44px]
                      ${active ? 'bg-[#2563EB] text-white' : 'border-2 border-[#D1D5DB]'}
                    `}
                  >
                    {active && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="flex-1 text-sm font-medium text-[#374151]">
                    {service.name}
                  </span>
                  {active && service.hasQuantity && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={sel?.quantity || ''}
                        onChange={(e) =>
                          updateQuantity(service.id, parseInt(e.target.value) || 0)
                        }
                        placeholder="수량"
                        className="w-16 h-8 px-2 text-sm text-center rounded border border-[#D1D5DB]"
                      />
                      <span className="text-xs text-[#6B7280]">
                        {service.unit}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
