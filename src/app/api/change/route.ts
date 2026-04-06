import { NextRequest, NextResponse } from 'next/server';
import { createChangeRecord } from '@/lib/notion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.clinicName || !body.doctorName || !body.reason) {
      return NextResponse.json(
        { success: false, error: '필수 항목 누락' },
        { status: 400 }
      );
    }

    const pageId = await createChangeRecord(body);

    return NextResponse.json({
      success: true,
      pageId,
    });
  } catch (error) {
    console.error('Change submit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
