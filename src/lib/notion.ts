import { Client } from '@notionhq/client';
import { SERVICES } from '@/data/services';

const authKey = process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;

if (!authKey) {
  console.warn('[notion] NOTION_MEETING_API_KEY/NOTION_API_KEY 환경변수 미설정 — Notion 연동 비활성');
}

const notion = new Client({
  auth: authKey || '',
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

/**
 * 거래처DB("DB 개발" 워크스페이스)에 신규개원 폼 데이터 페이지 생성.
 * 폼이 보내는 필드 대부분이 이미 거래처DB의 컬럼으로 존재하므로 properties로 매핑한다.
 * 컬럼에 매핑이 안 되는 자유 텍스트(의료진 명단, 진료시간 상세 등)는 본문 blocks으로 보존.
 */
export async function createMainRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_MAIN_DB_ID;
  if (!dbId) throw new Error('NOTION_MAIN_DB_ID not configured');

  const coreProps = buildMainProperties(data);
  const children = buildMainPageChildren(data);

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: coreProps as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: children as any,
    })
  );

  return response.id;
}

/**
 * 업무DB("DB 개발" 워크스페이스)에 팀별 자동 업무 페이지 생성.
 * 폼이 보내는 team(마케팅팀/바이럴팀/디자인팀/웹팀) → 업무DB "카테고리" select
 * parentId(거래처 페이지 ID) → "관련거래처" relation
 */
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
          '업무명': { title: [{ text: { content: task.title } }] },
          '카테고리': { select: { name: task.team } },
          '업무상태': { status: { name: '대기' } },
          '관련거래처': { relation: [{ id: task.parentId }] },
          '내용': { rich_text: [{ text: { content: task.detail.substring(0, 1900) } }] },
          '작성자': { rich_text: [{ text: { content: '신규개원 자동' } }] },
          '생성일': { date: { start: today() } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
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

/**
 * OLD 팀스페이스 홈 거래처 DB ID — 미팅 DB의 거래처 relation이 이곳을 참조.
 * 거래처 데이터 마이그레이션 끝나면 미팅 DB의 relation도 DB 개발 거래처DB로 전환해야 함.
 */
const LEGACY_CLINICS_DB_ID = '3539a82d-b9c4-8174-ada9-c2269dea9515';

/**
 * 계약변경 폼 → 미팅 DB("미팅 기록")에 미팅 유형=계약변경 페이지 생성.
 * 미팅 DB는 사용자 운영 정본이라 계약 변경도 미팅 형식으로 기록.
 * 거래처명으로 OLD 거래처 DB 검색해 relation 연결 (매칭 실패 시 relation 없이 페이지만 생성).
 */
export async function createChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_CHANGE_DB_ID;
  if (!dbId) throw new Error('NOTION_CHANGE_DB_ID not configured');

  const clinicName = (data.clinicName as string) || '';
  const doctorName = (data.doctorName as string) || '';
  const reason = (data.reason as string) || '';
  const currentServices = (data.currentServices as string[]) || [];
  const addServices = (data.addServices as string[]) || [];
  const removeServices = (data.removeServices as string[]) || [];
  const changeType =
    addServices.length > 0 && removeServices.length > 0 ? '서비스 변경' :
    removeServices.length > 0 ? '서비스 축소' :
    '서비스 추가';

  const agendaLines: string[] = [];
  if (currentServices.length > 0) agendaLines.push(`현재 서비스: ${currentServices.join(', ')}`);
  if (addServices.length > 0) agendaLines.push(`추가 요청: ${addServices.join(', ')}`);
  if (removeServices.length > 0) agendaLines.push(`축소 요청: ${removeServices.join(', ')}`);
  agendaLines.push(`변경 유형: ${changeType}`);
  const agendaText = agendaLines.join('\n');

  const dateStr = today();
  const clinicPageId = clinicName ? await findClinicInDb(clinicName, LEGACY_CLINICS_DB_ID) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '미팅 제목': { title: [{ text: { content: `[계약변경] ${clinicName} · ${dateStr}` } }] },
    '미팅 유형': { select: { name: '계약변경' } },
    '일자': { date: { start: dateStr } },
    '참석자(외부)': { rich_text: [{ text: { content: doctorName } }] },
    '주요 안건': { rich_text: [{ text: { content: agendaText.substring(0, 1900) } }] },
    '핵심 결정사항': { rich_text: [{ text: { content: reason.substring(0, 1900) } }] },
    '액션 아이템': { rich_text: [{ text: { content: '마케팅팀 검토 → 계약상품 DB 반영' } }] },
    '상태': { status: { name: '시작 전' } },
  };
  if (clinicPageId) {
    properties['거래처'] = { relation: [{ id: clinicPageId }] };
  }

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      properties,
    })
  );

  return response.id;
}

/**
 * 거래처명으로 임의의 거래처 DB에서 페이지 검색 → page ID 반환.
 * title 컬럼명이 "거래처명"인 DB 가정.
 */
async function findClinicInDb(clinicName: string, dbId: string): Promise<string | null> {
  if (!dbId || !clinicName) return null;
  try {
    const res = await withRetry(() =>
      notion.search({
        query: clinicName,
        filter: { value: 'page', property: 'object' },
        page_size: 10,
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = (res.results as any[]).find((p) => {
      if (p.parent?.database_id?.replace(/-/g, '') !== dbId.replace(/-/g, '')) return false;
      const titleArr = p.properties?.['거래처명']?.title || p.properties?.['title']?.title || [];
      const title = titleArr[0]?.plain_text || '';
      return title === clinicName;
    });
    return match ? match.id : null;
  } catch {
    return null;
  }
}

/**
 * 거래처명으로 신 거래처DB(DB 개발)에서 페이지 검색.
 * 신규개원·진료일정 변경 등 신 DB 기반 폼에서 사용.
 */
async function findClinicByName(clinicName: string): Promise<string | null> {
  const dbId = process.env.NOTION_MAIN_DB_ID;
  if (!dbId) return null;
  return findClinicInDb(clinicName, dbId);
}

/**
 * 진료일정 DB("DB 개발" 워크스페이스)에 폼 데이터 페이지 생성.
 * 폼이 보내는 휴진일/요일진료/공휴일진료를 신 DB 컬럼에 매핑.
 * 작업명(title)은 "{거래처명} - {대상월}" 형식, 거래처 relation 자동 연결.
 */
export async function createScheduleChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_SCHEDULE_DB_ID;
  if (!dbId) throw new Error('NOTION_SCHEDULE_DB_ID not configured');

  const clinicName = (data.clinicName as string) || '';
  const targetMonth = (data.targetMonth as string) || '';
  const scheduleData = (data.scheduleData as string) || '';
  const printSizes = (data.printSizes as string[]) || [];
  const dateSchedulesRaw = (data.dateSchedulesRaw as Record<string, string[]>) || {};
  const holidayReason = (data.holidayReason as string) || '';

  const clinicPageId = clinicName ? await findClinicByName(clinicName) : null;

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

  const sortDates = (arr: string[]) =>
    arr.sort((a, b) => parseInt(a) - parseInt(b)).join(', ');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '작업명': {
      title: [{ text: { content: targetMonth ? `${clinicName} - ${targetMonth}` : clinicName } }],
    },
    '성함': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
    '제출일': { date: { start: today() } },
    '처리상태_폼': { select: { name: '접수' } },
  };

  // 대상연도/월: "2026-06" 형식 → 2026, 6 추출
  if (targetMonth) {
    const ym = targetMonth.match(/^(\d{4})-?(\d{1,2})$/);
    if (ym) {
      properties['대상연도'] = { select: { name: ym[1] } };
      properties['대상 월'] = { select: { name: String(parseInt(ym[2])) } };
    }
  }

  if (clinicPageId) {
    properties['거래처'] = { relation: [{ id: clinicPageId }] };
  }
  if (scheduleData) {
    properties['일정데이터'] = { rich_text: [{ text: { content: scheduleData.substring(0, 1900) } }] };
  }
  if (data.events) {
    properties['이벤트'] = { rich_text: [{ text: { content: data.events as string } }] };
  }
  if (printSizes.length > 0) {
    properties['출력사이즈'] = { multi_select: printSizes.map((s) => ({ name: s })) };
  }
  if (data.extraRequest) {
    properties['기타요청'] = { rich_text: [{ text: { content: data.extraRequest as string } }] };
  }
  if (holidayReason) {
    properties['휴진사유'] = { rich_text: [{ text: { content: holidayReason } }] };
  }
  if (tagToDates['휴진'].length > 0) properties['휴진일'] = textProp(sortDates(tagToDates['휴진']));
  if (tagToDates['토요일진료'].length > 0) properties['토요일진료'] = textProp(sortDates(tagToDates['토요일진료']));
  if (tagToDates['일요일진료'].length > 0) properties['일요일진료'] = textProp(sortDates(tagToDates['일요일진료']));
  if (tagToDates['오전진료'].length > 0) properties['오전진료'] = textProp(sortDates(tagToDates['오전진료']));
  if (tagToDates['오후진료'].length > 0) properties['오후진료'] = textProp(sortDates(tagToDates['오후진료']));
  if (tagToDates['야간진료'].length > 0) properties['야간진료_변경'] = textProp(sortDates(tagToDates['야간진료']));
  if (tagToDates['공휴일진료'].length > 0) properties['공휴일진료'] = textProp(sortDates(tagToDates['공휴일진료']));

  const response = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: dbId },
      properties,
    })
  );

  return response.id;
}

function textProp(content: string) {
  return { rich_text: [{ text: { content } }] };
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Notion 페이지 단건 조회. 존재하지 않거나 권한 없을 때 null 반환.
 */
export async function getPageData(pageId: string): Promise<unknown | null> {
  try {
    return await withRetry(() => notion.pages.retrieve({ page_id: pageId }));
  } catch {
    return null;
  }
}

/**
 * "DB 개발" 거래처DB 컬럼에 신규개원 폼 데이터 매핑.
 * 신규 페이지는 관계유형=클라이언트, 업종=치과, 상태=계약전로 자동 분류.
 */
function buildMainProperties(data: Record<string, unknown>): Record<string, unknown> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const s5 = (data.step5 || {}) as Record<string, unknown>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;
  const region = (s1.region || {}) as Record<string, string>;

  const addressParts = [region.district, region.dong, s1.address as string]
    .filter(Boolean)
    .join(' ');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    '거래처명': { title: [{ text: { content: (s1.clinicName as string) || '' } }] },
    '원장명': { rich_text: [{ text: { content: (s1.doctorName as string) || '' } }] },
    '관계유형': { select: { name: '클라이언트' } },
    '업종': { select: { name: '치과' } },
    '상태': { status: { name: '계약전' } },
    '폼 제출일': { date: { start: today() } },
  };

  // step1
  if (s1.openDate) {
    props['개원예정일'] = { date: { start: s1.openDate as string } };
  }
  if (region.city) {
    const regionParts = [region.city, region.district, region.dong].filter(Boolean).join(' ');
    props['지역'] = { rich_text: [{ text: { content: regionParts } }] };
  }
  if (addressParts) {
    props['주소'] = { rich_text: [{ text: { content: addressParts } }] };
  }
  if (s1.phone) {
    props['대표 전화'] = { rich_text: [{ text: { content: s1.phone as string } }] };
  }
  // 의료진 요약 → 의료진 rich_text
  const doctors = (s1.doctors as { name: string; title: string; specialty: string }[]) || [];
  if (doctors.length > 0) {
    const summary = doctors
      .map((d) => `${d.name || '미입력'} · ${d.title}${d.specialty ? ` (${d.specialty})` : ''}`)
      .join(' / ');
    props['의료진'] = { rich_text: [{ text: { content: summary.substring(0, 1900) } }] };
  }

  // step2 — 진료
  const dentalSubjects = (s2.dentalSubjects as string[]) || [];
  if (dentalSubjects.length > 0) {
    props['진료과목'] = { multi_select: dentalSubjects.map((s) => ({ name: s })) };
  }
  const topSubjects = (s2.topSubjects as string[]) || [];
  if (topSubjects.length > 0) {
    props['주력진료'] = { multi_select: topSubjects.map((s) => ({ name: s })) };
  }
  // 임플란트 재료 → 제조사 multi_select (재료 상세는 본문 blocks)
  const implant = (s2.implantMaterials as Record<string, string[]>) || {};
  const implantBrands = Object.keys(implant);
  if (implantBrands.length > 0) {
    props['임플란트 재료'] = { multi_select: implantBrands.map((b) => ({ name: b })) };
  }
  const alignerOptions = (s2.alignerOptions as string[]) || [];
  if (alignerOptions.length > 0) {
    props['교정 옵션'] = { multi_select: alignerOptions.map((s) => ({ name: s })) };
  }
  const pediatricOrthoOptions = (s2.pediatricOrthoOptions as string[]) || [];
  if (pediatricOrthoOptions.length > 0) {
    props['소아교정 옵션'] = { multi_select: pediatricOrthoOptions.map((s) => ({ name: s })) };
  }
  // 진료시간 요약
  const schedule = (s2.schedule || {}) as Record<string, { enabled: boolean; start: string; end: string }>;
  const scheduleLine = Object.entries(schedule)
    .filter(([, v]) => v.enabled)
    .map(([day, v]) => `${day} ${v.start}~${v.end}`)
    .join(', ');
  if (scheduleLine) {
    props['진료시간'] = { rich_text: [{ text: { content: scheduleLine.substring(0, 1900) } }] };
  }

  // step3 — 시설
  if (s3.chairs) {
    const n = typeof s3.chairs === 'number' ? s3.chairs : parseInt(s3.chairs as string);
    if (!isNaN(n)) props['체어수'] = { number: n };
  }
  const facilities = (s3.facilities as string[]) || [];
  if (facilities.length > 0) {
    props['시설'] = { multi_select: facilities.map((s) => ({ name: s })) };
  }

  // step4 — 브랜딩
  if (s4.oneLiner) {
    props['한줄소개'] = { rich_text: [{ text: { content: (s4.oneLiner as string).substring(0, 1900) } }] };
  }
  if (s4.brandColor) {
    props['브랜드 컬러'] = { rich_text: [{ text: { content: s4.brandColor as string } }] };
  }
  const promoParts = [s4.doctorPromo, s4.clinicPromo, s4.treatmentPromo, s4.philosophy, s4.locationTarget, s4.interiorStyle]
    .filter(Boolean)
    .join(' | ');
  if (promoParts) {
    props['홍보 포인트'] = { rich_text: [{ text: { content: promoParts.substring(0, 1900) } }] };
  }

  // step5 — 마케팅
  const referralSource = (s5.referralSource as string[]) || [];
  if (referralSource.length > 0) {
    props['소개경로'] = { multi_select: referralSource.map((s) => ({ name: s })) };
  }
  if (s5.referralName) {
    props['소개자명'] = { rich_text: [{ text: { content: s5.referralName as string } }] };
  }
  if (s5.budgetRange) {
    props['예산범위'] = { select: { name: s5.budgetRange as string } };
  }
  const marketingGoalParts = [
    (s5.marketingGoals as string[])?.join(', '),
    s5.benchmarkClinics ? `벤치마킹: ${s5.benchmarkClinics}` : '',
    s5.previousMarketing ? `이전 마케팅: ${s5.previousMarketing}` : '',
  ].filter(Boolean).join(' | ');
  if (marketingGoalParts) {
    props['마케팅 목표'] = { rich_text: [{ text: { content: marketingGoalParts.substring(0, 1900) } }] };
  }
  if (s5.didInfo) {
    props['DID 정보'] = { rich_text: [{ text: { content: s5.didInfo as string } }] };
  }
  if (s5.reviewGift) {
    props['리뷰 증정선물'] = { rich_text: [{ text: { content: s5.reviewGift as string } }] };
  }
  if (s5.channelGift) {
    props['채널 증정선물'] = { rich_text: [{ text: { content: s5.channelGift as string } }] };
  }
  const extraParts = [
    s5.openingEvent ? `개원이벤트: ${s5.openingEvent}` : '',
    s5.additionalRequest ? `추가요청: ${s5.additionalRequest}` : '',
  ].filter(Boolean).join(' | ');
  if (extraParts) {
    props['이벤트 / 추가요청'] = { rich_text: [{ text: { content: extraParts.substring(0, 1900) } }] };
  }

  // step6 — 계약
  const services = (s6.services as { serviceId: string; quantity?: number }[]) || [];
  const teamsInvolved = Array.from(
    new Set(
      services
        .map((s) => SERVICES.find((sv) => sv.id === s.serviceId)?.team as string | undefined)
        .filter((t): t is string => !!t)
    )
  );
  if (teamsInvolved.length > 0) {
    props['계약 서비스'] = { multi_select: teamsInvolved.map((t) => ({ name: t })) };
  }
  if (s6.isStarterPackage) {
    props['초기개원 패키지'] = { checkbox: true };
  }
  if (s6.contractStartDate) {
    props['거래시작일'] = { date: { start: s6.contractStartDate as string } };
  }
  if (s6.monthlyFee) {
    props['월 계약금'] = { rich_text: [{ text: { content: s6.monthlyFee as string } }] };
  }
  if (s6.specialNotes) {
    props['특이사항'] = { rich_text: [{ text: { content: (s6.specialNotes as string).substring(0, 1900) } }] };
  }

  // 파일 컬럼 (files type, external URL)
  setFiles(props, '약력 이미지', s1.careerImages);
  setFiles(props, '인테리어 도면', s3.blueprintFiles);
  setFiles(props, '로고 파일', s4.logoFiles);
  setFiles(props, '면허증', s4.licenseFiles);
  setFiles(props, '전문의 자격증', s4.certificateFiles);
  setFiles(props, '사업자등록증', s4.businessFiles);
  setFiles(props, '개설필증', s4.permitFiles);
  setFiles(props, '간판 사진', s4.signageFiles);
  setFiles(props, '현수막 사진', s4.bannerFiles);
  setFiles(props, '공사 현장 사진', s4.constructionFiles);

  return props;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function setFiles(props: any, key: string, raw: unknown): void {
  const arr = (raw as { url: string; filename: string }[] | undefined) || [];
  if (arr.length === 0) return;
  props[key] = {
    files: arr.slice(0, 25).map((f) => ({
      name: (f.filename || 'file').substring(0, 100),
      type: 'external',
      external: { url: f.url },
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 거래처 페이지 본문에는 컬럼으로 매핑 불가능한 자유 텍스트(의료진 상세, 임플란트 재료별 제품군, 추가 메모 등) 보존.
 */
function buildMainPageChildren(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;

  const blocks: Array<Record<string, unknown>> = [];

  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: '🏥 신규개원 폼으로 자동 생성된 거래처 페이지. 핵심 필드는 상단 속성에, 상세 정보는 본문에 저장됩니다.' } }],
      icon: { type: 'emoji', emoji: '🏥' },
      color: 'gray_background',
    },
  });

  // 의료진 상세
  const doctors = (s1.doctors as { name: string; title: string; specialty: string }[]) || [];
  if (doctors.length > 0) {
    blocks.push(heading('의료진'));
    doctors.forEach((d) => {
      blocks.push(bullet(`${d.name || '미입력'} · ${d.title}${d.specialty ? ` · ${d.specialty}` : ''}`));
    });
  }

  // 일정·연락
  const datesArr: string[] = [];
  if (s1.softOpenDate) datesArr.push(`가오픈 ${s1.softOpenDate}`);
  if (s1.interiorCompleteDate) datesArr.push(`인테리어 완료 ${s1.interiorCompleteDate}`);
  if (s1.photoDate) datesArr.push(`촬영 가능 ${s1.photoDate}`);
  if (s1.fax) datesArr.push(`팩스 ${s1.fax}`);
  if (datesArr.length > 0) {
    blocks.push(heading('주요 일정·연락'));
    datesArr.forEach((t) => blocks.push(bullet(t)));
  }

  // 임플란트 재료 상세 (제품군까지)
  const implant = (s2.implantMaterials as Record<string, string[]>) || {};
  const implantDetails = Object.entries(implant)
    .map(([b, ps]) => (ps.length ? `${b}: ${ps.join(', ')}` : `${b}: 전체`))
    .join('\n');
  if (implantDetails) {
    blocks.push(heading('임플란트 재료 상세'));
    implantDetails.split('\n').forEach((line) => blocks.push(bullet(line)));
  }

  // 점심·야간 등 진료 보조 정보
  const lunch = (s2.lunchTime || {}) as { start?: string; end?: string };
  const auxParts: string[] = [];
  if (lunch.start && lunch.end) auxParts.push(`점심시간: ${lunch.start}~${lunch.end}`);
  if (s2.nightWeekend) auxParts.push(`야간/주말: ${s2.nightWeekend}`);
  if (auxParts.length > 0) {
    blocks.push(heading('진료 보조 정보'));
    auxParts.forEach((t) => blocks.push(bullet(t)));
  }

  // 장비/주차/기공
  const facilityAux: string[] = [];
  if ((s3.equipment as string[])?.length) facilityAux.push(`장비: ${(s3.equipment as string[]).join(', ')}`);
  const parking = (s3.parking as Record<string, string>) || {};
  if (parking.available) facilityAux.push(`주차: ${parking.available}${parking.detail ? ` (${parking.detail})` : ''}`);
  if (s3.hasLabRoom) facilityAux.push(`기공소: 보유${(s3.labEquipment as string[])?.length ? ` (${(s3.labEquipment as string[]).join(', ')})` : ''}`);
  if (facilityAux.length > 0) {
    blocks.push(heading('장비·주차·기공'));
    facilityAux.forEach((t) => blocks.push(bullet(t)));
  }

  // 브랜딩 메모 (컬럼에 안 들어간 항목들)
  const brandAux: string[] = [];
  if (s4.hasProfilePhoto) brandAux.push('프로필 사진 보유');
  if (s4.hasLogo) brandAux.push('로고 파일 보유');
  if (brandAux.length > 0) {
    blocks.push(heading('브랜딩 메모'));
    brandAux.forEach((t) => blocks.push(bullet(t)));
  }

  // 계약 서비스 상세
  const services = (s6.services as { serviceId: string; quantity?: number }[]) || [];
  if (services.length > 0) {
    blocks.push(heading('계약 서비스 상세'));
    services.forEach((s) => {
      const svc = SERVICES.find((sv) => sv.id === s.serviceId);
      const label = `${svc?.team || '?'} / ${svc?.name || s.serviceId}${s.quantity ? ` ${s.quantity}${svc?.unit || ''}` : ''}`;
      blocks.push(bullet(label));
    });
  }

  return blocks;
}

function heading(text: string) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function bullet(text: string) {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text.substring(0, 1900) } }],
    },
  };
}
