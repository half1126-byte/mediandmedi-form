import { Client, isNotionClientError } from '@notionhq/client';
import { SERVICES } from '@/data/services';
import { clinicNamesMatch, normalizeClinicName } from './normalize';
import { linkedPersonAccountId } from './notion/people';

// 환경변수의 공백/개행 제거 — Vercel 등에 복붙으로 값을 넣을 때 끝에 개행이 섞이면
// DB ID/키가 깨져 제출이 통째로 실패한다. 읽는 지점마다 trim.
function envTrim(name: string): string | undefined {
  const v = (process.env[name] || '').trim();
  return v || undefined;
}

const authKey = envTrim('NOTION_MEETING_API_KEY') || envTrim('NOTION_API_KEY');

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
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = isNotionClientError(error) && 'status' in error && (error as { status: number }).status === 429;
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

const NEW_TASK_DATABASE_ID = '97e9a82d-b9c4-8349-9bea-01e15d30e007';
const TASK_CHECKLIST_DATABASE_ID = 'dd2371df-6b67-4572-8bc5-3d01765cde06';

async function resolveDataSourceId(databaseId: string): Promise<string> {
  const database = await withRetry(() => notion.databases.retrieve({ database_id: databaseId })) as {
    data_sources?: Array<{ id?: string }>;
  };
  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) throw new Error(`데이터 소스를 찾을 수 없습니다: ${databaseId}`);
  return dataSourceId;
}

const OPENING_TASKS = [
  ['담당자 초대 및 첫 인사', ['병원 운영 담당자와 원장 연락처 확인', '업무용 소통방 개설 및 담당자 초대', '담당 범위와 응답 가능 시간 안내', '첫 인사 및 진행 일정 공유', '참여자 확인 이력 저장']],
  ['필수 자료 요청', ['사업자등록증과 의료기관 개설 관련 자료 요청', '병원 기본정보와 진료시간 요청', '로고·대표사진·의료진 자료 요청', '홈페이지와 예약 링크 보유 여부 확인', '요청 목록과 회신 기한 공유']],
  ['자료 취합 및 누락 확인', ['수신 자료를 항목별로 분류', '병원명·주소·전화번호 표기 대조', '이미지 원본 해상도와 사용 가능 여부 확인', '누락 자료 목록 작성 및 재요청', '최종 취합본 확인 이력 저장']],
  ['병원 폴더 생성', ['공용 저장소에 병원 최상위 폴더 생성', '계약·증빙 및 기본정보 폴더 생성', '브랜드·사진·영상 폴더 생성', '플레이스·포털·예약 폴더 생성', '중복 파일 제거와 접근 권한 확인', '폴더 링크를 업무에 저장']],
  ['내비게이션 등록', ['등록 대상 내비게이션 서비스 확인', '병원명·주소·전화번호 최종 대조', '각 서비스에 신규 장소 등록 또는 수정 요청', '핀 위치와 출입구 위치 확인', '접수번호 또는 결과 화면 저장']],
  ['플레이스 이미지 기획', ['필요 이미지 규격과 수량 확인', '대표·내부·외부·의료진 이미지 구성', '환자 동선 기준 이미지 순서 기획', '과장 표현 및 의료광고 위험 문구 검수', '기획안 컨펌 이력 저장']],
  ['네이버 플레이스 세팅', ['소유자 계정과 관리자 권한 확인', '업체명·주소·전화번호·진료시간 입력', '홈페이지·예약·길찾기 링크 연결', '대표 이미지와 상세 이미지 등록', '진료과목과 소개 문구 검수', '모바일 검색·지도 실제 화면 확인', '결과 화면과 링크 저장']],
  ['네이버 예약 세팅', ['예약 운영 담당자와 권한 확인', '예약 상품과 진료 항목 구성', '예약 가능 시간과 간격 확인', '알림 및 취소 정책 설정', '테스트 예약·변경·취소 진행', '관리자와 사용자 화면 캡처 저장']],
  ['카카오채널 세팅', ['병원 소유 카카오 계정과 권한 확인', '채널명·검색용 아이디·프로필 이미지 설정', '병원 소개·주소·전화번호·진료시간 입력', '홈·전화·예약·길찾기 링크 구성', '웰컴메시지와 자주 묻는 질문 작성', '친구 추가·채팅·링크 테스트', '실제 화면 캡처 저장']],
  ['구글 비즈니스 세팅', ['병원 소유 구글 계정 확인', '비즈니스 프로필 생성 또는 소유권 요청', '추가 인증 방식과 촬영 조건 확인', '업체명·업종·주소·전화번호·진료시간 입력', '사진과 홈페이지·예약 링크 등록', '검색·지도 노출 및 링크 테스트', '인증·결과 화면 저장']],
  ['당근 비즈프로필 세팅', ['운영 계정과 지역 인증 조건 확인', '비즈프로필 생성 및 병원 업종 설정', '주소·전화번호·진료시간 입력', '소개 문구와 대표 이미지 등록', '전화·길찾기·문의 동작 테스트', '공개 화면 캡처 저장']],
  ['최종 개원 점검', ['모든 채널의 병원명·주소·전화번호 대조', '진료시간·휴진일·예약 정보 대조', '모바일과 PC에서 링크 동작 확인', '검색·지도·예약·문의 사용자 동선 테스트', '미완료 및 보완 항목 담당자 지정', '병원 담당자 최종 확인 이력 저장', '최종 점검 증빙과 결과 링크 저장']],
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any -- Notion SDK property unions are discovered dynamically per live data source. */
function plainTitle(page: any, titleProperty: string): string {
  return (page?.properties?.[titleProperty]?.title || []).map((item: any) => item.plain_text || item.text?.content || '').join('').trim();
}

async function titlePropertyName(dataSourceId: string): Promise<string> {
  const source = await withRetry(() => notion.dataSources.retrieve({ data_source_id: dataSourceId }));
  const found = Object.entries((source as any).properties || {}).find(([, value]: any) => value.type === 'title');
  if (!found) throw new Error(`제목 속성을 찾을 수 없습니다: ${dataSourceId}`);
  return found[0];
}

async function openingAssignee(clientProperties: any): Promise<{
  accountId: string;
  peoplePageId: string;
}> {
  const marketerRelations = clientProperties['담당마케터']?.relation || [];
  if (marketerRelations.length !== 1) {
    throw new Error(`담당마케터를 정확히 1명 지정해야 합니다. 현재 ${marketerRelations.length}명입니다.`);
  }

  const marketerPage = await withRetry(() => notion.pages.retrieve({ page_id: marketerRelations[0].id })) as any;
  const marketerName = plainTitle(marketerPage, '사람명');
  if (!marketerName) throw new Error('담당마케터 사람DB 페이지에서 사람명을 확인할 수 없습니다.');

  const team = marketerPage.properties?.['소속팀']?.select?.name;
  const employment = marketerPage.properties?.['재직상태']?.select?.name;
  if (team !== '마케팅팀' || employment !== '재직') {
    throw new Error(`담당마케터 ${marketerName}은(는) 재직 중인 마케팅팀 구성원이 아닙니다.`);
  }

  return {
    accountId: linkedPersonAccountId(marketerPage, `담당마케터 ${marketerName}`),
    peoplePageId: marketerRelations[0].id,
  };
}

/** 웹앱 제출과 Notion 웹훅이 공유하는 신규개원 이벤트 처리기. */
export async function ensureOpeningSetup(pageId: string): Promise<{ created: number; existing: number }> {
  const clientPage = await withRetry(() => notion.pages.retrieve({ page_id: pageId })) as any;
  const clientProperties = clientPage.properties || {};
  const requested = clientProperties['신규 업무 생성']?.checkbox === true;
  const generationState = clientProperties['업무 생성 상태']?.select?.name;

  // 웹앱과 Notion 자동화 모두 동일한 트리거 조건을 사용한다.
  if (!requested && generationState !== '생성완료') {
    throw new Error('신규 업무 생성이 체크되지 않은 거래처입니다.');
  }
  const assignee = await openingAssignee(clientProperties);
  const taskSourceId = await resolveDataSourceId(NEW_TASK_DATABASE_ID);
  const checklistSourceId = await resolveDataSourceId(TASK_CHECKLIST_DATABASE_ID);
  const taskTitle = await titlePropertyName(taskSourceId);
  const checklistTitle = await titlePropertyName(checklistSourceId);
  const query = await withRetry(() => notion.dataSources.query({ data_source_id: taskSourceId, filter: { and: [
    { property: '관련거래처', relation: { contains: pageId } },
    { property: '대분류', select: { equals: '개원 세팅' } },
  ] }, page_size: 100 } as any));
  const byName = new Map<string, any[]>();
  for (const page of (query as any).results || []) {
    const name = plainTitle(page, taskTitle);
    byName.set(name, [...(byName.get(name) || []), page]);
  }
  for (const [name, pages] of byName) {
    if (OPENING_TASKS.some(([standard]) => standard === name) && pages.length > 1) throw new Error(`동일 업무명 중복: ${name} (${pages.length}개)`);
  }

  const createdPages: string[] = [];
  const createdChecklistPages: string[] = [];
  let existing = 0;
  try {
    for (const [name, items] of OPENING_TASKS) {
      let task = byName.get(name)?.[0];
      if (task) {
        existing += 1;
      } else {
        task = await withRetry(() => notion.pages.create({
        parent: { database_id: NEW_TASK_DATABASE_ID },
        properties: {
          [taskTitle]: { title: [{ text: { content: name } }] }, '관련거래처': { relation: [{ id: pageId }] },
          '거래처 단계': { select: { name: '신규개원' } }, '대분류': { select: { name: '개원 세팅' } },
          '업무상태': { status: { name: '요청접수' } }, '우선순위': { select: { name: '보통' } },
          '담당팀': { select: { name: '마케팅팀' } }, '담당자': { people: [{ id: assignee.accountId }] },
          '담당 직원': { relation: [{ id: assignee.peoplePageId }] },
        } as any,
        children: [{ object: 'block', type: 'callout', callout: { icon: { type: 'emoji', emoji: '🎯' }, rich_text: [{ type: 'text', text: { content: `${name} 업무를 완료하고 결과 증빙을 저장합니다.` } }] } }] as any,
        }));
        createdPages.push(task.id);
      }

      const checklistQuery = await withRetry(() => notion.dataSources.query({
        data_source_id: checklistSourceId,
        filter: { property: '관련 업무', relation: { contains: task.id } },
        page_size: 100,
      } as any));
      const existingChecklistNames = new Set(((checklistQuery as any).results || []).map((page: any) => plainTitle(page, checklistTitle)));
      let order = 1;
      for (const item of items) {
        if (existingChecklistNames.has(item)) { order += 1; continue; }
        const checklistPage = await withRetry(() => notion.pages.create({ parent: { database_id: TASK_CHECKLIST_DATABASE_ID }, properties: {
          [checklistTitle]: { title: [{ text: { content: item } }] }, '완료': { checkbox: false },
          '관련 업무': { relation: [{ id: task.id }] }, '업무 키': { rich_text: [{ text: { content: task.id } }] },
          '순서': { number: order++ }, '필수': { checkbox: true },
        } as any }));
        createdChecklistPages.push(checklistPage.id);
      }
    }
    const verify = await withRetry(() => notion.dataSources.query({ data_source_id: taskSourceId, filter: { and: [
      { property: '관련거래처', relation: { contains: pageId } }, { property: '대분류', select: { equals: '개원 세팅' } },
    ] }, page_size: 100 } as any));
    const results = (verify as any).results || [];
    const standardNames = new Set(OPENING_TASKS.map(([name]) => name));
    const finalNames = new Set(results.map((page: any) => plainTitle(page, taskTitle)).filter((name: string) => standardNames.has(name as typeof OPENING_TASKS[number][0])));
    const missing = OPENING_TASKS.map(([name]) => name).filter((name) => !finalNames.has(name));
    if (missing.length) throw new Error(`표준 업무 생성 누락: ${missing.join(', ')}`);
    const currentRelations = (clientProperties['(신)업무DB']?.relation || []).map((item: any) => item.id);
    const standardTaskIds = results
      .filter((page: any) => standardNames.has(plainTitle(page, taskTitle) as typeof OPENING_TASKS[number][0]))
      .map((page: any) => page.id);
    const relationIds = [...new Set([...currentRelations, ...standardTaskIds])];
    await safePageUpdate(pageId, {
      // 기존 레거시 업무 Relation은 유지하고 표준 12개만 합친다.
      '(신)업무DB': { relation: relationIds.map((id) => ({ id })) },
      '업무 생성 상태': { select: { name: '생성완료' } }, '업무 생성일': { date: { start: today() } }, '신규 업무 생성': { checkbox: false },
    });
    return { created: createdPages.length, existing };
  } catch (error) {
    for (const id of createdChecklistPages.reverse()) { try { await notion.pages.update({ page_id: id, archived: true }); } catch { /* 원래 오류 보존 */ } }
    for (const id of createdPages.reverse()) { try { await notion.pages.update({ page_id: id, archived: true }); } catch { /* 원래 오류 보존 */ } }
    throw error;
  }
}

/** 체크리스트 변경 웹훅에서 호출한다. 모든 항목 완료 시에만 업무를 완료 처리한다. */
export async function syncOpeningTaskCompletion(taskId: string): Promise<{
  taskId: string;
  total: number;
  completed: number;
  updated: boolean;
}> {
  const task = await withRetry(() => notion.pages.retrieve({ page_id: taskId })) as any;
  const properties = task.properties || {};
  if (properties['대분류']?.select?.name !== '개원 세팅') {
    throw new Error('개원 세팅 업무가 아닙니다.');
  }

  const checklistSourceId = await resolveDataSourceId(TASK_CHECKLIST_DATABASE_ID);
  const checklistPages: any[] = [];
  let cursor: string | undefined;
  do {
    const response = await withRetry(() => notion.dataSources.query({
      data_source_id: checklistSourceId,
      filter: { property: '관련 업무', relation: { contains: taskId } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as any)) as any;
    checklistPages.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  const completed = checklistPages.filter((page) => page.properties?.['완료']?.checkbox === true).length;
  const allCompleted = checklistPages.length > 0 && completed === checklistPages.length;
  const alreadyCompleted = properties['업무상태']?.status?.name === '완료';
  if (allCompleted && !alreadyCompleted) {
    await withRetry(() => notion.pages.update({
      page_id: taskId,
      properties: {
        '업무상태': { status: { name: '완료' } },
        '종료일': { date: { start: today() } },
      } as any,
    }));
  }

  return { taskId, total: checklistPages.length, completed, updated: allCompleted && !alreadyCompleted };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 기존 거래처(계약중인 클라이언트)가 있는 구 DB. 계약변경·진료일정 폼의 relation 검색용. */
const LEGACY_CLINICS_DB_ID = '3539a82d-b9c4-8174-ada9-c2269dea9515';

/**
 * 신규개원 폼 → "거래처 DB" (신 스키마)에 새 페이지 생성.
 * 핵심 정보는 properties로 매핑, 상세 정보는 페이지 본문 blocks에 저장.
 */
export async function createMainRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = envTrim('NOTION_MAIN_DB_ID');
  if (!dbId) throw new Error('NOTION_MAIN_DB_ID not configured');

  const s1 = (data.step1 || {}) as Record<string, unknown>;
  const clinicName = (s1.clinicName as string) || '';

  const coreProps = buildMainProperties(data);
  const children = buildMainPageChildren(data);

  // 최신 우선 업서트: 같은 거래처(의원/공백 표기차 포함)가 이미 있으면 새로 만들지 않고
  // 비어있지 않은 새 값으로 기존 페이지를 갱신한다(상태는 보존, 새 제출이 비운 칸은 기존 유지).
  // 본문은 새 제출 내용이 충분하면 최신으로 교체. → 재제출 = 데이터 손실 없이 자동 갱신.
  if (clinicName) {
    const existing = await findClinicByName(clinicName, dbId, true);
    if (existing) {
      const filled = filterFilledProps(coreProps, ['상태']);
      await safePageUpdate(existing, filled);
      // 직원이 본문에 추가한 운영 기록을 보호한다. 재제출은 속성만 갱신하고
      // 기존 본문을 통째로 교체하지 않는다.
      return existing;
    }
  }

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

// 업서트용: 비어있지 않은 속성만 추림 (새 제출이 비운 칸은 기존 값 유지 → 손실 0).
// preserveKeys(예: 상태)는 폼이 항상 기본값을 넣으므로 덮어쓰지 않고 보존.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPropFilled(v: any): boolean {
  if (!v || typeof v !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (v.title) return v.title.some((t: any) => (t.text?.content || '').trim());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (v.rich_text) return v.rich_text.some((t: any) => (t.text?.content || '').trim());
  if ('select' in v) return !!v.select;
  if ('status' in v) return !!v.status;
  if (v.multi_select) return v.multi_select.length > 0;
  if ('date' in v) return !!v.date;
  if ('number' in v) return v.number !== null && v.number !== undefined;
  if ('checkbox' in v) return v.checkbox === true;
  if (v.relation) return v.relation.length > 0;
  return false;
}

function filterFilledProps(
  props: Record<string, unknown>,
  preserveKeys: string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (preserveKeys.includes(k)) continue;
    if (isPropFilled(v)) out[k] = v;
  }
  return out;
}

// Notion pages.update는 DB 스키마에 없는 속성명이 포함되면 400 validation_error 반환.
// 에러 메시지에서 속성명을 파싱해 제거하고 재시도 → DB 스키마 불일치에 자동 대응.
async function safePageUpdate(pageId: string, props: Record<string, unknown>): Promise<void> {
  const remaining = { ...props };
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await withRetry(() => notion.pages.update({ page_id: pageId, properties: remaining as any }));
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const match = msg.match(/Could not find property with name or id:\s*(.+?)(?:\s*\.|$)/i);
      if (match) {
        const bad = match[1].trim();
        console.warn(`[safePageUpdate] removing unknown prop "${bad}" and retrying`);
        delete remaining[bad];
      } else {
        throw err;
      }
    }
  }
  throw new Error('[safePageUpdate] too many unknown properties, giving up');
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
  const dbId = envTrim('NOTION_TASK_DB_ID');
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
 * 거래처의 계약 서비스(팀) 도출: 작업범위(scope) + 선택 계약 서비스의 팀 합집합(중복 제거).
 * 거래처DB '계약 서비스' 속성과 개원세팅 팀 범위 게이팅의 단일 출처.
 */
export function deriveContractTeams(data: Record<string, unknown>): string[] {
  const scope = (data.scope || {}) as Record<string, boolean>;
  const s6 = (data.step6 || {}) as Record<string, unknown>;
  const teamSet = new Set<string>();
  if (scope.marketing) teamSet.add('마케팅팀');
  if (scope.viral) teamSet.add('바이럴팀');
  if (scope.web) teamSet.add('웹팀');
  if (scope.logo || scope.video) teamSet.add('디자인팀');
  const services = (s6.services as { serviceId: string }[]) || [];
  services.forEach((svc) => {
    const team = SERVICES.find((s) => s.id === svc.serviceId)?.team;
    if (team) teamSet.add(team);
  });
  return Array.from(teamSet);
}

/** YYYY-MM-DD 문자열에 days를 더해 YYYY-MM-DD 반환. UTC 기준으로 계산해 시간대 오차 방지. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 🏥개원세팅DB에 개원세팅 업무 1건 생성. 거래처(clinicPageId) relation 연결.
 * openDate 제공 시 마감일(= openDate + dOffset)을 date 속성으로 직접 저장. 업무상태=대기.
 */
export async function createOpeningSetupTask(task: {
  업무명: string;
  단계: string;
  담당팀: string;
  dOffset: number;
  clinicPageId: string;
  openDate?: string;
  메모?: string;
}): Promise<{ success: boolean; error?: string }> {
  const dbId = envTrim('NOTION_OPENING_DB_ID');
  if (!dbId) return { success: false, error: 'NOTION_OPENING_DB_ID not configured' };

  await delay(DELAY_MS); // 순차 42건 생성 시 rate-limit 간격 (테스트는 이 함수 전체를 mock하므로 영향 없음)

  const 마감일 = task.openDate ? addDays(task.openDate, task.dOffset) : undefined;

  try {
    await withRetry(() =>
      notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          '업무명': { title: [{ text: { content: task.업무명 } }] },
          '단계': { select: { name: task.단계 } },
          '담당팀': { select: { name: task.담당팀 } },
          'D오프셋': { number: task.dOffset },
          '상태': { select: { name: '대기' } },
          '거래처': { relation: [{ id: task.clinicPageId }] },
          ...(마감일 ? { '마감일': { date: { start: 마감일 } } } : {}),
          ...(task.메모 ? { '메모': { rich_text: [{ text: { content: task.메모.substring(0, 1900) } }] } } : {}),
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
 * 멱등성: 거래처(clinicPageId)에 개원세팅 업무가 이미 연결돼 있으면 true → 재제출 시 중복 생성 차단.
 * 거래처 페이지의 '개원세팅' 양방향 관계를 읽어 판단(데이터소스 id 불필요).
 * ⚠️ @notionhq/client v5는 databases.query 미지원 → 관계 읽기(pages.retrieve)로 구현.
 * 조회 실패 시 false(신규 거래처는 관계가 비어 있으므로 생성 진행 — withRetry로 일시오류는 이미 재시도됨).
 */
export async function hasOpeningSetupTasks(clinicPageId: string): Promise<boolean> {
  try {
    const page = await withRetry(() => notion.pages.retrieve({ page_id: clinicPageId }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel = ((page as any)?.properties?.['개원세팅']?.relation) ?? [];
    return Array.isArray(rel) && rel.length > 0;
  } catch {
    return false;
  }
}

/**
 * 계약변경 폼 → 미팅 DB("미팅 기록")에 미팅 유형=계약변경 페이지 생성.
 */
export async function createChangeRecord(
  data: Record<string, unknown>
): Promise<string> {
  const dbId = envTrim('NOTION_CHANGE_DB_ID');
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
  const dbId = envTrim('NOTION_SCHEDULE_DB_ID');
  if (!dbId) throw new Error('NOTION_SCHEDULE_DB_ID not configured');

  const clinicName = (data.clinicName as string) || '';
  const targetMonth = (data.targetMonth as string) || '';
  const scheduleData = (data.scheduleData as string) || '';
  const printSizes = (data.printSizes as string[]) || [];
  const dateSchedulesRaw = (data.dateSchedulesRaw as Record<string, string[]>) || {};
  const dateTimes = (data.dateTimes as Record<string, string>) || {};
  const holidayReason = (data.holidayReason as string) || '';

  const clinicPageId = clinicName ? await findClinicByName(clinicName, LEGACY_CLINICS_DB_ID) : null;

  const TAG_TYPES = ['휴진', '토요일진료', '일요일진료', '오전진료', '오후진료', '야간진료', '공휴일진료'] as const;
  const TIMED_TAGS = new Set<string>(['토요일진료', '일요일진료', '야간진료']);
  const tagToDates: Record<string, string[]> = {};
  for (const tag of TAG_TYPES) tagToDates[tag] = [];

  for (const [dateStr, tags] of Object.entries(dateSchedulesRaw)) {
    const day = parseInt(dateStr.split('-')[2]);
    const time = dateTimes[dateStr]?.trim();
    for (const tag of tags as string[]) {
      if (tagToDates[tag]) {
        const label = TIMED_TAGS.has(tag) && time ? `${day}일 ${time}` : `${day}일`;
        tagToDates[tag].push(label);
      }
    }
  }

  const sortDates = (arr: string[]) =>
    arr.sort((a, b) => parseInt(a) - parseInt(b)).join(', ');

  // 작업명(타이틀) = 거래처명만. 대상 연도/월은 별도 속성이라 제목에 월 중복 표기하지 않음.
  const titleText = clinicName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '작업명': { title: [{ text: { content: titleText } }] },
    '성함': { rich_text: [{ text: { content: (data.doctorName as string) || '' } }] },
    '제출일': { date: { start: today() } },
    '처리상태_폼': { select: { name: '접수' } },
  };

  // 대상 연도/월: 폼이 보내는 calYear/calMonth 우선, 없으면 targetMonth 파싱.
  // (폼은 targetMonth를 "2026년 7월" 형식으로 보내 기존 정규식 ^YYYY-MM$이 안 잡혔음 → 월별 필터 뷰 누락)
  const calYear = data.calYear as number | string | undefined;
  const calMonth = data.calMonth as number | string | undefined;
  if (calYear && calMonth) {
    properties['대상 연도'] = { select: { name: String(calYear) } };
    properties['대상 월'] = { select: { name: String(parseInt(String(calMonth))) } };
  } else if (targetMonth) {
    const ym = targetMonth.match(/(\d{4})[년\s.\-]*(\d{1,2})/); // "2026-07" · "2026년 7월" 모두 허용
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

  // 달력 이미지(노션에 직접 업로드한 file_upload)가 있으면 페이지 본문에 이미지 블록 추가.
  // (FTP 폐기 → 노션 자체 파일 업로드. 클라이언트가 webp로 변환해 저용량으로 보냄)
  const calendarFileUploadId = data.calendarFileUploadId as string | undefined;
  if (calendarFileUploadId) {
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
              image: { type: 'file_upload', file_upload: { id: calendarFileUploadId } },
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

/**
 * 노션에 파일을 직접 업로드(file_upload)하고 그 id를 반환. (FTP 대체)
 * 단일 파트 업로드 — 달력 webp처럼 작은 파일용.
 */
export async function uploadFileToNotion(buffer: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp';
  const filename = `calendar.${ext}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fu: any = await withRetry(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (notion as any).fileUploads.create({ filename, content_type: contentType })
  );
  await withRetry(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (notion as any).fileUploads.send({
      file_upload_id: fu.id,
      file: { filename, data: new Blob([new Uint8Array(buffer)], { type: contentType }) },
    })
  );
  return fu.id as string;
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
async function findClinicByName(clinicName: string, dbIdOverride?: string, loose = false): Promise<string | null> {
  const dbId = dbIdOverride || envTrim('NOTION_MAIN_DB_ID');
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
    if (normalized) return normalized.id;

    // 3차(loose, 업서트 전용): 공백 제거 + 끝 '의원' 제거 후 비교
    // → 재제출 시 "○○치과" vs "○○치과의원" 표기차를 같은 거래처로 인식
    if (loose) {
      const looseKey = (s: string) => s.replace(/\s/g, '').replace(/의원$/, '');
      const target = looseKey(clinicName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lm = candidates.find((p: any) => {
        const titleArr = p.properties?.['거래처명']?.title || p.properties?.['title']?.title || [];
        return looseKey(titleArr[0]?.plain_text || '') === target;
      });
      if (lm) return lm.id;
    }
    return null;
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
    // 현재 표준 개원세팅 자동화의 단일 트리거.
    '신규 업무 생성': { checkbox: true },
    '업무 생성 상태': { select: { name: '미생성' } },
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
  if (s6.monthlyFee) {
    props['월 계약금'] = { rich_text: [{ text: { content: s6.monthlyFee as string } }] };
  }
  if (s6.specialNotes) {
    props['특이사항'] = { rich_text: [{ text: { content: (s6.specialNotes as string).substring(0, 1900) } }] };
  }

  // 계약 서비스(팀): 작업 범위(scope) + 선택한 계약 서비스의 팀 합집합.
  // deriveContractTeams를 단일 출처로 사용(개원세팅 범위 게이팅과 동일 로직 — 드리프트 방지).
  const contractTeams = deriveContractTeams(data);
  if (contractTeams.length > 0) {
    props['계약 서비스'] = { multi_select: contractTeams.map((t) => ({ name: t })) };
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
  // 키워드·디자인 방향: stepWeb → step4(브랜딩)로 이동 (구버전 저장본은 sw에서 폴백)
  const mainKeywords = (s4.mainKeywords ?? sw.mainKeywords) as string | undefined;
  if (mainKeywords) blocks.push(bullet(`메인 키워드: ${mainKeywords}`));
  const designFocus = (s4.designFocus ?? sw.designFocus) as string | undefined;
  if (designFocus) blocks.push(bullet(`디자인 중점: ${designFocus}`));
  const mainEmphasis = (s4.mainEmphasis ?? sw.mainEmphasis) as string | undefined;
  if (mainEmphasis) blocks.push(bullet(`메인 강조: ${mainEmphasis}`));
  const photoDirection = (s4.photoDirection ?? sw.photoDirection) as string | undefined;
  if (photoDirection) blocks.push(bullet(`사진 방향: ${photoDirection}`));
  // 벤치마킹·참고 사이트: 브랜딩 1곳으로 통합. 옛 웹 '참고 사이트'(referenceSites)도 여기로 폴백, 구버전은 s5.
  const benchmark = (s4.benchmarkClinics as string) || (s5.benchmarkClinics as string) || (sw.referenceSites as string);
  if (benchmark) blocks.push(bullet(`벤치마킹·참고 사이트: ${benchmark}`));
  if (s4.driveLink) blocks.push(bullet(`자료 첨부(드라이브): ${s4.driveLink}`));
  if (s4.hasProfilePhoto) blocks.push(bullet('프로필 사진 보유'));
  if (s4.hasLogo) blocks.push(bullet('로고 파일 보유'));

  // 의료진 약력 (상세) — stepWeb → step4(브랜딩)로 이동 (구버전 저장본은 sw에서 폴백)
  const education = (s4.education ?? sw.education) as string | undefined;
  const career = (s4.career ?? sw.career) as string | undefined;
  const associations = (s4.associations ?? sw.associations) as string | undefined;
  const awards = (s4.awards ?? sw.awards) as string | undefined;
  if (education || career || associations || awards) {
    blocks.push(heading('의료진 약력'));
    if (education) blocks.push(bullet(`학력: ${education}`));
    if (career) blocks.push(bullet(`경력: ${career}`));
    if (associations) blocks.push(bullet(`학회·협회: ${associations}`));
    if (awards) blocks.push(bullet(`수상·논문·방송: ${awards}`));
  }

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

  // 계정 아이디·비밀번호는 Notion 페이지 본문에 평문으로 저장하지 않는다.

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
