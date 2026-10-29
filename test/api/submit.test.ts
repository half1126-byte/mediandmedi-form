import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/submit/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step2: { holidayClose: true, schedule: Object.fromEntries(['월','화','수','목','금','토','일'].map(day => [day, { enabled: true, start: '09:00', end: '18:00' }])) }, step3: { equipment: ['치과용 CT'], facilities: ['없음'], parking: { available: '불가' }, hasLabRoom: false, labRoomAnswered: true }, stepDesign: { avoidColor: '없음' }, step4: { brandTone: '신뢰감', brandColorTones: ['블루'], education: '테스트대 졸업', career: '테스트병원 근무' }, ...body }),
  });
}

describe('POST /api/submit', () => {
  it.each([{ education: '', career: '경력' }, { education: '학력', career: '   ' }, { driveLink: 'https://example.com/profile' }])('학력·경력 누락 또는 링크만 입력하면 거부', async (step4) => {
    const res = await POST(makeRequest({ step1: { clinicName: '테스트', phone: '02-1234-5678', address: '서울' }, step4 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('학력과 경력은 필수입니다.');
  });
  it.each([undefined, '', '   '])('상세 주소 누락 시 거부 (%s)', async (address) => {
    const res = await POST(makeRequest({ step1: { clinicName: '테스트치과', phone: '02-1234-5678', address } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('상세 주소는 필수입니다.');
  });
  it.each([undefined, '', '   '])('대표전화 누락 시 거부 (%s)', async (phone) => {
    const res = await POST(makeRequest({ step1: { clinicName: '테스트치과', phone } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('대표전화는 필수입니다.');
  });
  it('노션 연결이 없으면 성공으로 처리하지 않는다', async () => {
    const res = await POST(makeRequest({ pin: '1234', step1: { clinicName: '테스트치과', phone: '02-1234-5678', address: '서울' } }));
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.success).toBe(false);
    expect(json.pageId).toBeUndefined();
    expect(json.error).toContain('노션 연결 설정');
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
