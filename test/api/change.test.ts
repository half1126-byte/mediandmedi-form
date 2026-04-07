import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/change/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/change', () => {
  it('유효한 요청 시 성공', async () => {
    const req = makeRequest({
      clinicName: '해피치과',
      doctorName: '김행복',
      reason: '서비스 추가',
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.pageId).toMatch(/^change-/);
    expect(json.demo).toBe(true);
  });

  it('필수 항목 누락 시 400 에러', async () => {
    const req = makeRequest({
      clinicName: '해피치과',
      doctorName: '',
      reason: '',
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('필수 항목 누락');
  });

  it('치과명 누락 시 400', async () => {
    const req = makeRequest({
      clinicName: '',
      doctorName: '김행복',
      reason: '테스트',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('사유 누락 시 400', async () => {
    const req = makeRequest({
      clinicName: '해피치과',
      doctorName: '김행복',
      reason: '',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
