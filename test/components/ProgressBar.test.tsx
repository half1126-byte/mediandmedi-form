import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '@/components/ProgressBar';

describe('ProgressBar', () => {
  it('현재 스텝 표시', () => {
    render(<ProgressBar currentStep={2} totalSteps={7} />);
    expect(screen.getByText(/Step 3\/7/)).toBeInTheDocument();
  });

  it('남은 시간 표시', () => {
    render(<ProgressBar currentStep={0} totalSteps={7} />);
    expect(screen.getByText(/\d+분 남음/)).toBeInTheDocument();
  });

  it('스텝 라벨 표시', () => {
    render(
      <ProgressBar
        currentStep={0}
        totalSteps={7}
        stepLabels={['기본 정보', '진료 정보']}
      />
    );
    expect(screen.getByText('기본 정보')).toBeInTheDocument();
  });

  it('진행 바 width 계산', () => {
    const { container } = render(<ProgressBar currentStep={3} totalSteps={7} />);
    const progressFill = container.querySelector('[style*="width"]');
    expect(progressFill).toBeTruthy();
    // (3+1)/7 * 100 ≈ 57.14%
    const style = progressFill?.getAttribute('style') || '';
    expect(style).toContain('57.14');
  });
});
