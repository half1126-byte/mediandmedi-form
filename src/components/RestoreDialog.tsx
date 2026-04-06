'use client';

import { SavedFormData } from '@/lib/autosave';

interface RestoreDialogProps {
  savedData: SavedFormData;
  onRestore: () => void;
  onNew: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function RestoreDialog({
  savedData,
  onRestore,
  onNew,
}: RestoreDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-[#2563EB]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#374151] mb-2">
            이전 작성 내용이 있습니다
          </h3>
          <div className="bg-[#F8FAFC] rounded-lg p-3 mb-4">
            <p className="text-sm text-[#374151] font-medium">
              {savedData.clinicName || '(치과명 미입력)'}
            </p>
            <p className="text-xs text-[#6B7280] mt-1">
              {savedData.currentStep + 1}/{savedData.totalSteps} 스텝 진행
              &nbsp;·&nbsp;
              {timeAgo(savedData.savedAt)}
            </p>
          </div>
        </div>
        <div className="flex border-t border-[#E5E7EB]">
          <button
            onClick={onNew}
            className="flex-1 py-4 text-sm font-medium text-[#6B7280] hover:bg-gray-50 transition-colors"
          >
            새로 시작
          </button>
          <div className="w-px bg-[#E5E7EB]" />
          <button
            onClick={onRestore}
            className="flex-1 py-4 text-sm font-semibold text-[#2563EB] hover:bg-blue-50 transition-colors"
          >
            이어서 작성
          </button>
        </div>
      </div>
    </div>
  );
}
