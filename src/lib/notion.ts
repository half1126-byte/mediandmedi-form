import { Client } from '@notionhq/client';

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
        '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
      },
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
    '진료과목': { multi_select: ((s2.dentalSubjects as string[]) || []).map(s => ({ name: s })) },
    '주력진료': { multi_select: ((s2.topSubjects as string[]) || []).map(s => ({ name: s })) },
    '공휴일휴진': { checkbox: (s2.holidayClose as boolean) || false },
    '야간주말진료': s2.nightWeekend ? { rich_text: [{ text: { content: s2.nightWeekend as string } }] } : undefined,
    '체어수': s3.chairs ? { number: s3.chairs as number } : undefined,
    '장비': { multi_select: ((s3.equipment as string[]) || []).map(s => ({ name: s })) },
    '시설': { multi_select: ((s3.facilities as string[]) || []).map(s => ({ name: s })) },
    '주차': (s3.parking as Record<string, string>)?.available ? { select: { name: (s3.parking as Record<string, string>).available } } : undefined,
    '인테리어': s3.interiorStyle ? { rich_text: [{ text: { content: s3.interiorStyle as string } }] } : undefined,
    '한줄소개': s4.oneLiner ? { rich_text: [{ text: { content: s4.oneLiner as string } }] } : undefined,
    '진료철학': s4.philosophy ? { rich_text: [{ text: { content: s4.philosophy as string } }] } : undefined,
    '타겟환자': s4.targetPatients ? { rich_text: [{ text: { content: s4.targetPatients as string } }] } : undefined,
    '차별점': s4.differentiator ? { rich_text: [{ text: { content: s4.differentiator as string } }] } : undefined,
    '원장경력': s4.doctorCareer ? { rich_text: [{ text: { content: s4.doctorCareer as string } }] } : undefined,
    '프로필사진보유': { checkbox: (s4.hasProfilePhoto as boolean) || false },
    '유입경로': { multi_select: ((s5.referralSource as string[]) || []).map(s => ({ name: s })) },
    '이전마케팅': s5.previousMarketing ? { rich_text: [{ text: { content: s5.previousMarketing as string } }] } : undefined,
    '예산범위': s5.budgetRange ? { select: { name: s5.budgetRange as string } } : undefined,
    '마케팅목표': { multi_select: ((s5.marketingGoals as string[]) || []).map(s => ({ name: s })) },
    '원하는채널': { multi_select: ((s5.desiredChannels as string[]) || []).map(s => ({ name: s })) },
    '초기개원패키지': { checkbox: (s6.isStarterPackage as boolean) || false },
    '계약시작일': s6.contractStartDate ? { date: { start: s6.contractStartDate as string } } : undefined,
    '월계약금': s6.monthlyFee ? { rich_text: [{ text: { content: s6.monthlyFee as string } }] } : undefined,
    '특이사항': s6.specialNotes ? { rich_text: [{ text: { content: s6.specialNotes as string } }] } : undefined,
    '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
  };
}
