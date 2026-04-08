'use client';

import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  show: boolean;
  steps?: string[];
  currentStepIndex?: number;
}

export default function LoadingOverlay({
  show,
  steps = ['치과 정보 저장 중...', '팀별 업무 생성 중...', '완료!'],
  currentStepIndex = 0,
}: LoadingOverlayProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!show) return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center px-8">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          {currentStepIndex >= steps.length - 1 ? (
            <div className="w-16 h-16 rounded-full bg-[#16A34A] flex items-center justify-center animate-scale-in">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />
          )}
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`flex items-center justify-center gap-2 text-sm transition-all duration-300 ${
                i < currentStepIndex
                  ? 'text-[#16A34A]'
                  : i === currentStepIndex
                  ? 'text-[#374151] font-semibold'
                  : 'text-[#D1D5DB]'
              }`}
            >
              {i < currentStepIndex && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {i === currentStepIndex && i < steps.length - 1 && (
                <span className="inline-block w-4">{dots}</span>
              )}
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-scale-in {
          animation: scale-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
