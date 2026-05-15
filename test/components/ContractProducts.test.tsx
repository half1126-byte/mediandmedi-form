import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContractProducts from '@/components/ContractProducts';

describe('ContractProducts', () => {
  it('팀별 서비스 그룹 렌더링', () => {
    render(<ContractProducts selected={[]} onChange={() => {}} />);
    expect(screen.getByText('마케팅팀')).toBeInTheDocument();
    expect(screen.getByText('바이럴팀')).toBeInTheDocument();
    expect(screen.getByText('디자인팀')).toBeInTheDocument();
  });

  it('서비스명 표시', () => {
    render(<ContractProducts selected={[]} onChange={() => {}} />);
    expect(screen.getByText('카페 바이럴')).toBeInTheDocument();
    expect(screen.getByText('임상 블로그')).toBeInTheDocument();
    expect(screen.getByText('사진촬영')).toBeInTheDocument();
  });

  it('서비스 선택/해제 토글', () => {
    const onChange = vi.fn();
    render(<ContractProducts selected={[]} onChange={onChange} />);

    // 첫 번째 서비스(마케팅팀 > 플레이스 상위노출)의 체크박스 버튼 클릭
    const buttons = screen.getAllByRole('button');
    const firstBtn = buttons[0];
    fireEvent.click(firstBtn);

    expect(onChange).toHaveBeenCalledWith([{ serviceId: 'place-top' }]);
  });

  it('수량 입력 필드는 hasQuantity=true일 때만 표시', () => {
    render(
      <ContractProducts
        selected={[{ serviceId: 'cafe-viral' }, { serviceId: 'web-homepage-build' }]}
        onChange={() => {}}
      />
    );
    // cafe-viral은 hasQuantity=true → 수량 입력 있음
    // web-homepage-build는 hasQuantity=false → 수량 입력 없음
    const numberInputs = screen.getAllByPlaceholderText('수량');
    expect(numberInputs.length).toBe(1); // cafe-viral만
  });
});
