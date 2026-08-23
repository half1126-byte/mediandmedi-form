import {
  parseCheckedActionTodos,
  type ActionTodoCandidate,
  type MeetingTeam,
  type ParsedMeetingAction,
} from '@/lib/meeting-actions';
import { envTrim, notion, withRetry } from './client';
import { linkedPersonAccountId } from './people';

/* eslint-disable @typescript-eslint/no-explicit-any -- live Notion schemas are validated at runtime. */

const MEETING_DATABASE_ID =
  envTrim('NOTION_MEETING_DATABASE_ID') || 'f7b5f3e9-ce21-4259-9d0e-edda716e588a';
const MEETING_DATA_SOURCE_ID =
  envTrim('NOTION_MEETING_DATA_SOURCE_ID') || '73219abe-2f01-40d3-9ced-da8afb3e3213';
const TASK_DATABASE_ID =
  envTrim('NOTION_NEW_TASK_DATABASE_ID') || envTrim('NOTION_TASK_DATABASE_ID') ||
  '97e9a82d-b9c4-8349-9bea-01e15d30e007';
const TASK_DATA_SOURCE_ID =
  envTrim('NOTION_TASK_DATA_SOURCE_ID') || '3a69a82d-b9c4-8214-8cfb-072eab74db61';
const PEOPLE_DATA_SOURCE_ID =
  envTrim('NOTION_PEOPLE_DATA_SOURCE_ID') || '3599a82d-b9c4-8078-89a8-000bfce48529';

const ROUTING_PROPERTY = '업무 배분 담당팀';
const SOURCE_BLOCK_PROPERTY = '원본 액션 블록 ID';
const MAX_BLOCK_DEPTH = 10;
const MAX_BLOCK_COUNT = 3_000;

type AnyPage = any;
type AnyBlock = any;

export interface MeetingActionSyncResult {
  meetingId: string;
  checked: number;
  created: number;
  existing: number;
  ignored: boolean;
  errors: string[];
}

function normalizeId(id: string | undefined): string {
  return (id || '').replace(/-/g, '').toLowerCase();
}

function richText(value: any): string {
  const items = value?.rich_text || value?.title || [];
  return items
    .map((item: any) => item.plain_text || item.text?.content || '')
    .join('')
    .trim();
}

function blockText(block: AnyBlock): string {
  return richText(block?.[block?.type]);
}

function headingRank(type: string): number | null {
  if (type === 'heading_1') return 1;
  if (type === 'heading_2') return 2;
  if (type === 'heading_3') return 3;
  return null;
}

function isActionHeading(text: string): boolean {
  const normalized = text.replace(/[\s:_-]/g, '').toLocaleLowerCase('ko-KR');
  return normalized === '액션아이템' || normalized === 'actionitem' || normalized === 'actionitems';
}

async function listChildren(blockId: string): Promise<AnyBlock[]> {
  const results: AnyBlock[] = [];
  let cursor: string | undefined;
  do {
    const response = await withRetry(() => notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })) as any;
    results.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);
  return results;
}

/** Finds to-do blocks only inside a heading named “액션 아이템”. */
export async function collectMeetingActionTodos(meetingId: string): Promise<ActionTodoCandidate[]> {
  const candidates: ActionTodoCandidate[] = [];
  const visited = new Set<string>();
  let inspected = 0;

  async function scanContainer(
    parentId: string,
    inheritedSection = false,
    inheritedRank = Number.POSITIVE_INFINITY,
    depth = 0,
  ): Promise<void> {
    if (depth > MAX_BLOCK_DEPTH) throw new Error('미팅 본문 중첩 깊이가 안전 한도를 초과했습니다.');
    if (visited.has(parentId)) return;
    visited.add(parentId);

    const children = await listChildren(parentId);
    let inActionSection = inheritedSection;
    let actionHeadingRank = inheritedRank;

    for (const block of children) {
      inspected += 1;
      if (inspected > MAX_BLOCK_COUNT) {
        throw new Error('미팅 본문 블록 수가 안전 한도를 초과했습니다.');
      }

      const rank = headingRank(block.type);
      if (rank !== null) {
        if (isActionHeading(blockText(block))) {
          inActionSection = true;
          actionHeadingRank = rank;
        } else if (inActionSection && rank <= actionHeadingRank) {
          inActionSection = false;
          actionHeadingRank = Number.POSITIVE_INFINITY;
        }
      }

      if (inActionSection && block.type === 'to_do') {
        candidates.push({
          blockId: block.id,
          text: blockText(block),
          checked: block.to_do?.checked === true,
        });
      }

      if (block.has_children) {
        await scanContainer(block.id, inActionSection, actionHeadingRank, depth + 1);
      }
    }
  }

  await scanContainer(meetingId);
  return candidates;
}

async function queryAll(dataSourceId: string, filter?: Record<string, unknown>): Promise<AnyPage[]> {
  const pages: AnyPage[] = [];
  let cursor: string | undefined;
  do {
    const response = await withRetry(() => notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(filter ? { filter } : {}),
      ...(cursor ? { start_cursor: cursor } : {}),
    } as any)) as any;
    pages.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);
  return pages;
}

interface TeamLeadAssignment {
  accountId: string;
  peoplePageId: string;
}

/** Resolves the one active PeopleDB routing owner for each requested team. */
async function resolveTeamLeadAssignments(
  teams: readonly MeetingTeam[],
): Promise<Map<MeetingTeam, TeamLeadAssignment>> {
  const requestedTeams = [...new Set(teams)];
  const activePeople = await queryAll(PEOPLE_DATA_SOURCE_ID, {
    property: '재직상태',
    select: { equals: '재직' },
  });

  const result = new Map<MeetingTeam, TeamLeadAssignment>();
  for (const team of requestedTeams) {
    const owners = activePeople.filter((page) =>
      (page.properties?.[ROUTING_PROPERTY]?.multi_select || [])
        .some((option: any) => option.name === team));
    if (owners.length !== 1) {
      throw new Error(`사람DB에서 ${team} 우선 배정 팀장을 정확히 1명 지정해야 합니다. 현재 ${owners.length}명입니다.`);
    }

    const owner = owners[0];
    const employeeName = richText(owner.properties?.['사람명']);
    const ownerLabel = employeeName || `${team} 우선 배정 팀장`;
    result.set(team, {
      accountId: linkedPersonAccountId(owner, ownerLabel),
      peoplePageId: owner.id,
    });
  }
  return result;
}

export async function resolveTeamLeadIds(teams: readonly MeetingTeam[]): Promise<Map<MeetingTeam, string>> {
  const assignments = await resolveTeamLeadAssignments(teams);
  return new Map([...assignments].map(([team, assignment]) => [team, assignment.accountId]));
}

async function findTasksBySourceBlock(blockId: string): Promise<AnyPage[]> {
  return queryAll(TASK_DATA_SOURCE_ID, {
    property: SOURCE_BLOCK_PROPERTY,
    rich_text: { equals: blockId },
  });
}

async function findTasksByMeeting(meetingId: string): Promise<AnyPage[]> {
  return queryAll(TASK_DATA_SOURCE_ID, {
    property: '원본 미팅',
    relation: { contains: meetingId },
  });
}

function sortPagesByCreatedTime(pages: readonly AnyPage[]): AnyPage[] {
  return [...pages].sort((a, b) => {
    const time = String(a.created_time || '').localeCompare(String(b.created_time || ''));
    return time || String(a.id).localeCompare(String(b.id));
  });
}

async function reconcileSourceDuplicates(pages: readonly AnyPage[]): Promise<{
  keeper?: AnyPage;
  archivedIds: string[];
}> {
  const sorted = sortPagesByCreatedTime(pages);
  const keeper = sorted[0];
  const duplicates = sorted.slice(1);
  for (const duplicate of duplicates) {
    await withRetry(() => notion.pages.update({ page_id: duplicate.id, archived: true }));
  }
  return { keeper, archivedIds: duplicates.map((page) => page.id) };
}

async function settledSourceTasks(blockId: string, created: AnyPage): Promise<AnyPage[]> {
  const observed = new Map<string, AnyPage>([[created.id, created]]);
  const waits = process.env.NODE_ENV === 'test' ? [0, 0] : [150, 500];
  for (const waitMs of waits) {
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    for (const page of await findTasksBySourceBlock(blockId)) observed.set(page.id, page);
  }
  return [...observed.values()];
}

function existingTaskConflict(
  task: AnyPage,
  meetingId: string,
  clientId: string,
  action: ParsedMeetingAction,
): string | undefined {
  const properties = task.properties || {};
  const differences: string[] = [];
  if (richText(properties['업무명']) !== action.title) differences.push('업무명');
  if (properties['담당팀']?.select?.name !== action.team) differences.push('담당팀');
  const clientIds = (properties['관련거래처']?.relation || []).map((item: AnyPage) => normalizeId(item.id));
  if (clientIds.length !== 1 || clientIds[0] !== normalizeId(clientId)) differences.push('관련거래처');
  const meetingIds = (properties['원본 미팅']?.relation || []).map((item: AnyPage) => normalizeId(item.id));
  if (!meetingIds.includes(normalizeId(meetingId))) differences.push('원본 미팅');
  if (differences.length === 0) return undefined;
  return `기존 생성 업무와 현재 액션 아이템의 ${differences.join('·')}이 다릅니다. 기존 업무를 확인한 뒤 새 체크박스로 다시 요청해 주세요.`;
}

function meetingUrl(meetingId: string): string {
  return `https://www.notion.so/${meetingId.replace(/-/g, '')}`;
}

function taskDetail(action: ParsedMeetingAction, meetingId: string): string {
  const lines = [
    '미팅의 체크된 액션 아이템에서 자동 생성되었습니다.',
    `원문: ${action.rawText}`,
  ];
  if (action.deadlineText) lines.push(`마감 안내: ${action.deadlineText}`);
  if (action.reason) lines.push(`근거: ${action.reason}`);
  lines.push(`원본 미팅: ${meetingUrl(meetingId)}`);
  return lines.join('\n').slice(0, 1_900);
}

async function createTask(
  meetingId: string,
  clientId: string,
  action: ParsedMeetingAction,
  assigneeId: string,
  assigneePeoplePageId: string,
): Promise<AnyPage> {
  const sourceUrl = meetingUrl(meetingId);
  return withRetry(() => notion.pages.create({
    parent: { database_id: TASK_DATABASE_ID },
    properties: {
      '업무명': { title: [{ text: { content: action.title } }] },
      '관련거래처': { relation: [{ id: clientId }] },
      '원본 미팅': { relation: [{ id: meetingId }] },
      '담당팀': { select: { name: action.team } },
      '담당자': { people: [{ id: assigneeId }] },
      '담당 직원': { relation: [{ id: assigneePeoplePageId }] },
      '업무상태': { status: { name: '요청접수' } },
      '우선순위': { select: { name: '보통' } },
      '내용': { rich_text: [{ text: { content: taskDetail(action, meetingId) } }] },
      [SOURCE_BLOCK_PROPERTY]: { rich_text: [{ text: { content: action.blockId } }] },
    } as any,
    children: [
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '📝' },
          rich_text: [{
            type: 'text',
            text: { content: '미팅에서 사람이 체크해 확정한 액션 아이템입니다. 팀장이 세부 담당자를 지정해 주세요.' },
          }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: '원본 미팅 열기', link: { url: sourceUrl } } },
          ],
        },
      },
    ] as any,
  })) as Promise<AnyPage>;
}

async function updateMeeting(
  meetingId: string,
  state: '대기' | '생성중' | '생성완료' | '오류',
  error: string,
  relationIds?: readonly string[],
): Promise<void> {
  await withRetry(() => notion.pages.update({
    page_id: meetingId,
    properties: {
      '업무 생성 상태': { select: { name: state } },
      '업무 생성 오류': {
        rich_text: error ? [{ text: { content: error.slice(0, 1_900) } }] : [],
      },
      ...(relationIds ? {
        '생성 업무': { relation: relationIds.map((id) => ({ id })) },
      } : {}),
      ...(state === '생성완료' ? { '업무 생성 요청': { checkbox: false } } : {}),
    } as any,
  }));
}

function pageBelongsToMeetingDataSource(page: AnyPage): boolean {
  const parentId = page.parent?.data_source_id || page.parent?.database_id;
  return [MEETING_DATA_SOURCE_ID, MEETING_DATABASE_ID]
    .some((expected) => normalizeId(parentId) === normalizeId(expected));
}

function existingRelationIds(properties: AnyPage): string[] {
  return (properties?.['생성 업무']?.relation || []).map((item: AnyPage) => item.id);
}

/**
 * Converts checked action-item to-dos into team-lead-owned tasks.
 * Unchecking never deletes an existing task; the source block ID prevents duplicates.
 */
export async function syncCheckedMeetingActions(meetingId: string): Promise<MeetingActionSyncResult> {
  const base: MeetingActionSyncResult = {
    meetingId,
    checked: 0,
    created: 0,
    existing: 0,
    ignored: false,
    errors: [],
  };

  const meeting = await withRetry(() => notion.pages.retrieve({ page_id: meetingId })) as AnyPage;
  if (!pageBelongsToMeetingDataSource(meeting)) return { ...base, ignored: true };

  const candidates = await collectMeetingActionTodos(meetingId);
  const selection = parseCheckedActionTodos(candidates);
  base.checked = selection.actions.length + selection.errors.length;
  base.errors.push(...selection.errors);
  const props = meeting.properties || {};
  if (base.checked === 0) {
    if (props['업무 생성 상태']?.select?.name === '오류') {
      await updateMeeting(meetingId, '대기', '');
    }
    return { ...base, ignored: true };
  }

  const fatalErrors: string[] = [];
  if (props['상태']?.status?.name !== '완료') {
    fatalErrors.push('미팅 상태가 완료일 때만 체크된 액션 아이템을 업무로 만들 수 있습니다.');
  }

  const clients = props['Related to 거래처DB (미팅 기록)']?.relation || [];
  if (clients.length !== 1) {
    fatalErrors.push(`신 거래처DB 관계를 정확히 1개 연결해야 합니다. 현재 ${clients.length}개입니다.`);
  }

  if (fatalErrors.length > 0 || selection.actions.length === 0) {
    base.errors.push(...fatalErrors);
    await updateMeeting(meetingId, '오류', base.errors.join('\n'));
    return base;
  }

  const relatedTaskIds = new Set(existingRelationIds(props));
  try {
    // A page retrieve response inlines only a bounded number of relation items.
    // Merge the inverse task query so updating the relation never drops item 26+.
    for (const task of await findTasksByMeeting(meetingId)) relatedTaskIds.add(task.id);

    // Invalid checked rows are reported, while independently valid checked
    // rows continue. This avoids losing good work because one row is malformed.
    await updateMeeting(meetingId, '생성중', base.errors.join('\n'));
    const clientId = clients[0].id;
    const owners = await resolveTeamLeadAssignments(selection.actions.map((action) => action.team));

    for (const action of selection.actions) {
      try {
        let matching = await findTasksBySourceBlock(action.blockId);
        if (matching.length > 0) {
          const reconciled = await reconcileSourceDuplicates(matching);
          for (const archivedId of reconciled.archivedIds) relatedTaskIds.delete(archivedId);
          const keeper = reconciled.keeper!;
          relatedTaskIds.add(keeper.id);
          const conflict = existingTaskConflict(keeper, meetingId, clientId, action);
          if (conflict) throw new Error(conflict);
          base.existing += 1;
          continue;
        }

        const owner = owners.get(action.team)!;
        const created = await createTask(
          meetingId,
          clientId,
          action,
          owner.accountId,
          owner.peoplePageId,
        );

        // Query again after creation. If two webhook invocations raced, keep the
        // earliest page and archive only this invocation's duplicate.
        matching = await settledSourceTasks(action.blockId, created);
        const reconciled = await reconcileSourceDuplicates(matching);
        for (const archivedId of reconciled.archivedIds) relatedTaskIds.delete(archivedId);
        const keeper = reconciled.keeper!;
        relatedTaskIds.add(keeper.id);
        const conflict = existingTaskConflict(keeper, meetingId, clientId, action);
        if (conflict) throw new Error(conflict);
        if (keeper.id !== created.id) {
          base.existing += 1;
        } else {
          base.created += 1;
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '알 수 없는 오류';
        base.errors.push(`[${action.team}] ${action.title}: ${message}`);
      }
    }
  } catch (cause) {
    base.errors.push(cause instanceof Error ? cause.message : '업무 생성 준비 중 알 수 없는 오류가 발생했습니다.');
  }

  const relationIds = [...relatedTaskIds];
  if (base.errors.length > 0) {
    await updateMeeting(meetingId, '오류', base.errors.join('\n'), relationIds);
  } else {
    await updateMeeting(meetingId, '생성완료', '', relationIds);
  }
  return base;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

