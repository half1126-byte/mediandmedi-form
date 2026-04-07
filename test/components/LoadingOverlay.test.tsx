import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingOverlay from '@/components/LoadingOverlay';

describe('LoadingOverlay', () => {
  it('show=false일 때 렌더링 안 함', () => {
    const { container } = render(<LoadingOverlay show={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('show=true일 때 렌더링', () => {
    render(<LoadingOverlay show={true} />);
    expect(screen.getByText('거래처 정보 저장 중...')).toBeInTheDocument();
  });

  it('커스텀 스텝 표시', () => {
    render(
      <LoadingOverlay
        show={true}
        steps={['1단계', '2단계', '완료']}
        currentStepIndex={1}
      />
    );
    expect(screen.getByText('1단계')).toBeInTheDocument();
    expect(screen.getByText('2단계')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });

  it('마지막 스텝일 때 체크 아이콘 표시', () => {
    const { container } = render(
      <LoadingOverlay
        show={true}
        steps={['저장 중', '완료!']}
        currentStepIndex={1}
      />
    );
    // 마지막 스텝이면 spinner 대신 체크 아이콘
    const checkCircle = container.querySelector('.bg-\\[\\#16A34A\\]');
    expect(checkCircle).toBeTruthy();
  });
});
