import { beforeEach, describe, expect, it, vi } from 'vitest';

const notionMocks = vi.hoisted(() => ({
  listBlockChildren: vi.fn(),
  queryDataSource: vi.fn(),
  listUsers: vi.fn(),
  retrievePage: vi.fn(),
  updatePage: vi.fn(),
  createPage: vi.fn(),
}));

vi.mock('@/lib/notion/client', () => ({
  envTrim: () => undefined,
  notion: {
    blocks: { children: { list: notionMocks.listBlockChildren } },
    dataSources: { query: notionMocks.queryDataSource },
    users: { list: notionMocks.listUsers },
    pages: {
      retrieve: notionMocks.retrievePage,
      update: notionMocks.updatePage,
      create: notionMocks.createPage,
    },
  },
  withRetry: async <T>(operation: () => Promise<T>): Promise<T> => operation(),
}));

import {
  collectMeetingActionTodos,
  resolveTeamLeadIds,
  syncCheckedMeetingActions,
} from '@/lib/notion/meeting-tasks';

const MEETING_DATA_SOURCE_ID = '73219abe-2f01-40d3-9ced-da8afb3e3213';
const PEOPLE_DATA_SOURCE_ID = '3599a82d-b9c4-8078-89a8-000bfce48529';
const TASK_DATA_SOURCE_ID = '3a69a82d-b9c4-8214-8cfb-072eab74db61';

function richText(text: string) {
  return [{ plain_text: text }];
}

function heading(id: string, text: string, type: 'heading_1' | 'heading_2' | 'heading_3' = 'heading_2') {
  return { id, type, has_children: false, [type]: { rich_text: richText(text) } };
}

function todo(id: string, text: string, checked: boolean) {
  return {
    id,
    type: 'to_do',
    has_children: false,
    to_do: { rich_text: richText(text), checked },
  };
}

function routedVideoLead() {
  return {
    id: 'person-row-video-lead',
    properties: {
      '업무 배분 담당팀': { multi_select: [{ name: '영상팀' }] },
      사람명: { title: richText('박종혁') },
      사람: { people: [{ id: 'video-lead-user', name: '종혁' }] },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  notionMocks.updatePage.mockResolvedValue({ id: 'updated' });
  notionMocks.listUsers.mockResolvedValue({ results: [], has_more: false });
  notionMocks.queryDataSource.mockResolvedValue({ results: [], has_more: false });
  notionMocks.listBlockChildren.mockResolvedValue({ results: [], has_more: false });
});

describe('collectMeetingActionTodos', () => {
  it('paginates and recursively collects to-dos only inside the action-item section', async () => {
    notionMocks.listBlockChildren.mockImplementation(async (args: {
      block_id: string;
      start_cursor?: string;
    }) => {
      if (args.block_id === 'meeting-1' && !args.start_cursor) {
        return {
          results: [
            heading('action-heading', '액션 아이템'),
            { id: 'nested-toggle', type: 'toggle', has_children: true, toggle: { rich_text: richText('세부 업무') } },
          ],
          has_more: true,
          next_cursor: 'meeting-page-2',
        };
      }
      if (args.block_id === 'meeting-1' && args.start_cursor === 'meeting-page-2') {
        return {
          results: [
            heading('next-heading', '결정 사항'),
            todo('outside-action', '[마케팅팀] 이 업무는 수집하지 않음', true),
          ],
          has_more: false,
        };
      }
      if (args.block_id === 'nested-toggle') {
        return {
          results: [todo('nested-action', '[영상팀] 촬영본 편집', true)],
          has_more: false,
        };
      }
      throw new Error(`Unexpected block query: ${JSON.stringify(args)}`);
    });

    await expect(collectMeetingActionTodos('meeting-1')).resolves.toEqual([
      { blockId: 'nested-action', text: '[영상팀] 촬영본 편집', checked: true },
    ]);
    expect(notionMocks.listBlockChildren).toHaveBeenCalledWith(expect.objectContaining({
      block_id: 'meeting-1',
      start_cursor: 'meeting-page-2',
    }));
  });
});

describe('resolveTeamLeadIds', () => {
  it('uses the PeopleDB 사람 account ID even when its display name differs from 사람명', async () => {
    notionMocks.queryDataSource.mockImplementation(async (args: { data_source_id: string }) => {
      if (args.data_source_id !== PEOPLE_DATA_SOURCE_ID) throw new Error('Unexpected data source');
      return { results: [routedVideoLead()], has_more: false };
    });
    const owners = await resolveTeamLeadIds(['영상팀', '영상팀']);

    expect(owners.get('영상팀')).toBe('video-lead-user');
    expect(notionMocks.listUsers).not.toHaveBeenCalled();
    expect(notionMocks.queryDataSource).toHaveBeenCalledWith(expect.objectContaining({
      data_source_id: PEOPLE_DATA_SOURCE_ID,
      filter: { property: '재직상태', select: { equals: '재직' } },
    }));
  });

  it.each([
    ['비어 있으면', []],
    ['여러 개면', [{ id: 'account-1', name: '계정 1' }, { id: 'account-2', name: '계정 2' }]],
  ])('사람 계정이 %s 오배정하지 않고 중단한다', async (_label, accounts) => {
    const owner = routedVideoLead();
    owner.properties.사람 = { people: accounts };
    notionMocks.queryDataSource.mockResolvedValue({ results: [owner], has_more: false });

    await expect(resolveTeamLeadIds(['영상팀'])).rejects.toThrow("사람DB '사람' 계정을 정확히 1개");
    expect(notionMocks.listUsers).not.toHaveBeenCalled();
  });
});

describe('syncCheckedMeetingActions', () => {
  function arrangeCheckedVideoAction(clientRelations: Array<{ id: string }>) {
    notionMocks.retrievePage.mockResolvedValue({
      id: 'meeting-1',
      parent: { data_source_id: MEETING_DATA_SOURCE_ID },
      properties: {
        상태: { status: { name: '완료' } },
        'Related to 거래처DB (미팅 기록)': { relation: clientRelations },
        '생성 업무': { relation: [] },
      },
    });
    notionMocks.listBlockChildren.mockResolvedValue({
      results: [
        heading('action-heading', '액션 아이템'),
        todo('action-block-1', '[영상팀] 촬영본 편집 | 마감일: 다음 주 | 근거: 원장 요청', true),
      ],
      has_more: false,
    });
    notionMocks.listUsers.mockResolvedValue({
      results: [{ id: 'video-lead-user', type: 'person', name: '박종혁' }],
      has_more: false,
    });
  }

  it('clears a stale automation error after every action item is unchecked', async () => {
    notionMocks.retrievePage.mockResolvedValue({
      id: 'meeting-1',
      parent: { data_source_id: MEETING_DATA_SOURCE_ID },
      properties: {
        상태: { status: { name: '완료' } },
        '업무 생성 상태': { select: { name: '오류' } },
        'Related to 거래처DB (미팅 기록)': { relation: [{ id: 'client-1' }] },
        '생성 업무': { relation: [] },
      },
    });
    notionMocks.listBlockChildren.mockResolvedValue({
      results: [heading('action-heading', '액션 아이템'), todo('unchecked', '[영상팀] 촬영본 편집', false)],
      has_more: false,
    });

    const result = await syncCheckedMeetingActions('meeting-1');

    expect(result).toMatchObject({ checked: 0, ignored: true });
    expect(notionMocks.updatePage).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({
        '업무 생성 상태': { select: { name: '대기' } },
        '업무 생성 오류': { rich_text: [] },
      }),
    }));
  });

  it('creates one lead-assigned task and reuses it on a repeated webhook delivery', async () => {
    arrangeCheckedVideoAction([{ id: 'client-1' }]);
    let taskExists = false;
    const createdTask = {
      id: 'task-1',
      created_time: '2026-08-21T00:00:00.000Z',
      properties: {
        업무명: { title: richText('촬영본 편집') },
        담당팀: { select: { name: '영상팀' } },
        관련거래처: { relation: [{ id: 'client-1' }] },
        '원본 미팅': { relation: [{ id: 'meeting-1' }] },
      },
    };

    notionMocks.queryDataSource.mockImplementation(async (args: { data_source_id: string }) => {
      if (args.data_source_id === PEOPLE_DATA_SOURCE_ID) {
        return { results: [routedVideoLead()], has_more: false };
      }
      if (args.data_source_id === TASK_DATA_SOURCE_ID) {
        return { results: taskExists ? [createdTask] : [], has_more: false };
      }
      throw new Error(`Unexpected data source: ${args.data_source_id}`);
    });
    notionMocks.createPage.mockImplementation(async () => {
      taskExists = true;
      return createdTask;
    });

    const first = await syncCheckedMeetingActions('meeting-1');
    expect(first).toMatchObject({ checked: 1, created: 1, existing: 0, errors: [] });
    expect(notionMocks.createPage).toHaveBeenCalledTimes(1);

    const createPayload = notionMocks.createPage.mock.calls[0][0];
    expect(createPayload.properties).toEqual(expect.objectContaining({
      업무명: { title: [{ text: { content: '촬영본 편집' } }] },
      관련거래처: { relation: [{ id: 'client-1' }] },
      '원본 미팅': { relation: [{ id: 'meeting-1' }] },
      담당팀: { select: { name: '영상팀' } },
      담당자: { people: [{ id: 'video-lead-user' }] },
      '담당 직원': { relation: [{ id: 'person-row-video-lead' }] },
      '원본 액션 블록 ID': { rich_text: [{ text: { content: 'action-block-1' } }] },
    }));
    expect(notionMocks.updatePage).toHaveBeenLastCalledWith(expect.objectContaining({
      page_id: 'meeting-1',
      properties: expect.objectContaining({
        '업무 생성 상태': { select: { name: '생성완료' } },
        '생성 업무': { relation: [{ id: 'task-1' }] },
      }),
    }));

    const second = await syncCheckedMeetingActions('meeting-1');
    expect(second).toMatchObject({ checked: 1, created: 0, existing: 1, errors: [] });
    expect(notionMocks.createPage).toHaveBeenCalledTimes(1);
  });

  it('does not create anything when the meeting has no single related client', async () => {
    arrangeCheckedVideoAction([]);

    const result = await syncCheckedMeetingActions('meeting-1');

    expect(result.created).toBe(0);
    expect(result.errors.join('\n')).toContain('정확히 1개');
    expect(notionMocks.createPage).not.toHaveBeenCalled();
    expect(notionMocks.updatePage).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({
        '업무 생성 상태': { select: { name: '오류' } },
      }),
    }));
  });

  it('self-heals a concurrent duplicate and keeps the earliest matching task', async () => {
    arrangeCheckedVideoAction([{ id: 'client-1' }]);
    let created = false;
    const taskProperties = {
      업무명: { title: richText('촬영본 편집') },
      담당팀: { select: { name: '영상팀' } },
      관련거래처: { relation: [{ id: 'client-1' }] },
      '원본 미팅': { relation: [{ id: 'meeting-1' }] },
    };
    const earlier = { id: 'task-earlier', created_time: '2026-08-20T23:59:59.000Z', properties: taskProperties };
    const ours = { id: 'task-ours', created_time: '2026-08-21T00:00:00.000Z', properties: taskProperties };

    notionMocks.queryDataSource.mockImplementation(async (args: {
      data_source_id: string;
      filter?: { property?: string };
    }) => {
      if (args.data_source_id === PEOPLE_DATA_SOURCE_ID) {
        return { results: [routedVideoLead()], has_more: false };
      }
      if (args.data_source_id === TASK_DATA_SOURCE_ID) {
        if (args.filter?.property === '원본 미팅') return { results: [], has_more: false };
        return { results: created ? [earlier, ours] : [], has_more: false };
      }
      throw new Error('Unexpected data source');
    });
    notionMocks.createPage.mockImplementation(async () => {
      created = true;
      return ours;
    });

    const result = await syncCheckedMeetingActions('meeting-1');

    expect(result).toMatchObject({ created: 0, existing: 1, errors: [] });
    expect(notionMocks.updatePage).toHaveBeenCalledWith(expect.objectContaining({
      page_id: 'task-ours',
      archived: true,
    }));
    expect(notionMocks.updatePage).toHaveBeenLastCalledWith(expect.objectContaining({
      page_id: 'meeting-1',
      properties: expect.objectContaining({
        '생성 업무': { relation: [{ id: 'task-earlier' }] },
      }),
    }));
  });

  it('reports a source edit that conflicts with an already-created task', async () => {
    arrangeCheckedVideoAction([{ id: 'client-1' }]);
    const staleTask = {
      id: 'task-stale',
      created_time: '2026-08-20T00:00:00.000Z',
      properties: {
        업무명: { title: richText('이전 업무명') },
        담당팀: { select: { name: '마케팅팀' } },
        관련거래처: { relation: [{ id: 'client-1' }] },
        '원본 미팅': { relation: [{ id: 'meeting-1' }] },
      },
    };
    notionMocks.queryDataSource.mockImplementation(async (args: { data_source_id: string }) => {
      if (args.data_source_id === PEOPLE_DATA_SOURCE_ID) {
        return { results: [routedVideoLead()], has_more: false };
      }
      if (args.data_source_id === TASK_DATA_SOURCE_ID) {
        return { results: [staleTask], has_more: false };
      }
      throw new Error('Unexpected data source');
    });

    const result = await syncCheckedMeetingActions('meeting-1');

    expect(result.created).toBe(0);
    expect(result.errors.join('\n')).toContain('기존 생성 업무와 현재 액션 아이템');
    expect(notionMocks.createPage).not.toHaveBeenCalled();
  });
});

