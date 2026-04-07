import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestoreDialog from '@/components/RestoreDialog';
import type { SavedFormData } from '@/lib/autosave';

const mockSavedData: SavedFormData = {
  sessionId: 'test-session',
  clinicName: '해피스마일치과',
  currentStep: 3,
  totalSteps: 7,
  data: {},
  savedAt: new Date(Date.now() - 120 * 60000).toISOString(), // 2시간 전
};

describe('RestoreDialog', () => {
  it('치과명 표시', () => {
    render(
      <RestoreDialog savedData={mockSavedData} onRestore={() => {}} onNew={() => {}} />
    );
    expect(screen.getByText('해피스마일치과')).toBeInTheDocument();
  });

  it('진행 스텝 표시', () => {
    render(
      <RestoreDialog savedData={mockSavedData} onRestore={() => {}} onNew={() => {}} />
    );
    expect(screen.getByText(/4\/7 스텝 진행/)).toBeInTheDocument();
  });

  it('시간 표시 (2시간 전)', () => {
    render(
      <RestoreDialog savedData={mockSavedData} onRestore={() => {}} onNew={() => {}} />
    );
    expect(screen.getByText(/2시간 전/)).toBeInTheDocument();
  });

  it('치과명 미입력 시 기본 텍스트', () => {
    render(
      <RestoreDialog
        savedData={{ ...mockSavedData, clinicName: undefined }}
        onRestore={() => {}}
        onNew={() => {}}
      />
    );
    expect(screen.getByText('(치과명 미입력)')).toBeInTheDocument();
  });

  it('"이어서 작성" 클릭 시 onRestore 호출', () => {
    const onRestore = vi.fn();
    render(
      <RestoreDialog savedData={mockSavedData} onRestore={onRestore} onNew={() => {}} />
    );
    fireEvent.click(screen.getByText('이어서 작성'));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('"새로 시작" 클릭 시 onNew 호출', () => {
    const onNew = vi.fn();
    render(
      <RestoreDialog savedData={mockSavedData} onRestore={() => {}} onNew={onNew} />
    );
    fireEvent.click(screen.getByText('새로 시작'));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
