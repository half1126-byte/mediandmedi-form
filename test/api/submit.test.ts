import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/submit/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/submit', () => {
  it('데모 모드에서 성공 응답', async () => {
    const req = makeRequest({ pin: '1234', formData: {} });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.pageId).toMatch(/^demo-/);
    expect(json.pin).toBe('1234');
    expect(json.demo).toBe(true);
  });

  it('PIN이 응답에 포함됨', async () => {
    const req = makeRequest({ pin: '5678' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.pin).toBe('5678');
  });

  it('매번 다른 pageId 생성', async () => {
    const req1 = makeRequest({ pin: '1111' });
    const res1 = await POST(req1);
    const json1 = await res1.json();
    // Date.now() 기반이라 약간의 딜레이 필요
    await new Promise((r) => setTimeout(r, 10));
    const req2 = makeRequest({ pin: '2222' });
    const res2 = await POST(req2);
    const json2 = await res2.json();
    expect(json1.pageId).not.toBe(json2.pageId);
  });

  it('잘못된 JSON 시 500 에러', async () => {
    const req = new NextRequest('http://localhost:3000/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
