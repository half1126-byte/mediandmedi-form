import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// 스킬 MD 로드 (빌드 타임에 번들됨)
function loadSkill(): string {
  try {
    const skillPath = join(process.cwd(), '..', '기획안', 'medandmedi-planner', 'skills', 'clinic-marketing-planner.md');
    return readFileSync(skillPath, 'utf-8');
  } catch {
    return FALLBACK_SKILL;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY === '여기에_API_키_입력') {
    return NextResponse.json({ error: 'CLAUDE_API_KEY 환경변수를 설정해주세요.' }, { status: 500, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { mode, clinicName, specialty, platform, items, concept, brief } = body;

    const skill = loadSkill();
    const systemPrompt = `${skill}\n\n---\n\n## 응답 규칙\n- 반드시 한국어로 답변하세요.\n- 마크다운 형식으로 구조화하여 출력하세요.\n- 의료광고법을 준수하는 표현만 사용하세요.\n- 실용적이고 바로 사용 가능한 내용을 제공하세요.`;

    const userPrompt = buildPrompt({ mode, clinicName, specialty, platform, items, concept, brief });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const result = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ success: true, result, mode }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[ai-planner] error:', err);
    return NextResponse.json({ error: 'AI 요청 실패. 잠시 후 다시 시도해주세요.' }, { status: 500, headers: CORS_HEADERS });
  }
}

type PlannerInput = {
  mode: 'concept' | 'copy' | 'brief' | 'tasks';
  clinicName?: string;
  specialty?: string;
  platform?: string;
  items?: { name: string; quantity?: number; platform?: string }[];
  concept?: string;
  brief?: string;
};

function buildPrompt(input: PlannerInput): string {
  const { mode, clinicName, specialty, platform, items, concept, brief } = input;

  const context = [
    clinicName   && `병원명: ${clinicName}`,
    specialty    && `진료 과목: ${specialty}`,
    platform     && `주요 플랫폼: ${platform}`,
    items?.length && `제작물 목록:\n${items.map(it => `  - ${it.name}${it.quantity ? ` (${it.quantity}개)` : ''}${it.platform ? ` [${it.platform}]` : ''}`).join('\n')}`,
    concept      && `현재 컨셉 메모: ${concept}`,
    brief        && `기획 메모: ${brief}`,
  ].filter(Boolean).join('\n');

  const prompts: Record<string, string> = {
    concept: `다음 병원 정보를 바탕으로 브랜드 컨셉과 마케팅 방향을 기획해주세요.

${context}

아래 항목을 포함해서 출력해주세요:
- 브랜드 키워드 3개
- 핵심 슬로건 (10자 이내)
- 비주얼 방향 (컬러·서체·스타일)
- 타겟 고객 정의
- 채널별 포지셔닝 전략
- 주의해야 할 의료광고법 사항`,

    copy: `다음 병원 정보를 바탕으로 마케팅 카피 초안을 작성해주세요.

${context}

아래 항목을 포함해서 출력해주세요:
- 메인 슬로건 3종 (각각 다른 방향으로)
- SNS 헤드라인 5종 (인스타그램/네이버 블로그용)
- 카카오 채널 메시지 문구 2종
- CTA 버튼 문구 5종
- 각 카피에 대한 사용 맥락 설명`,

    brief: `다음 기획안 내용을 검토하고 보완점을 제안해주세요.

${context}

아래 항목을 포함해서 출력해주세요:
- 현재 기획의 강점
- 보완이 필요한 부분
- 각 제작물별 디자인 컨셉 제안
- 추가로 고려할 마케팅 포인트
- 실행 시 주의사항`,

    tasks: `다음 병원의 마케팅 상황에 맞는 제작물 목록을 추천해주세요.

${context}

아래 항목을 포함해서 출력해주세요:
- 필수 제작물 목록 (우선순위 순)
- 각 제작물의 목적과 기대 효과
- 제작 시 핵심 디자인 포인트
- 권장 제작 순서와 타임라인
- 예산 절약 팁 (선택 vs 필수 구분)`,
  };

  return prompts[mode] || prompts.concept;
}

// 스킬 파일 로드 실패 시 fallback (핵심 지침만)
const FALLBACK_SKILL = `당신은 대한민국 병의원 마케팅 분야 15년 경력의 수석 기획자입니다.
치과·피부과·성형외과·한의원 신규 개원부터 브랜드 리뉴얼까지 300개 이상 클리닉의 마케팅을 직접 설계했습니다.

핵심 원칙:
- 의료광고법 제56조 준수 (효과 보장·최상급 표현·타병원 비하 금지)
- 한국 환자 의사결정 여정 (네이버 검색 → SNS → 카카오 예약) 반영
- 실행 가능한 현실적 제안 우선
- 지역 상권과 타겟 특성 반영`;
