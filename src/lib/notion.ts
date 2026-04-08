import { Client } from '@notionhq/client';
import { SERVICES } from '@/data/services';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await delay(DELAY_MS);
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error && 'status' in error && (error as { status: number }).status === 429;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) throw error;

      // Exponential backoff
      const backoff = isRateLimit
        ? DELAY_MS * Math.pow(2, attempt + 1)
        : 1000 * (attempt + 1);
      await delay(backoff);
    }
  }
  throw new Error('Max retries exceeded');
}

export interface SubmitResult {
  success: boolean;
  pageId?: string;
  pin?: string;
  taskResults?: { team: string; success: boolean; error?: string }[];
}

export async function createMainRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_MAIN_DB_ID;
  if (!dbId) throw new Error('NOTION_MAIN_DB_ID not configured');

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: buildMainProperties(data) as any,
    })
  );

  return response.id;
}

export async function createTaskRecord(
  task: {
    title: string;
    team: string;
    clinicName: string;
    detail: string;
    parentId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const dbId = process.env.NOTION_TASK_DB_ID;
  if (!dbId) return { success: false, error: 'NOTION_TASK_DB_ID not configured' };

  try {
    await withRetry(() =>
      notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          title: { title: [{ text: { content: task.title } }] },
          '팀': { select: { name: task.team } },
          '상태': { select: { name: '대기' } },
          '거래처': { rich_text: [{ text: { content: task.clinicName } }] },
          '상세내용': { rich_text: [{ text: { content: task.detail } }] },
          '생성일': { date: { start: new Date().toISOString().split('T')[0] } },
        },
      })
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_CHANGE_DB_ID;
  if (!dbId) throw new Error('NOTION_CHANGE_DB_ID not configured');

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        title: { title: [{ text: { content: (data.clinicName as string) || '' } }] },
        '원장명': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
        '현재상품': { multi_select: ((data.currentServices as string[]) || []).map(s => ({ name: s })) },
        '추가상품': { multi_select: ((data.addServices as string[]) || []).map(s => ({ name: s })) },
        '축소상품': { multi_select: ((data.removeServices as string[]) || []).map(s => ({ name: s })) },
        '변경사유': { rich_text: [{ text: { content: (data.reason as string) || '' } }] },
        '변경유형': { select: { name: (() => {
          const add = ((data.addServices as string[]) || []).length;
          const remove = ((data.removeServices as string[]) || []).length;
          if (add > 0 && remove > 0) return '서비스 변경';
          if (remove > 0) return '서비스 축소';
          return '서비스 추가';
        })() } },
        '처리상태': { select: { name: '접수' } },
        '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
  );

  return response.id;
}

// 메인 거래처DB에서 치과명으로 페이지 조회 → pageId + 진료시간 반환
async function findClinicInMainDB(
  clinicName: string
): Promise<{ pageId: string; clinicHours: string } | null> {
  const dbId = process.env.NOTION_MAIN_DB_ID;
  if (!dbId || !clinicName) return null;
  try {
    const res = await withRetry(() =>
      notion.search({
        query: clinicName,
        filter: { value: 'page', property: 'object' },
        page_size: 10,
      })
    );
    // 메인 DB 소속 페이지 중 제목이 정확히 일치하는 것 찾기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = (res.results as any[]).find((p) => {
      if (p.parent?.database_id?.replace(/-/g, '') !== dbId.replace(/-/g, '')) return false;
      const titleArr = p.properties?.['이름']?.title || p.properties?.['title']?.title || [];
      const title = titleArr[0]?.plain_text || '';
      return title === clinicName;
    });
    if (!match) return null;
    return { pageId: match.id, clinicHours: '' };
  } catch {
    return null;
  }
}

export async function createScheduleChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_SCHEDULE_DB_ID;
  if (!dbId) throw new Error('NOTION_SCHEDULE_DB_ID not configured');

  const scheduleData = (data.scheduleData as string) || '';
  const printSizes = (data.printSizes as string[]) || [];
  const dateSchedulesRaw = (data.dateSchedulesRaw as Record<string, string[]>) || {};
  const holidayReason = (data.holidayReason as string) || '';

  // 메인 거래처DB에서 해당 치과 조회 (진료시간 가져오기 + Relation 연결)
  const clinicInfo = await findClinicInMainDB((data.clinicName as string) || '');

  // 태그별로 날짜 분류
  const TAG_TYPES = ['휴진', '토요일진료', '일요일진료', '오전진료', '오후진료', '야간진료', '공휴일진료'] as const;

  const tagToDates: Record<string, string[]> = {};
  for (const tag of TAG_TYPES) tagToDates[tag] = [];

  for (const [dateStr, tags] of Object.entries(dateSchedulesRaw)) {
    const day = parseInt(dateStr.split('-')[2]);
    const label = `${day}일`;
    for (const tag of tags as string[]) {
      if (tagToDates[tag]) {
        tagToDates[tag].push(label);
      }
    }
  }

  const sortDates = (arr: string[]) => arr.sort((a, b) => parseInt(a) - parseInt(b)).join(', ');

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: {
        title: { title: [{ text: { content: (data.clinicName as string) || '' } }] },
        '거래처명': { select: { name: (data.clinicName as string) || '' } },
        '성함': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
        '대상월': { rich_text: [{ text: { content: (data.targetMonth as string) || '' } }] },
        '일정데이터': scheduleData ? { rich_text: [{ text: { content: scheduleData.substring(0, 2000) } }] } : undefined,
        '이벤트': data.events ? { rich_text: [{ text: { content: (data.events as string) } }] } : undefined,
        '출력사이즈': printSizes.length > 0 ? { multi_select: printSizes.map((s) => ({ name: s })) } : undefined,
        '기타요청': data.extraRequest ? { rich_text: [{ text: { content: (data.extraRequest as string) } }] } : undefined,
        '처리상태': { select: { name: '접수' } },
        '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
        // 메인 거래처DB와 관계 연결 (Notion에 '거래처' Relation 속성 필요)
        ...(clinicInfo ? { '거래처': { relation: [{ id: clinicInfo.pageId }] } } : {}),
        // 진료시간은 담당자가 거래처DB에서 직접 수정 (자동 조회 제외)
        // 휴진 사유
        '휴진사유': holidayReason ? { rich_text: [{ text: { content: holidayReason } }] } : undefined,
        '휴진일': tagToDates['휴진'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['휴진']) } }] } : undefined,
        '토요일진료': tagToDates['토요일진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['토요일진료']) } }] } : undefined,
        '일요일진료': tagToDates['일요일진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['일요일진료']) } }] } : undefined,
        '오전진료': tagToDates['오전진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['오전진료']) } }] } : undefined,
        '오후진료': tagToDates['오후진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['오후진료']) } }] } : undefined,
        '야간진료': tagToDates['야간진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['야간진료']) } }] } : undefined,
        '공휴일진료': tagToDates['공휴일진료'].length > 0 ? { rich_text: [{ text: { content: sortDates(tagToDates['공휴일진료']) } }] } : undefined,
      } as any,
    })
  );

  return response.id;
}

export async function getPageData(pageId: string): Promise<Record<string, unknown> | null> {
  try {
    const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }));
    return page as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildMainProperties(data: Record<string, unknown>): Record<string, unknown> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const s5 = (data.step5 || {}) as Record<string, unknown>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;

  const region = (s1.region || {}) as Record<string, string>;

  return {
    title: { title: [{ text: { content: (s1.clinicName as string) || '' } }] },
    '원장명': { rich_text: [{ text: { content: (s1.doctorName as string) || '' } }] },
    '개원예정일': s1.openDate ? { date: { start: s1.openDate as string } } : undefined,
    '지역(시도)': region.city ? { select: { name: region.city } } : undefined,
    '지역(구군)': region.district ? { select: { name: region.district } } : undefined,
    '지역(동)': region.dong ? { rich_text: [{ text: { content: region.dong } }] } : undefined,
    '주소': s1.address ? { rich_text: [{ text: { content: s1.address as string } }] } : undefined,
    '대표전화': s1.phone ? { rich_text: [{ text: { content: s1.phone as string } }] } : undefined,
    '팩스번호': s1.fax ? { rich_text: [{ text: { content: s1.fax as string } }] } : undefined,
    '가오픈예정일': s1.softOpenDate ? { date: { start: s1.softOpenDate as string } } : undefined,
    '인테리어완료일': s1.interiorCompleteDate ? { date: { start: s1.interiorCompleteDate as string } } : undefined,
    '사진촬영가능일': s1.photoDate ? { date: { start: s1.photoDate as string } } : undefined,
    '총의료진수': s1.doctorCount ? { number: s1.doctorCount as number } : undefined,
    '진료과목': { multi_select: ((s2.dentalSubjects as string[]) || []).map(s => ({ name: s })) },
    '주력진료': { multi_select: ((s2.topSubjects as string[]) || []).map(s => ({ name: s })) },
    '진료시간': (() => {
      const schedule = (s2.schedule || {}) as Record<string, { enabled: boolean; start: string; end: string }>;
      const lines = Object.entries(schedule)
        .filter(([, v]) => v.enabled)
        .map(([day, v]) => `${day} ${v.start}~${v.end}`);
      return lines.length > 0 ? { rich_text: [{ text: { content: lines.join(', ') } }] } : undefined;
    })(),
    '점심시간': (() => {
      const lunch = (s2.lunchTime || {}) as { start?: string; end?: string };
      return lunch.start && lunch.end ? { rich_text: [{ text: { content: `${lunch.start}~${lunch.end}` } }] } : undefined;
    })(),
    '공휴일휴진': { checkbox: (s2.holidayClose as boolean) || false },
    '야간주말진료': s2.nightWeekend ? { rich_text: [{ text: { content: s2.nightWeekend as string } }] } : undefined,
    '체어수': s3.chairs ? { number: s3.chairs as number } : undefined,
    '장비': { multi_select: ((s3.equipment as string[]) || []).map(s => ({ name: s })) },
    '시설': { multi_select: ((s3.facilities as string[]) || []).map(s => ({ name: s })) },
    '주차': (s3.parking as Record<string, string>)?.available ? { select: { name: (s3.parking as Record<string, string>).available } } : undefined,
    '주차상세': (s3.parking as Record<string, string>)?.detail ? { rich_text: [{ text: { content: (s3.parking as Record<string, string>).detail } }] } : undefined,
    '인테리어': s3.interiorStyle ? { rich_text: [{ text: { content: s3.interiorStyle as string } }] } : undefined,
    '임플란트제품사': { multi_select: ((s3.implantBrands as string[]) || []).map(s => ({ name: s })) },
    '기공소보유': { checkbox: (s3.hasLabRoom as boolean) || false },
    '기공소장비': { multi_select: ((s3.labEquipment as string[]) || []).map(s => ({ name: s })) },
    '한줄소개': s4.oneLiner ? { rich_text: [{ text: { content: s4.oneLiner as string } }] } : undefined,
    '진료철학': s4.philosophy ? { rich_text: [{ text: { content: s4.philosophy as string } }] } : undefined,
    '타겟환자': s4.targetPatients ? { rich_text: [{ text: { content: s4.targetPatients as string } }] } : undefined,
    '차별점': s4.differentiator ? { rich_text: [{ text: { content: s4.differentiator as string } }] } : undefined,
    '원장경력': s4.doctorCareer ? { rich_text: [{ text: { content: s4.doctorCareer as string } }] } : undefined,
    '프로필사진보유': { checkbox: (s4.hasProfilePhoto as boolean) || false },
    '봉직의정보': (() => {
      const docs = (s4.additionalDoctors as {name:string;title:string;specialty:string}[]) || [];
      if (docs.length === 0) return undefined;
      const text = docs.map(d => `${d.name} ${d.title}${d.specialty ? ` (${d.specialty})` : ''}`).join(', ');
      return { rich_text: [{ text: { content: text } }] };
    })(),
    '유입경로': { multi_select: ((s5.referralSource as string[]) || []).map(s => ({ name: s })) },
    '이전마케팅': s5.previousMarketing ? { rich_text: [{ text: { content: s5.previousMarketing as string } }] } : undefined,
    '예산범위': s5.budgetRange ? { select: { name: s5.budgetRange as string } } : undefined,
    '마케팅목표': { multi_select: ((s5.marketingGoals as string[]) || []).map(s => ({ name: s })) },
    '원하는채널': { multi_select: ((s5.desiredChannels as string[]) || []).map(s => ({ name: s })) },
    '추가요청': s5.additionalRequest ? { rich_text: [{ text: { content: s5.additionalRequest as string } }] } : undefined,
    '벤치마킹병원': s5.benchmarkClinics ? { rich_text: [{ text: { content: s5.benchmarkClinics as string } }] } : undefined,
    '개원이벤트': s5.openingEvent ? { rich_text: [{ text: { content: s5.openingEvent as string } }] } : undefined,
    '계약서비스': (() => {
      const services = (s6.services || []) as { serviceId: string; quantity?: number }[];
      if (services.length === 0) return undefined;
      return { multi_select: services.map((s) => {
        const svc = SERVICES.find((sv) => sv.id === s.serviceId);
        return { name: svc?.name || s.serviceId };
      })};
    })(),
    '서비스수량': (() => {
      const services = (s6.services || []) as { serviceId: string; quantity?: number }[];
      const withQty = services.filter(s => s.quantity);
      if (withQty.length === 0) return undefined;
      const text = withQty.map((s) => {
        const svc = SERVICES.find((sv) => sv.id === s.serviceId);
        return `${svc?.name || s.serviceId} ${s.quantity}${svc?.unit || ''}`;
      }).join(', ');
      return { rich_text: [{ text: { content: text } }] };
    })(),
    '초기개원패키지': { checkbox: (s6.isStarterPackage as boolean) || false },
    '계약시작일': s6.contractStartDate ? { date: { start: s6.contractStartDate as string } } : undefined,
    '월계약금': s6.monthlyFee ? { rich_text: [{ text: { content: s6.monthlyFee as string } }] } : undefined,
    '특이사항': s6.specialNotes ? { rich_text: [{ text: { content: s6.specialNotes as string } }] } : undefined,
    'DID설치대수': s6.didCount ? { number: s6.didCount as number } : undefined,
    'DID위치정보': s6.didInfo ? { rich_text: [{ text: { content: s6.didInfo as string } }] } : undefined,
    '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
  };
}
