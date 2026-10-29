'use client';

interface ProgressBarProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
  stepLabels?: string[];
}

export default function ProgressBar({
  currentStep,
  totalSteps,
  stepLabels,
}: ProgressBarProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-[#374151]">
          Step {currentStep + 1}/{totalSteps}
          {stepLabels?.[currentStep] && (
            <span className="ml-2 font-normal text-[#6B7280]">
              {stepLabels[currentStep]}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#2563EB] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
