'use client';

import { useState } from 'react';

export interface ReviewItem {
  label: string;
  value: string | undefined | null;
}

interface ReviewModalProps {
  open: boolean;
  title: string;
  warning?: string;
  items: ReviewItem[];
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

/**
 * 폼 제출 직전 사용자에게 입력 데이터를 readonly로 보여주고
 * 명시적 "확인했습니다" 체크 후에만 제출 가능하게 막는 게이트 모달.
 *
 * 사용처: 계약변경, 진료일정 변경 등 단일 페이지 폼.
 * (신규개원 폼은 Step 7 자체가 검토 단계라 모달 불필요)
 */
export default function ReviewModal({
  open, title, warning, items, onCancel, onConfirm, submitting = false,
}: ReviewModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  // 모달이 열릴 때마다 체크박스 자동 리셋.
  // React 권장 패턴: useEffect에서 setState하면 cascading render. prevOpen 비교로
  // open prop이 false→true 전환되는 시점에만 render 중 동기 리셋.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setConfirmed(false);
  }

  if (!open) return null;

  const filledItems = items.filter((i) => i.value && i.value.toString().trim());

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div
        className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3 border-b border-[#E5E7EB] flex-shrink-0">
          <h2 id="review-modal-title" className="text-lg font-bold text-[#374151]">
            {title}
          </h2>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {warning && (
            <div className="bg-[#FEF3C7] border-l-4 border-[#D97706] rounded-r-lg p-3">
              <p className="text-xs text-[#92400E] leading-relaxed">{warning}</p>
            </div>
          )}

          <div className="bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] p-4 space-y-2">
            {filledItems.map((item, idx) => (
              <div key={idx} className="flex text-sm">
                <span className="w-28 flex-shrink-0 text-[#9CA3AF] font-medium">{item.label}</span>
                <span className="text-[#374151] flex-1 break-words">{item.value}</span>
              </div>
            ))}
            {filledItems.length === 0 && (
              <p className="text-sm text-[#9CA3AF]">입력된 항목이 없습니다.</p>
            )}
          </div>

          <label className="flex items-start gap-3 bg-white rounded-xl border-2 border-[#2563EB] p-3 cursor-pointer hover:bg-[#EFF6FF] transition-colors">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-[#2563EB] flex-shrink-0"
            />
            <div className="text-sm">
              <span className="font-semibold text-[#374151]">위 내용을 모두 확인했습니다.</span>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                특히 치과명에 오타·공백 흔들림이 없는지 한 번 더 봐주세요.
              </p>
            </div>
          </label>
        </div>

        {/* 푸터 버튼 */}
        <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-12 px-6 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg font-medium
                       disabled:opacity-50"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed || submitting}
            title={!confirmed ? '먼저 확인 체크박스를 선택해주세요' : undefined}
            className="flex-1 h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '제출 중...' : confirmed ? '제출하기' : '확인 후 제출 가능'}
          </button>
        </div>
      </div>
    </div>
  );
}
