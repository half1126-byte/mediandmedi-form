import { Client } from '@notionhq/client';
import { classifyMeetingTask, preprocessActionItems, type MeetingTeam } from './meeting-tasks';

const notion = new Client({ auth: (process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY || '').trim() });
const TASK_DATABASE_ID = '97e9a82d-b9c4-8349-9bea-01e15d30e007';
const TASK_DATA_SOURCE_ID = '3a69a82d-b9c4-8214-8cfb-072eab74db61';

type AnyPage = any;

function textOf(prop: any): string {
  const values = prop?.rich_text || prop?.title || [];
  return values.map((item: any) => item.plain_text || item.text?.content || '').join('').trim();
}

function titleOf(page: AnyPage): string {
  return textOf(page.properties?.['업무명']);
}

async function userIdByExactName(name: string): Promise<string> {
  const matches: any[] = [];
  let cursor: string | undefined;
  do {
    const response = await notion.users.list({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    matches.push(...response.results.filter((user: any) => user.type === 'person' && user.name?.trim() === name.trim()));
    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);
  if (matches.length !== 1) throw new Error(`Notion 사용자 '${name}' 일치 결과가 ${matches.length}명입니다.`);
  return matches[0].id;
}

async function marketerId(clientPage: AnyPage): Promise<string> {
  const relations = clientPage.properties?.['담당마케터']?.relation || [];
  if (relations.length !== 1) throw new Error(`거래처 담당마케터를 정확히 1명 지정해야 합니다. 현재 ${relations.length}명입니다.`);
  const person = await notion.pages.retrieve({ page_id: relations[0].id }) as AnyPage;
  const name = textOf(person.properties?.['사람명']);
  if (!name) throw new Error('담당마케터 사람DB 페이지에 사람명이 없습니다.');
  if (person.properties?.['소속팀']?.select?.name !== '마케팅팀' || person.properties?.['재직상태']?.select?.name !== '재직') {
    throw new Error(`담당마케터 ${name}은(는) 재직 중인 마케팅팀 구성원이 아닙니다.`);
  }
  return userIdByExactName(name);
}

async function markMeeting(meetingId: string, state: '생성중' | '생성완료' | '오류', error = '', extra: Record<string, unknown> = {}) {
  await notion.pages.update({
    page_id: meetingId,
    properties: {
      '업무 생성 상태': { select: { name: state } },
      '업무 생성 오류': { rich_text: error ? [{ text: { content: error.slice(0, 1900) } }] : [] },
      ...extra,
    } as any,
  });
}

export async function ensureMeetingTasks(meetingId: string): Promise<{ created: number; existing: number }> {
  const created: string[] = [];
  try {
    const meeting = await notion.pages.retrieve({ page_id: meetingId }) as AnyPage;
    const props = meeting.properties || {};

    if (props['업무 생성 요청']?.checkbox !== true) throw new Error('업무 생성 요청이 체크되지 않았습니다.');
    if (props['상태']?.status?.name !== '완료') throw new Error('미팅 상태가 완료일 때만 업무를 생성할 수 있습니다.');

    const clients = props['Related to 거래처DB (미팅 기록)']?.relation || [];
    if (clients.length !== 1) throw new Error(`신 거래처DB 관계를 정확히 1개 연결해야 합니다. 현재 ${clients.length}개입니다.`);
    const clientId = clients[0].id;

    const items = preprocessActionItems(textOf(props['액션 아이템']));
    if (items.length === 0) throw new Error('액션 아이템이 비어 있습니다. 녹음 요약 또는 수기 작성 후 다시 요청하세요.');

    const classified = items.map((name) => ({ name, team: classifyMeetingTask(name) }));
    const meetingOwners = props['담당자']?.people || [];
    const needsNonMarketingOwner = classified.some((item) => item.team !== '마케팅팀');
    if (needsNonMarketingOwner && meetingOwners.length !== 1) {
      throw new Error(`비마케팅 업무의 책임자로 사용할 미팅 담당자를 정확히 1명 지정해야 합니다. 현재 ${meetingOwners.length}명입니다.`);
    }

    const client = await notion.pages.retrieve({ page_id: clientId }) as AnyPage;
    const marketingOwner = classified.some((item) => item.team === '마케팅팀') ? await marketerId(client) : undefined;
    const assigneeFor = (team: MeetingTeam) => team === '마케팅팀' ? marketingOwner! : meetingOwners[0].id;

    const existingPages: AnyPage[] = [];
    let cursor: string | undefined;
    do {
      const response = await notion.dataSources.query({
        data_source_id: TASK_DATA_SOURCE_ID,
        filter: { and: [
          { property: '원본 미팅', relation: { contains: meetingId } },
          { property: '관련거래처', relation: { contains: clientId } },
        ] },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      } as any) as any;
      existingPages.push(...(response.results || []));
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const byName = new Map<string, AnyPage[]>();
    for (const page of existingPages) {
      const name = titleOf(page);
      byName.set(name, [...(byName.get(name) || []), page]);
    }
    for (const { name } of classified) {
      if ((byName.get(name)?.length || 0) > 1) throw new Error(`동일 미팅·거래처·업무명 중복: ${name}`);
    }

    await markMeeting(meetingId, '생성중');
    for (const item of classified) {
      if (byName.has(item.name)) continue;
      const page = await notion.pages.create({
        parent: { database_id: TASK_DATABASE_ID },
        properties: {
          '업무명': { title: [{ text: { content: item.name } }] },
          '관련거래처': { relation: [{ id: clientId }] },
          '원본 미팅': { relation: [{ id: meetingId }] },
          '담당팀': { select: { name: item.team } },
          '담당자': { people: [{ id: assigneeFor(item.team) }] },
          '업무상태': { status: { name: '요청접수' } },
          '우선순위': { select: { name: '보통' } },
          '내용': { rich_text: [{ text: { content: `미팅 액션 아이템에서 생성: ${item.name}` } }] },
        } as any,
        children: [{
          object: 'block',
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: '📝' },
            rich_text: [{ type: 'text', text: { content: '원본 미팅의 확정된 액션 아이템에서 생성된 업무입니다. 완료 결과와 증빙을 이 페이지에 남겨 주세요.' } }],
          },
        }] as any,
      });
      created.push(page.id);
    }

    const generatedIds = [...new Set([
      ...(props['생성 업무']?.relation || []).map((relation: any) => relation.id),
      ...existingPages.filter((page) => classified.some((item) => item.name === titleOf(page))).map((page) => page.id),
      ...created,
    ])];

    await markMeeting(meetingId, '생성완료', '', {
      '생성 업무': { relation: generatedIds.map((id) => ({ id })) },
      '업무 생성 요청': { checkbox: false },
    });
    return { created: created.length, existing: classified.length - created.length };
  } catch (cause) {
    for (const id of created.reverse()) {
      try { await notion.pages.update({ page_id: id, archived: true }); } catch { /* preserve original error */ }
    }
    const message = cause instanceof Error ? cause.message : '알 수 없는 오류';
    try {
      await markMeeting(meetingId, '오류', message, { '업무 생성 요청': { checkbox: false } });
    } catch { /* preserve original error */ }
    throw new Error(message);
  }
}
