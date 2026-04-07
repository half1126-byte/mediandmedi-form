import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChipSelector from '@/components/ChipSelector';

describe('ChipSelector', () => {
  const options = ['충치치료', '임플란트', '치아미백'];

  it('모든 옵션 렌더링', () => {
    render(<ChipSelector options={options} selected={[]} onChange={() => {}} />);
    options.forEach((opt) => {
      expect(screen.getByText(opt)).toBeInTheDocument();
    });
  });

  it('클릭 시 선택 토글', () => {
    const onChange = vi.fn();
    render(<ChipSelector options={options} selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('충치치료'));
    expect(onChange).toHaveBeenCalledWith(['충치치료']);
  });

  it('이미 선택된 항목 클릭 시 해제', () => {
    const onChange = vi.fn();
    render(
      <ChipSelector options={options} selected={['충치치료']} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('충치치료'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('max 제한', () => {
    const onChange = vi.fn();
    render(
      <ChipSelector
        options={options}
        selected={['충치치료', '임플란트']}
        onChange={onChange}
        max={2}
      />
    );
    fireEvent.click(screen.getByText('치아미백'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('multiple=false: 하나만 선택', () => {
    const onChange = vi.fn();
    render(
      <ChipSelector
        options={options}
        selected={['충치치료']}
        onChange={onChange}
        multiple={false}
      />
    );
    fireEvent.click(screen.getByText('임플란트'));
    expect(onChange).toHaveBeenCalledWith(['임플란트']);
  });

  it('multiple=false: 같은 항목 클릭 → 빈 배열', () => {
    const onChange = vi.fn();
    render(
      <ChipSelector
        options={options}
        selected={['충치치료']}
        onChange={onChange}
        multiple={false}
      />
    );
    fireEvent.click(screen.getByText('충치치료'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('선택된 칩에 올바른 스타일 적용', () => {
    render(
      <ChipSelector options={options} selected={['충치치료']} onChange={() => {}} />
    );
    const selectedBtn = screen.getByText('충치치료');
    expect(selectedBtn.className).toContain('bg-[#2563EB]');
    expect(selectedBtn.className).toContain('text-white');
  });

  it('터치 타겟 44px 이상', () => {
    render(<ChipSelector options={options} selected={[]} onChange={() => {}} />);
    const btn = screen.getByText('충치치료');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });
});
