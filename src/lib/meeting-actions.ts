/**
 * Meeting-note action item parsing.
 *
 * This module intentionally has no Notion client dependency so it can be used
 * by both the API route and import tooling.
 */
export const MEETING_ACTION_TEAMS = [
  '마케팅팀',
  '바이럴팀',
  '디자인팀',
  '웹팀',
  '영상팀',
] as const;

export type MeetingActionTeam = (typeof MEETING_ACTION_TEAMS)[number];
/** Team assignment used by the meeting-action import contract. */
export type MeetingTeam = MeetingActionTeam;

const TEAM_ALIASES: Readonly<Record<string, MeetingActionTeam>> = {
  웹퍼블리셔팀: '웹팀',
};

const TEAM_PREFIXES: Readonly<Record<string, MeetingActionTeam>> = Object.fromEntries([
  ...MEETING_ACTION_TEAMS.map((team) => [team, team] as const),
  ...Object.entries(TEAM_ALIASES),
]);

export interface NotionRichTextLike {
  plain_text?: string;
  text?: { content?: string | null } | null;
}

export interface NotionToDoBlockLike {
  id: string;
  type?: string;
  to_do?: {
    checked?: boolean;
    rich_text?: readonly NotionRichTextLike[];
  } | null;
}

export interface MeetingActionItem {
  /** The source Notion block ID. */
  blockId: string;
  team: MeetingActionTeam;
  taskName: string;
  /** Display text exactly as parsed (with Markdown links converted to labels). */
  originalText: string;
  evidenceText: string | null;
  dueDateText: string | null;
}

/** Input shape used by the Notion meeting importer after it reads block data. */
export interface ActionTodoCandidate {
  blockId: string;
  text: string;
  checked: boolean;
}

/** Stable output shape for meeting-task creation. */
export interface ParsedMeetingAction {
  blockId: string;
  team: MeetingTeam;
  title: string;
  rawText: string;
  reason?: string;
  deadlineText?: string;
}

export class MeetingActionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingActionParseError';
  }
}

/** Converts Markdown links to their visible labels and normalizes whitespace. */
export function normalizeMeetingActionText(text: string): string {
  return text
    .replace(/!?(?:\[([^\]]*)\])\((?:[^()\\]|\\.)*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gets the visible text of a Notion rich-text value. */
export function getRichTextDisplayText(richText: readonly NotionRichTextLike[] | undefined): string {
  return normalizeMeetingActionText(
    (richText ?? [])
      .map((fragment) => fragment.plain_text ?? fragment.text?.content ?? '')
      .join(''),
  );
}

/**
 * Best-effort classifier for UI hints and manual review only. Do not use this
 * for automation: selected action items require an explicit team prefix.
 */
export function classifyMeetingActionByKeywords(text: string): MeetingActionTeam {
  const normalized = normalizeMeetingActionText(text).toLowerCase();
  const matches = new Set<MeetingActionTeam>();

  const keywordMap: ReadonlyArray<readonly [MeetingActionTeam, readonly string[]]> = [
    ['마케팅팀', ['마케팅', '광고', '캠페인', '브랜딩', '매체']],
    ['바이럴팀', ['바이럴', '블로그', '카페', '리뷰', '인플루언서']],
    ['디자인팀', ['디자인', '배너', '포스터', '이미지', '시안']],
    ['웹팀', ['웹', '홈페이지', '랜딩', '퍼블리싱', '퍼블리셔']],
    ['영상팀', ['영상', '촬영', '편집', '릴스', '유튜브']],
  ];

  for (const [team, keywords] of keywordMap) {
    if (keywords.some((keyword) => normalized.includes(keyword))) matches.add(team);
  }

  if (matches.size !== 1) {
    throw new MeetingActionParseError(
      matches.size === 0
        ? '업무 팀을 분류할 키워드를 찾을 수 없습니다.'
        : '업무 팀 키워드가 모호합니다.',
    );
  }
  return [...matches][0];
}

function parseExplicitTeamPrefix(text: string): { team: MeetingActionTeam; remainingText: string } {
  const match = /^\s*\[([^\]]+)\]\s*/.exec(text);
  if (!match) {
    throw new MeetingActionParseError(
      '체크된 업무에는 [마케팅팀]처럼 정확한 팀 접두어가 필요합니다.',
    );
  }

  const team = TEAM_PREFIXES[match[1].trim()];
  if (!team) {
    throw new MeetingActionParseError(
      `알 수 없는 팀 접두어입니다: [${match[1].trim()}].`,
    );
  }
  return { team, remainingText: text.slice(match[0].length).trim() };
}

function parseMetadata(text: string): {
  taskName: string;
  evidenceText: string | null;
  dueDateText: string | null;
} {
  const parts = text.split(/\s*\|\s*(?=(?:마감일|근거)\s*:)/);
  const taskName = normalizeMeetingActionText(parts.shift() ?? '');
  let evidenceText: string | null = null;
  let dueDateText: string | null = null;

  for (const part of parts) {
    const match = /^(마감일|근거)\s*:\s*([\s\S]*)$/.exec(part);
    if (!match) continue;
    const value = normalizeMeetingActionText(match[2]);
    if (match[1] === '마감일') dueDateText = value || null;
    if (match[1] === '근거') evidenceText = value || null;
  }

  return { taskName, evidenceText, dueDateText };
}

/** Parses one action item. An explicit [팀명] prefix is always required. */
export function parseMeetingActionItem(block: NotionToDoBlockLike): MeetingActionItem {
  if (!block.id?.trim()) throw new MeetingActionParseError('Notion 업무 블록 ID가 없습니다.');

  const originalText = getRichTextDisplayText(block.to_do?.rich_text);
  return parseMeetingActionText(block.id, originalText);
}

function parseMeetingActionText(blockId: string, originalText: string): MeetingActionItem {
  const { team, remainingText } = parseExplicitTeamPrefix(originalText);
  const { taskName, evidenceText, dueDateText } = parseMetadata(remainingText);

  if (taskName.length < 3 || taskName.length > 200) {
    throw new MeetingActionParseError('업무명은 메타 정보를 제외하고 3~200자여야 합니다.');
  }

  return { blockId, team, taskName, originalText, evidenceText, dueDateText };
}

export interface MeetingActionSelection {
  items: MeetingActionItem[];
  /** Checked blocks rejected for a structural reason; no inferred team is used. */
  errors: Array<{ blockId: string; message: string }>;
}

/**
 * Selects at most 30 checked Notion to-do blocks. Duplicate block IDs are
 * ignored. This automation-safe path never uses keyword classification.
 */
export function selectCheckedActionItems(
  blocks: readonly NotionToDoBlockLike[],
): MeetingActionSelection {
  const seenBlockIds = new Set<string>();
  const items: MeetingActionItem[] = [];
  const errors: MeetingActionSelection['errors'] = [];

  for (const block of blocks) {
    if (block.type && block.type !== 'to_do') continue;
    if (!block.to_do?.checked || !block.id || seenBlockIds.has(block.id)) continue;
    seenBlockIds.add(block.id);
    if (items.length >= 30) break;

    try {
      items.push(parseMeetingActionItem(block));
    } catch (error) {
      errors.push({
        blockId: block.id,
        message: error instanceof Error ? error.message : '업무 항목을 해석할 수 없습니다.',
      });
    }
  }

  return { items, errors };
}

/**
 * Parses importer candidates into the stable task-creation format.
 *
 * Only checked candidates are considered. A missing or unknown explicit team
 * prefix is reported as an error rather than being guessed from keywords.
 */
export function parseCheckedActionTodos(
  candidates: readonly ActionTodoCandidate[],
): { actions: ParsedMeetingAction[]; errors: string[] } {
  const seenBlockIds = new Set<string>();
  const actions: ParsedMeetingAction[] = [];
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (!candidate.checked || !candidate.blockId || seenBlockIds.has(candidate.blockId)) continue;
    seenBlockIds.add(candidate.blockId);
    if (actions.length >= 30) {
      errors.push('한 미팅에서 자동 생성할 체크 업무는 최대 30개입니다. 나머지는 체크를 해제하고 나눠서 처리해 주세요.');
      break;
    }

    try {
      const action = parseMeetingActionText(
        candidate.blockId,
        normalizeMeetingActionText(candidate.text),
      );
      actions.push({
        blockId: action.blockId,
        team: action.team,
        title: action.taskName,
        rawText: action.originalText,
        ...(action.evidenceText ? { reason: action.evidenceText } : {}),
        ...(action.dueDateText ? { deadlineText: action.dueDateText } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '업무 항목을 해석할 수 없습니다.';
      errors.push(`[${candidate.blockId}] ${message}`);
    }
  }

  return { actions, errors };
}

