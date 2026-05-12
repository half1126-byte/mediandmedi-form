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
 * 거래처 DB(메인 정본)에 신규개원 폼 데이터 페이지 생성.
 * 신 워크스페이스의 거래처 DB는 컬럼이 정해져 있어 핵심 필드만 properties로 매핑하고
 * 폼의 풀 정보(브랜딩, 마케팅, 시설, 계약 등)는 페이지 본문 children blocks로 함께 저장.
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
 * 대시보드 업무 DB에 팀별 자동 업무 페이지 생성.
 * 폼의 팀(콘텐츠팀/디자인팀 등) → 신 DB의 "카테고리" select
 * 거래처명 → 거래처 DB 페이지 ID 조회 후 "관련거래처" relation
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
          '생성일': { date: { start: new Date().toISOString().split('T')[0] } },
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
 * 계약 변경 요청 DB에 폼 데이터 페이지 생성.
 * 거래처명으로 거래처 DB 페이지 검색 → relation 자동 연결 (실패 시 relation 없이 페이지만 생성).
 */
export async function createChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = process.env.NOTION_CHANGE_DB_ID;
  if (!dbId) throw new Error('NOTION_CHANGE_DB_ID not configured');

  const clinicName = (data.clinicName as string) || '';
  const clinicPageId = clinicName ? await findClinicByName(clinicName) : null;

  const addServices = (data.addServices as string[]) || [];
  const removeServices = (data.removeServices as string[]) || [];
  const changeType =
    addServices.length > 0 && removeServices.length > 0 ? '서비스 변경' :
    removeServices.length > 0 ? '서비스 축소' :
    '서비스 추가';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '거래처명': { title: [{ text: { content: clinicName } }] },
    '원장명': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
    '현재상품': { multi_select: ((data.currentServices as string[]) || []).map((s) => ({ name: s })) },
    '추가상품': { multi_select: addServices.map((s) => ({ name: s })) },
    '축소상품': { multi_select: removeServices.map((s) => ({ name: s })) },
    '변경유형': { select: { name: changeType } },
    '변경사유': { rich_text: [{ text: { content: (data.reason as string) || '' } }] },
    '처리상태': { select: { name: '접수' } },
    '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
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
 * 거래처명으로 거래처 DB에서 페이지 검색 → page ID 반환.
 * 신 워크스페이스 거래처 DB의 title 컬럼명은 "거래처명".
 */
async function findClinicByName(clinicName: string): Promise<string | null> {
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
 * 진료일정 DB에 폼 데이터 페이지 생성.
 * 폼이 보내는 휴진일/요일진료/공휴일진료 등 텍스트 필드들을 신 컬럼에 매핑.
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

  // 폼이 보내는 태그별로 날짜 분류
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

  // 신 진료일정 DB 컬럼 매핑
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '작업명': {
      title: [{ text: { content: targetMonth ? `${clinicName} - ${targetMonth}` : clinicName } }],
    },
    '성함': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
    '제출일': { date: { start: new Date().toISOString().split('T')[0] } },
    '처리상태_폼': { select: { name: '접수' } },
  };

  // 대상 월: "2026-06" 형식 → "6" 추출
  if (targetMonth) {
    const monthMatch = targetMonth.match(/-?(\d{1,2})$/);
    if (monthMatch) {
      properties['대상 월'] = { select: { name: String(parseInt(monthMatch[1])) } };
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

/**
 * 거래처 DB(신 워크스페이스)의 핵심 컬럼만 매핑.
 * 신 거래처 DB 스키마: 거래처명(title) / 원장님_성함 / 대표전화 / 주소 / 지역 / 진료과목 / 활성여부 / 계약시작일 / 메모
 * 폼의 풀 정보는 buildMainPageChildren으로 본문에 별도 저장.
 */
function buildMainProperties(data: Record<string, unknown>): Record<string, unknown> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const region = (s1.region || {}) as Record<string, string>;

  const addressParts = [region.district, region.dong, s1.address as string]
    .filter(Boolean)
    .join(' ');

  // 진료과목: 거래처 DB의 multi_select에 신규 옵션이 없으면 노션이 자동 생성
  const dentalSubjects = (s2.dentalSubjects as string[]) || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    '거래처명': { title: [{ text: { content: (s1.clinicName as string) || '' } }] },
    '원장님_성함': { rich_text: [{ text: { content: (s1.doctorName as string) || '' } }] },
    '활성여부': { select: { name: '활성' } },
  };

  if (s1.openDate) {
    props['계약시작일'] = { date: { start: s1.openDate as string } };
  }
  if (region.city) {
    props['지역'] = { select: { name: region.city } };
  }
  if (addressParts) {
    props['주소'] = { rich_text: [{ text: { content: addressParts } }] };
  }
  if (s1.phone) {
    props['대표전화'] = { phone_number: s1.phone as string };
  }
  if (dentalSubjects.length > 0) {
    props['진료과목'] = { multi_select: dentalSubjects.map((s) => ({ name: s })) };
  }

  return props;
}

/**
 * 신규개원 폼의 풀 정보를 거래처 페이지 본문 blocks으로 변환.
 * 핵심 properties로 매핑 안 되는 step2~6 정보(시설/장비/브랜딩/마케팅/계약/파일)를 보존.
 */
function buildMainPageChildren(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const s2 = (data.step2 || {}) as Record<string, unknown>;
  const s3 = (data.step3 || {}) as Record<string, unknown>;
  const s4 = (data.step4 || {}) as Record<string, unknown>;
  const s5 = (data.step5 || {}) as Record<string, unknown>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;

  const blocks: Array<Record<string, unknown>> = [];

  // 안내 callout
  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: '🏥 신규개원 폼으로 자동 생성된 거래처 페이지. 핵심 필드는 상단 속성에, 상세 정보는 아래 본문에 저장됩니다.' } }],
      icon: { type: 'emoji', emoji: '🏥' },
      color: 'gray_background',
    },
  });

  // 의료진 명단
  const doctors = (s1.doctors as { name: string; title: string; specialty: string }[]) || [];
  if (doctors.length > 0) {
    blocks.push(heading('의료진'));
    doctors.forEach((d) => {
      const label = `${d.name || '미입력'} · ${d.title}${d.specialty ? ` · ${d.specialty}` : ''}`;
      blocks.push(bullet(label));
    });
  }

  // 일정 정보
  const datesArr: string[] = [];
  if (s1.softOpenDate) datesArr.push(`가오픈 ${s1.softOpenDate}`);
  if (s1.interiorCompleteDate) datesArr.push(`인테리어 완료 ${s1.interiorCompleteDate}`);
  if (s1.photoDate) datesArr.push(`촬영 가능 ${s1.photoDate}`);
  if (s1.fax) datesArr.push(`팩스 ${s1.fax}`);
  if (datesArr.length > 0) {
    blocks.push(heading('주요 일정·연락'));
    datesArr.forEach((t) => blocks.push(bullet(t)));
  }

  // 진료 정보
  blocks.push(heading('진료 정보'));
  if ((s2.topSubjects as string[])?.length) {
    blocks.push(bullet(`주력진료: ${(s2.topSubjects as string[]).join(', ')}`));
  }
  const implant = (s2.implantMaterials as Record<string, string[]>) || {};
  const implantSummary = Object.entries(implant)
    .map(([b, ps]) => (ps.length ? `${b}(${ps.join('/')})` : b))
    .join(', ');
  if (implantSummary) blocks.push(bullet(`임플란트 재료: ${implantSummary}`));
  if ((s2.alignerOptions as string[])?.length) {
    blocks.push(bullet(`투명교정: ${(s2.alignerOptions as string[]).join(', ')}`));
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
  if (s2.nightWeekend) blocks.push(bullet(`야간/주말: ${s2.nightWeekend}`));

  // 시설/장비
  blocks.push(heading('시설·장비'));
  if (s3.chairs) blocks.push(bullet(`체어 ${s3.chairs}대`));
  if ((s3.equipment as string[])?.length) blocks.push(bullet(`장비: ${(s3.equipment as string[]).join(', ')}`));
  if ((s3.facilities as string[])?.length) blocks.push(bullet(`시설: ${(s3.facilities as string[]).join(', ')}`));
  const parking = (s3.parking as Record<string, string>) || {};
  if (parking.available) blocks.push(bullet(`주차: ${parking.available}${parking.detail ? ` (${parking.detail})` : ''}`));
  if (s3.hasLabRoom) blocks.push(bullet(`기공소: 보유${(s3.labEquipment as string[])?.length ? ` (${(s3.labEquipment as string[]).join(', ')})` : ''}`));

  // 브랜딩
  blocks.push(heading('브랜딩'));
  if (s4.oneLiner) blocks.push(bullet(`한줄소개: ${s4.oneLiner}`));
  if (s4.doctorPromo) blocks.push(bullet(`의료진 포인트: ${s4.doctorPromo}`));
  if (s4.clinicPromo) blocks.push(bullet(`병원 포인트: ${s4.clinicPromo}`));
  if (s4.treatmentPromo) blocks.push(bullet(`주요 진료 포인트: ${s4.treatmentPromo}`));
  if (s4.philosophy) blocks.push(bullet(`진료 철학: ${s4.philosophy}`));
  if (s4.locationTarget) blocks.push(bullet(`입지·타겟: ${s4.locationTarget}`));
  if (s4.interiorStyle) blocks.push(bullet(`인테리어 컨셉: ${s4.interiorStyle}`));
  if (s4.brandColor) blocks.push(bullet(`브랜드 컬러: ${s4.brandColor}`));
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
  if (s5.benchmarkClinics) blocks.push(bullet(`벤치마킹: ${s5.benchmarkClinics}`));
  if (s5.openingEvent) blocks.push(bullet(`개원이벤트: ${s5.openingEvent}`));
  if (s5.didInfo) blocks.push(bullet(`DID: ${s5.didInfo}`));
  if (s5.reviewGift) blocks.push(bullet(`리뷰 증정선물: ${s5.reviewGift}`));
  if (s5.channelGift) blocks.push(bullet(`채널 증정선물: ${s5.channelGift}`));
  if (s5.additionalRequest) blocks.push(bullet(`추가 요청: ${s5.additionalRequest}`));

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

  // 파일 첨부 URL
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
