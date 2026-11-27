import { beforeEach, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), query: vi.fn(), db: vi.fn(), ds: vi.fn(), list: vi.fn(), append: vi.fn() }));
vi.mock('@notionhq/client', () => ({ Client: class { pages = { create: m.create, retrieve: m.retrieve, update: m.update }; databases = { retrieve: m.db }; dataSources = { retrieve: m.ds, query: m.query }; blocks = { children: { list: m.list, append: m.append } }; }, isNotionClientError: () => false }));
import { ensureOpeningSetup } from '@/lib/notion';
let tasks: Array<{ id: string; properties: Record<string, unknown> }>;
let blocks: Record<string, unknown[]>;
beforeEach(() => {
  vi.clearAllMocks(); tasks = []; blocks = {};
  m.retrieve.mockResolvedValue({ properties: { '신규 업무 생성': { checkbox: true } } });
  m.db.mockResolvedValue({ data_sources: [{ id: 'tasks' }] });
  m.ds.mockResolvedValue({ properties: { 업무명: { type: 'title' } } });
  m.query.mockImplementation(async ({ data_source_id }) => {
    if (data_source_id !== 'tasks') throw new Error('Opening tasks must not depend on PeopleDB');
    return { results: tasks };
  });
  m.create.mockImplementation(async ({ properties }) => { const p = { id: 'task-' + tasks.length, properties }; tasks.push(p); blocks[p.id] = []; return p; });
  m.list.mockImplementation(async ({ block_id }) => ({ results: blocks[block_id] || [], has_more: false }));
  m.append.mockImplementation(async ({ block_id, children }) => { blocks[block_id].push(...children); return {}; });
  m.update.mockResolvedValue({});
});
it('creates twelve unassigned tasks without PeopleDB and preserves their checklists on retry', async () => {
  expect(await ensureOpeningSetup('client')).toEqual({ created: 12, existing: 0 });
  expect(m.create).toHaveBeenCalledTimes(12);
  for (const [payload] of m.create.mock.calls) {
    expect(payload.properties['담당자']).toEqual({ people: [] });
    expect(payload.properties['담당 직원']).toEqual({ relation: [] });
    expect(payload.properties['담당팀']).toEqual({ select: { name: '마케팅팀' } });
  }
  expect(Object.values(blocks).every(items => items.length >= 5)).toBe(true);
  expect(await ensureOpeningSetup('client')).toEqual({ created: 0, existing: 12 });
  expect(m.create).toHaveBeenCalledTimes(12);
  expect(m.append).toHaveBeenCalledTimes(12);
});
it('preserves manually assigned staff when an existing client is retried', async () => {
  await ensureOpeningSetup('client');
  tasks[0].properties['담당자'] = { people: [{ id: 'manually-assigned-user' }] };
  tasks[0].properties['담당 직원'] = { relation: [{ id: 'manually-assigned-employee' }] };
  m.update.mockClear();

  expect(await ensureOpeningSetup('client')).toEqual({ created: 0, existing: 12 });
  expect(m.update.mock.calls.every(([payload]) => payload.page_id === 'client')).toBe(true);
  expect(tasks[0].properties['담당자']).toEqual({ people: [{ id: 'manually-assigned-user' }] });
  expect(tasks[0].properties['담당 직원']).toEqual({ relation: [{ id: 'manually-assigned-employee' }] });
});
it('coalesces concurrent requests for the same client', async () => {
  await Promise.all([ensureOpeningSetup('client'), ensureOpeningSetup('client')]);
  expect(m.create).toHaveBeenCalledTimes(12);
});
it('retains partial work and fills the missing tasks on retry', async () => {
  const create = m.create.getMockImplementation()!;
  m.create.mockImplementation(async (...args) => { if (tasks.length === 4) throw Error('network'); return create(...args); });
  await expect(ensureOpeningSetup('client')).rejects.toThrow('network');
  expect(tasks).toHaveLength(4);
  expect(m.update).not.toHaveBeenCalled();
  m.create.mockImplementation(create);
  expect(await ensureOpeningSetup('client')).toEqual({ created: 8, existing: 4 });
});
it('rejects trashed clients without creating tasks', async () => {
  m.retrieve.mockResolvedValue({ in_trash: true });
  await expect(ensureOpeningSetup('client')).rejects.toThrow('휴지통');
  expect(m.create).not.toHaveBeenCalled();
});
