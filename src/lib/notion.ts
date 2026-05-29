import { Client } from '@notionhq/client';
import { SERVICES } from '@/data/services';
import { clinicNamesMatch, normalizeClinicName } from './normalize';

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

/** 기존 거래처(계약중인 클라이언트)가 있는 구 DB. 계약변경·진료일정 폼의 relation 검색용. */
const LEGACY_CLINICS_DB_ID = '3539a82d-b9c4-8174-ada9-c2269dea9515';

/**
 * 신규개원 폼 → "거래처 DB" (신 스키마)에 새 페이지 생성.
 * 핵심 정보는 properties로 매핑, 상세 정보는 페이지 본문 blocks에 저장.
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
 * DB개발(종광) "📅 대시보드 업무"에 팀별 자동 업무 페이지 생성.
 * 폼 team(마케팅팀/바이럴팀/디자인팀/웹팀) → "카테고리" select
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
          '제목': { title: [{ text: { content: task.title } }] },
          '카테고리': { select: { name: task.team } },
          '상태': { select: { name: '예정' } },
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
 * 계약변경 폼 → 미팅 DB("미팅 기록")에 미팅 유형=계약변경 페이지 생성.
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
  const clinicPageId = clinicName ? await findClinicByName(clinicName, LEGACY_CLINICS_DB_ID) : null;

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
 * 진료일정 변경 폼 → DB개발(종광) "진료일정 DB"에 페이지 생성.
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

  const clinicPageId = clinicName ? await findClinicByName(clinicName, LEGACY_CLINICS_DB_ID) : null;

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

  // 진료일정 DB는 "작업명" 타이틀 사용
  const titleText = targetMonth ? `${clinicName} - ${targetMonth}` : clinicName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '작업명': { title: [{ text: { content: titleText } }] },
    '성함': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
    '제출일': { date: { start: today() } },
    '처리상태_폼': { select: { name: '접수' } },
  };

  // targetMonth "YYYY-MM" 파싱 → 대상 연도/월 select (OLD는 "대상 연도" "대상 월" 공백 포함)
  if (targetMonth) {
    const ym = targetMonth.match(/^(\d{4})-?(\d{1,2})$/);
    if (ym) {
      properties['대상 연도'] = { select: { name: ym[1] } };
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

  if (data.templateType) {
    properties['템플릿 타입'] = { select: { name: data.templateType as string } };
  }
  if (printSizes.length > 0) {
    properties['출력사이즈'] = { multi_select: printSizes.map((s) => ({ name: s })) };
  }
  if (data.calendarText) {
    properties['달력 표기 필수내용 원문'] = { rich_text: [{ text: { content: (data.calendarText as string).substring(0, 1900) } }] };
  }
  if (data.specialNote) {
    properties['특이사항/병원요청'] = { rich_text: [{ text: { content: (data.specialNote as string).substring(0, 1900) } }] };
  }
  if (data.extraRequest) {
    properties['기타요청'] = { rich_text: [{ text: { content: (data.extraRequest as string).substring(0, 1900) } }] };
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

  // 달력 이미지가 있으면 페이지 본문에 이미지 블록 추가
  const calendarImageUrl = data.calendarImageUrl as string | undefined;
  if (calendarImageUrl) {
    try {
      await withRetry(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (notion.blocks.children as any).append({
          block_id: response.id,
          children: [
            {
              object: 'block',
              type: 'heading_3',
              heading_3: { rich_text: [{ type: 'text', text: { content: '📅 진료일정 달력' } }] },
            },
            {
              object: 'block',
              type: 'image',
              image: { type: 'external', external: { url: calendarImageUrl } },
            },
          ],
        })
      );
    } catch (e) {
      console.warn('[calendar-image] 이미지 블록 추가 실패 (무시):', e);
    }
  }

  return response.id;
}

function textProp(content: string) {
  return { rich_text: [{ text: { content } }] };
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 거래처명으로 거래처DB에서 페이지 검색 → page ID 반환.
 * dbIdOverride가 주어지면 해당 DB에서, 아니면 NOTION_MAIN_DB_ID에서 검색.
 */
async function findClinicByName(clinicName: string, dbIdOverride?: string): Promise<string | null> {
  const dbId = dbIdOverride || process.env.NOTION_MAIN_DB_ID;
  if (!dbId || !clinicName) return null;
  try {
    const res = await withRetry(() =>
      notion.search({
        query: normalizeClinicName(clinicName),
        filter: { value: 'page', property: 'object' },
        page_size: 10,
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = (res.results as any[]).filter((p) =>
      p.parent?.database_id?.replace(/-/g, '') === dbId.replace(/-/g, '')
    );

    // 1차: 입력값 그대로 정확 일치 (사용자가 의도한 정확한 표기)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exact = candidates.find((p: any) => {
      const titleArr = p.properties?.['거래처명']?.title || p.properties?.['title']?.title || [];
      return (titleArr[0]?.plain_text || '') === clinicName;
    });
    if (exact) return exact.id;

    // 2차: 정규화 일치 (앞뒤·다중 공백 차이만 무시)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = candidates.find((p: any) => {
      const titleArr = p.properties?.['거래처명']?.title || p.properties?.['title']?.title || [];
      return clinicNamesMatch(titleArr[0]?.plain_text || '', clinicName);
    });
    return normalized ? normalized.id : null;
  } catch {
    return null;
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// 거래처 properties / page body 빌더 (신 "거래처 DB" 스키마)
// ─────────────────────────────────────────────────────────────────────────────

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
    '상태': { status: { name: '계약전' } },
    '업종': { select: { name: '치과' } },
    '관계유형': { select: { name: '클라이언트' } },
    '폼 제출일': { date: { start: today() } },
  };

  if (s1.doctorName) {
    props['원장명'] = { rich_text: [{ text: { content: s1.doctorName as string } }] };
  }
  if (s1.phone) {
    props['대표 전화'] = { rich_text: [{ text: { content: s1.phone as string } }] };
  }
  if (addressParts) {
    props['주소'] = { rich_text: [{ text: { content: addressParts } }] };
  }
  if (region.city) {
    props['지역'] = { rich_text: [{ text: { content: region.city } }] };
  }
  if (s1.openDate) {
    props['개원예정일'] = { date: { start: s1.openDate as string } };
  }

  // 진료과목: 신 DB 옵션이 폼 값과 동일(일반진료/임플란트/보철/턱관절치료/교정/심미치료/소아진료/기타)
  const dentalSubjects = (s2.dentalSubjects as string[]) || [];
  if (dentalSubjects.length > 0) {
    props['진료과목'] = { multi_select: dentalSubjects.map((s) => ({ name: s })) };
  }

  const topSubjects = (s2.topSubjects as string[]) || [];
  if (topSubjects.length > 0) {
    props['주력진료'] = { multi_select: topSubjects.map((s) => ({ name: s })) };
  }

  const alignerOptions = (s2.alignerOptions as string[]) || [];
  if (alignerOptions.length > 0) {
    props['교정 옵션'] = { multi_select: alignerOptions.map((s) => ({ name: s })) };
  }

  const pediatricOrtho = (s2.pediatricOrthoOptions as string[]) || [];
  if (pediatricOrtho.length > 0) {
    props['소아교정 옵션'] = { multi_select: pediatricOrtho.map((s) => ({ name: s })) };
  }

  const implantMaterials = (s2.implantMaterials as Record<string, string[]>) || {};
  const implantBrands = Object.keys(implantMaterials).filter(Boolean);
  if (implantBrands.length > 0) {
    props['임플란트 재료'] = { multi_select: implantBrands.map((b) => ({ name: b })) };
  }

  const schedule = (s2.schedule || {}) as Record<string, { enabled: boolean; start: string; end: string }>;
  const scheduleLine = Object.entries(schedule)
    .filter(([, v]) => v.enabled)
    .map(([day, v]) => `${day} ${v.start}~${v.end}`)
    .join(', ');
  if (scheduleLine) {
    props['진료시간'] = { rich_text: [{ text: { content: scheduleLine } }] };
  }

  if (s3.chairs) {
    const chairs = parseInt(s3.chairs as string);
    if (!isNaN(chairs)) props['체어수'] = { number: chairs };
  }

  const facilities = (s3.facilities as string[]) || [];
  if (facilities.length > 0) {
    props['시설'] = { multi_select: facilities.map((f) => ({ name: f })) };
  }

  if (s4.oneLiner) {
    props['한줄소개'] = { rich_text: [{ text: { content: s4.oneLiner as string } }] };
  }
  if (s4.brandColor) {
    props['브랜드 컬러'] = { rich_text: [{ text: { content: s4.brandColor as string } }] };
  }
  const promoParts: string[] = [];
  if (s4.doctorPromo) promoParts.push(`의료진: ${s4.doctorPromo}`);
  if (s4.clinicPromo) promoParts.push(`병원: ${s4.clinicPromo}`);
  if (promoParts.length > 0) {
    props['홍보 포인트'] = { rich_text: [{ text: { content: promoParts.join(' / ').substring(0, 1900) } }] };
  }

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
  if (s5.didInfo) {
    props['DID 정보'] = { rich_text: [{ text: { content: s5.didInfo as string } }] };
  }
  if (s5.reviewGift) {
    props['리뷰 증정선물'] = { rich_text: [{ text: { content: s5.reviewGift as string } }] };
  }
  if (s5.channelGift) {
    props['채널 증정선물'] = { rich_text: [{ text: { content: s5.channelGift as string } }] };
  }
  const eventParts: string[] = [];
  if (s5.openingEvent) eventParts.push(s5.openingEvent as string);
  if (s5.additionalRequest) eventParts.push(s5.additionalRequest as string);
  if (eventParts.length > 0) {
    props['이벤트 / 추가요청'] = { rich_text: [{ text: { content: eventParts.join(' / ').substring(0, 1900) } }] };
  }
  const marketingGoals = (s5.marketingGoals as string[]) || [];
  if (marketingGoals.length > 0) {
    props['마케팅 목표'] = { rich_text: [{ text: { content: marketingGoals.join(', ') } }] };
  }

  // 거래시작일: step6.contractStartDate 우선, 없으면 openDate
  const contractStart = (s6.contractStartDate as string) || (s1.openDate as string);
  if (contractStart) {
    props['거래시작일'] = { date: { start: contractStart } };
  }
  if (s6.isStarterPackage) {
    props['초기개원 패키지'] = { checkbox: true };
  }
  if (s6.monthlyFee) {
    props['월 계약금'] = { rich_text: [{ text: { content: s6.monthlyFee as string } }] };
  }
  if (s6.specialNotes) {
    props['특이사항'] = { rich_text: [{ text: { content: (s6.specialNotes as string).substring(0, 1900) } }] };
  }

  // 계약 서비스: 선택한 서비스의 팀 목록(중복 제거)
  const services = (s6.services as { serviceId: string }[]) || [];
  if (services.length > 0) {
    const teams = Array.from(new Set(
      services
        .map((svc) => SERVICES.find((s) => s.id === svc.serviceId)?.team)
        .filter((t) => Boolean(t)) as string[]
    ));
    if (teams.length > 0) {
      props['계약 서비스'] = { multi_select: teams.map((t) => ({ name: t })) };
    }
  }

  const doctors = (s1.doctors as { name: string; title: string; specialty: string }[]) || [];
  if (doctors.length > 0) {
    const doctorText = doctors
      .map((d) => `${d.name || '미입력'}(${d.title}${d.specialty ? `·${d.specialty}` : ''})`)
      .join(', ');
    props['의료진'] = { rich_text: [{ text: { content: doctorText.substring(0, 1900) } }] };
  }

  return props;
}

function buildMainPageChildren(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const s5 = (data.step5 || {}) as Record<string, unknown>;
  const sw = (data.stepWeb || {}) as Record<string, unknown>;
  const sd = (data.stepDesign || {}) as Record<string, unknown>;
  const sc = (data.scope || {}) as Record<string, boolean>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;

  const blocks: Array<Record<string, unknown>> = [];

  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: '🏥 신규개원 폼으로 자동 생성된 거래처 페이지. 핵심 필드는 상단 속성에, 상세 정보는 아래 본문에 저장됩니다.' } }],
      icon: { type: 'emoji', emoji: '🏥' },
      color: 'gray_background',
    },
  });

  // 작업 범위 (담당자 설정)
  const scopeLabels: string[] = [];
  if (sc.marketing) scopeLabels.push('마케팅');
  if (sc.viral) scopeLabels.push('바이럴');
  if (sc.web) scopeLabels.push('홈페이지 제작');
  if (sc.logo) scopeLabels.push('로고·CI');
  if (sc.video) scopeLabels.push('브랜드 영상');
  if (scopeLabels.length > 0) {
    blocks.push(bullet(`이번 작업 범위: ${scopeLabels.join(', ')}`));
  }

  // 의료진
  const doctors = (s1.doctors as { name: string; title: string; specialty: string }[]) || [];
  if (doctors.length > 0) {
    blocks.push(heading('의료진'));
    doctors.forEach((d) => {
      blocks.push(bullet(`${d.name || '미입력'} · ${d.title}${d.specialty ? ` · ${d.specialty}` : ''}`));
    });
  }

  // 주요 일정·연락
  const datesArr: string[] = [];
  if (s1.softOpenDate) datesArr.push(`가오픈 ${s1.softOpenDate}`);
  if (s1.interiorCompleteDate) datesArr.push(`인테리어 완료 ${s1.interiorCompleteDate}`);
  if (s1.photoDate) datesArr.push(`촬영 가능 ${s1.photoDate}`);
  if (s1.fax) datesArr.push(`팩스 ${s1.fax}`);
  if (datesArr.length > 0) {
    blocks.push(heading('주요 일정·연락'));
    datesArr.forEach((t) => blocks.push(bullet(t)));
  }

  // 진료
  blocks.push(heading('진료'));
  if (s2.customSubjects) blocks.push(bullet(`직접 입력 과목: ${s2.customSubjects}`));
  if ((s2.topSubjects as string[])?.length) {
    blocks.push(bullet(`주력진료: ${(s2.topSubjects as string[]).join(', ')}`));
  }
  const implant = (s2.implantMaterials as Record<string, string[]>) || {};
  const implantSummary = Object.entries(implant)
    .map(([b, ps]) => (ps.length ? `${b}(${ps.join('/')})` : b))
    .join(', ');
  if (implantSummary) blocks.push(bullet(`임플란트 재료: ${implantSummary}`));
  if ((s2.alignerOptions as string[])?.length || s2.alignerOther) {
    const aligners = [...((s2.alignerOptions as string[]) || []), s2.alignerOther as string].filter(Boolean);
    blocks.push(bullet(`투명교정: ${aligners.join(', ')}`));
  }
  if ((s2.pediatricOrthoOptions as string[])?.length) {
    blocks.push(bullet(`소아교정: ${(s2.pediatricOrthoOptions as string[]).join(', ')}`));
  }
  const schedule = (s2.schedule || {}) as Record<string, { enabled: boolean; start: string; end: string }>;
  const scheduleLine = Object.entries(schedule)
    .filter(([, v]) => v.enabled)
    .map(([day, v]) => `${day} ${v.start}~${v.end}`)
    .join(', ');
  if (scheduleLine) blocks.push(bullet(`진료시간: ${scheduleLine}`));
  const lunch = (s2.lunchTime || {}) as { start?: string; end?: string };
  if (lunch.start && lunch.end) blocks.push(bullet(`점심시간: ${lunch.start}~${lunch.end}`));
  if (typeof s2.holidayClose === 'boolean') blocks.push(bullet(`공휴일: ${s2.holidayClose ? '휴진' : '진료'}`));
  if (s2.nightWeekend) blocks.push(bullet(`야간/주말: ${s2.nightWeekend}`));

  // 시설·장비
  blocks.push(heading('시설·장비'));
  if (s3.chairs) blocks.push(bullet(`체어 ${s3.chairs}대`));
  if ((s3.equipment as string[])?.length) blocks.push(bullet(`장비: ${(s3.equipment as string[]).join(', ')}`));
  if (s3.equipmentDetail) blocks.push(bullet(`장비 상세: ${s3.equipmentDetail}`));
  if ((s3.facilities as string[])?.length) blocks.push(bullet(`시설: ${(s3.facilities as string[]).join(', ')}`));
  const parking = (s3.parking as Record<string, string>) || {};
  if (parking.available) blocks.push(bullet(`주차: ${parking.available}${parking.detail ? ` (${parking.detail})` : ''}`));
  if (s3.hasLabRoom) blocks.push(bullet(`기공소: 보유${(s3.labEquipment as string[])?.length ? ` (${(s3.labEquipment as string[]).join(', ')})` : ''}`));

  // 브랜딩
  blocks.push(heading('브랜딩'));
  if (s4.oneLiner) blocks.push(bullet(`한줄소개: ${s4.oneLiner}`));
  if (s4.slogan) blocks.push(bullet(`슬로건: ${s4.slogan}`));
  if (s4.brandVision) blocks.push(bullet(`브랜드 비전: ${s4.brandVision}`));
  if (s4.brandTone) blocks.push(bullet(`브랜드 톤앤매너: ${s4.brandTone}`));
  if (s4.doctorPromo) blocks.push(bullet(`의료진 포인트: ${s4.doctorPromo}`));
  if (s4.clinicPromo) blocks.push(bullet(`병원 포인트: ${s4.clinicPromo}`));
  if (s4.treatmentPromo) blocks.push(bullet(`주요 진료 포인트: ${s4.treatmentPromo}`));
  if (s4.philosophy) blocks.push(bullet(`진료 철학: ${s4.philosophy}`));
  if (s4.locationTarget) blocks.push(bullet(`입지·타겟: ${s4.locationTarget}`));
  if (s4.interiorStyle) blocks.push(bullet(`인테리어 컨셉: ${s4.interiorStyle}`));
  const colorTones = (s4.brandColorTones as string[])?.length
    ? (s4.brandColorTones as string[])
    : ((sd.colorPreference as string[]) || []); // 구버전 저장본 폴백
  if (colorTones.length) blocks.push(bullet(`브랜드 컬러 계열: ${colorTones.join(', ')}`));
  if (s4.brandColor) blocks.push(bullet(`브랜드 컬러: ${s4.brandColor}`));
  // 벤치마킹·참고 사이트: 브랜딩으로 이동(구버전 저장본은 s5에서 폴백)
  const benchmark = (s4.benchmarkClinics as string) || (s5.benchmarkClinics as string);
  if (benchmark) blocks.push(bullet(`벤치마킹·참고 사이트: ${benchmark}`));
  if (s4.hasProfilePhoto) blocks.push(bullet('프로필 사진 보유'));
  if (s4.hasLogo) blocks.push(bullet('로고 파일 보유'));

  // 마케팅
  blocks.push(heading('마케팅'));
  if ((s5.referralSource as string[])?.length) {
    blocks.push(bullet(`유입경로: ${(s5.referralSource as string[]).join(', ')}`));
  }
  if (s5.referralName) blocks.push(bullet(`소개자: ${s5.referralName}`));
  if (s5.previousMarketing) blocks.push(bullet(`이전 마케팅: ${s5.previousMarketing}`));
  if (s5.budgetRange) blocks.push(bullet(`예산: ${s5.budgetRange}`));
  if ((s5.marketingGoals as string[])?.length) {
    blocks.push(bullet(`목표: ${(s5.marketingGoals as string[]).join(', ')}`));
  }
  if ((s5.desiredChannels as string[])?.length) {
    blocks.push(bullet(`원하는 채널: ${(s5.desiredChannels as string[]).join(', ')}`));
  }
  if (s5.openingEvent) blocks.push(bullet(`개원이벤트: ${s5.openingEvent}`));
  if (s5.didInfo) blocks.push(bullet(`DID: ${s5.didInfo}`));
  if (s5.reviewGift) blocks.push(bullet(`리뷰 증정선물: ${s5.reviewGift}`));
  if (s5.channelGift) blocks.push(bullet(`채널 증정선물: ${s5.channelGift}`));
  if (s5.additionalRequest) blocks.push(bullet(`추가 요청: ${s5.additionalRequest}`));

  // 홈페이지/웹
  const webItems: string[] = [];
  const webOnemore = (label: string, v: unknown) => {
    if (v && String(v).trim()) webItems.push(`${label}: ${v}`);
  };
  webOnemore('지하철', sw.subway);
  webOnemore('버스', sw.bus);
  webOnemore('위치 어필', sw.locationNote);
  webOnemore('학력', sw.education);
  webOnemore('경력', sw.career);
  webOnemore('학회·협회', sw.associations);
  webOnemore('수상·논문·방송', sw.awards);
  webOnemore('메인 키워드', sw.mainKeywords);
  webOnemore('참고 사이트', sw.referenceSites);
  webOnemore('디자인 중점', sw.designFocus);
  webOnemore('메인 강조', sw.mainEmphasis);
  webOnemore('사진 방향', sw.photoDirection);
  webOnemore('인스타그램', sw.instagramUrl);
  webOnemore('블로그', sw.blogUrl);
  webOnemore('유튜브', sw.youtubeUrl);
  webOnemore('카카오톡 채널', sw.kakaoChannel);
  webOnemore('네이버 예약', sw.naverBooking);
  webOnemore('도메인', sw.desiredDomain);
  webOnemore('SSL', sw.ssl);
  if ((sw.features as string[])?.length) webItems.push(`필요 기능: ${(sw.features as string[]).join(', ')}`);
  webOnemore('CMS', sw.cmsNeed);
  webOnemore('리뉴얼', sw.renewalType);
  webOnemore('기존 홈페이지 URL', sw.oldSiteUrl);
  webOnemore('오픈 목표 일정', sw.homepageDeadline);
  webOnemore('유지보수', sw.maintenance);
  if ((sw.menuStructure as string[])?.length) webItems.push(`원하는 메뉴: ${(sw.menuStructure as string[]).join(', ')}`);
  webOnemore('꼭 들어갈 페이지', sw.mustHavePages);
  if ((sw.photoTypes as string[])?.length) webItems.push(`제공 사진 종류: ${(sw.photoTypes as string[]).join(', ')}`);
  webOnemore('내부 검수 담당자', sw.reviewer);
  webOnemore('피드백 방식', sw.feedbackChannel);
  if (webItems.length > 0) {
    blocks.push(heading('홈페이지/웹'));
    webItems.forEach((t) => blocks.push(bullet(t)));
  }

  // 디자인/브랜딩
  const designItems: string[] = [];
  const designOne = (label: string, v: unknown) => {
    if (v && String(v).trim()) designItems.push(`${label}: ${v}`);
  };
  designOne('로고 타입', sd.logoType);
  designOne('로고 표기', sd.logoNotation);
  designOne('영문 표기', sd.englishSpelling);
  designOne('로고 모티브', sd.logoMotif);
  designOne('피하는 컬러', sd.avoidColor);
  designOne('영상 메시지', sd.videoMessage);
  designOne('영상 레퍼런스', sd.videoReference);
  if ((sd.videoChannels as string[])?.length) designItems.push(`영상 채널: ${(sd.videoChannels as string[]).join(', ')}`);
  if ((sd.videoItems as string[])?.length) designItems.push(`영상 제작 항목: ${(sd.videoItems as string[]).join(', ')}`);
  designOne('영상 BGM', sd.videoBgm);
  if (designItems.length > 0) {
    blocks.push(heading('디자인/브랜딩'));
    designItems.forEach((t) => blocks.push(bullet(t)));
  }

  // 계약
  blocks.push(heading('계약'));
  const services = (s6.services as { serviceId: string; quantity?: number }[]) || [];
  if (services.length > 0) {
    const text = services.map((s) => {
      const svc = SERVICES.find((sv) => sv.id === s.serviceId);
      return `${svc?.name || s.serviceId}${s.quantity ? ` ${s.quantity}${svc?.unit || ''}` : ''}`;
    }).join(', ');
    blocks.push(bullet(`서비스: ${text}`));
  }
  if (s6.isStarterPackage) blocks.push(bullet('초기개원 패키지 적용'));
  if (s6.contractStartDate) blocks.push(bullet(`계약시작: ${s6.contractStartDate}`));
  if (s6.monthlyFee) blocks.push(bullet(`월 계약금: ${s6.monthlyFee}`));
  if (s6.specialNotes) blocks.push(bullet(`특이사항: ${s6.specialNotes}`));

  // 첨부 자료
  const files = collectFiles(data);
  if (files.length > 0) {
    blocks.push(heading('첨부 자료'));
    for (const f of files) {
      blocks.push(bullet(`${f.label}: ${f.urls}`));
    }
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

function collectFiles(data: Record<string, unknown>): { label: string; urls: string }[] {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const map: [string, unknown][] = [
    ['약력이미지', s1.careerImages],
    ['인테리어 도면', s3.blueprintFiles],
    ['로고', s4.logoFiles],
    ['면허증', s4.licenseFiles],
    ['전문의 자격증', s4.certificateFiles],
    ['사업자등록증', s4.businessFiles],
    ['개설필증', s4.permitFiles],
    ['간판 사진', s4.signageFiles],
    ['현수막 사진', s4.bannerFiles],
    ['공사 현장 사진', s4.constructionFiles],
  ];
  const results: { label: string; urls: string }[] = [];
  for (const [label, files] of map) {
    const arr = (files as { url: string; filename: string }[] | undefined) || [];
    if (arr.length === 0) continue;
    const urls = arr.map((f) => `${f.filename} → ${f.url}`).join(' | ');
    results.push({ label, urls: urls.length > 1800 ? urls.slice(0, 1800) + '...' : urls });
  }
  return results;
}
