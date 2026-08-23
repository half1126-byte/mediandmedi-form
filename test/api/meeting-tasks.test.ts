import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  syncCheckedMeetingActions: vi.fn(),
}));

vi.mock('@/lib/notion/meeting-tasks', () => ({
  syncCheckedMeetingActions: routeMocks.syncCheckedMeetingActions,
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/notion/meeting-tasks/route';

const MEETING_ID = '3c39a82d-b9c4-80e2-9e53-daa7612bf931';

function request(
  body: string,
  options: { headers?: Record<string, string>; query?: string } = {},
) {
  return new NextRequest(`http://localhost/api/notion/meeting-tasks${options.query || ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('MEETING_AUTOMATION_SECRET', 'legacy-secret');
  delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  delete process.env.NOTION_WEBHOOK_SETUP_SECRET;
  routeMocks.syncCheckedMeetingActions.mockResolvedValue({
    meetingId: MEETING_ID,
    checked: 1,
    created: 1,
    existing: 0,
    ignored: false,
    errors: [],
  });
});

describe('POST /api/notion/meeting-tasks', () => {
  it('rejects a valid JSON value that is not an event object', async () => {
    const response = await POST(request('null'));
    expect(response.status).toBe(400);
    expect(routeMocks.syncCheckedMeetingActions).not.toHaveBeenCalled();
  });

  it('rejects an unsigned, unauthenticated event', async () => {
    const response = await POST(request(JSON.stringify({
      type: 'page.content_updated',
      entity: { id: MEETING_ID },
    })));

    expect(response.status).toBe(401);
    expect(routeMocks.syncCheckedMeetingActions).not.toHaveBeenCalled();
  });

  it('accepts the legacy Notion automation secret and completes the meeting sync', async () => {
    const response = await POST(request(JSON.stringify({ page_id: MEETING_ID }), {
      headers: { 'x-automation-secret': 'legacy-secret' },
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, processed: true, meetingId: MEETING_ID });
    expect(routeMocks.syncCheckedMeetingActions).toHaveBeenCalledWith(MEETING_ID);
  });

  it('accepts a valid Notion HMAC signature for a page content event', async () => {
    vi.stubEnv('NOTION_WEBHOOK_VERIFICATION_TOKEN', 'verification-token');
    const rawBody = JSON.stringify({
      type: 'page.content_updated',
      entity: { id: MEETING_ID },
      authors: [{ type: 'person', id: 'person-1' }],
    });
    const signature = `sha256=${createHmac('sha256', 'verification-token').update(rawBody).digest('hex')}`;

    const response = await POST(request(rawBody, {
      headers: { 'x-notion-signature': signature },
    }));

    expect(response.status).toBe(200);
    expect(routeMocks.syncCheckedMeetingActions).toHaveBeenCalledWith(MEETING_ID);
  });

  it('accepts subscription verification only with the setup secret and never logs plaintext', async () => {
    vi.stubEnv('NOTION_WEBHOOK_SETUP_SECRET', 'setup-secret');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const response = await POST(request(JSON.stringify({ verification_token: 'one-time-token' }), {
      query: '?setup=setup-secret',
    }));

    expect(response.status).toBe(200);
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).toContain('[notion-webhook-verification]');
    expect(logged).not.toContain('one-time-token');
    expect(routeMocks.syncCheckedMeetingActions).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('acknowledges unsupported or bot-only events without scheduling work', async () => {
    const unsupported = await POST(request(JSON.stringify({
      type: 'database.schema_updated',
      entity: { id: MEETING_ID },
    }), { headers: { 'x-automation-secret': 'legacy-secret' } }));
    expect(unsupported.status).toBe(200);
    await expect(unsupported.json()).resolves.toMatchObject({ success: true, ignored: true });

    const botOnly = await POST(request(JSON.stringify({
      type: 'page.properties_updated',
      entity: { id: MEETING_ID },
      authors: [{ type: 'bot', id: 'bot-1' }],
    }), { headers: { 'x-automation-secret': 'legacy-secret' } }));
    expect(botOnly.status).toBe(200);
    await expect(botOnly.json()).resolves.toMatchObject({ success: true, ignored: true });
    expect(routeMocks.syncCheckedMeetingActions).not.toHaveBeenCalled();
  });

  it('returns a retryable 503 for unexpected processing failures', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    routeMocks.syncCheckedMeetingActions.mockRejectedValueOnce(new Error('Notion temporarily unavailable'));
    const response = await POST(request(JSON.stringify({ page_id: MEETING_ID }), {
      headers: { 'x-automation-secret': 'legacy-secret' },
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
