import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, upsertReview } from '@/lib/db';

type ReviewInput = {
  sourceId?: string; level?: string; title?: string; titleEn?: string;
  summary?: string; summaryEn?: string; path?: string[]; labels?: string[]; excerpt?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewInput;
    if (!body.title?.trim() || !body.summary?.trim() || !body.sourceId?.trim()) {
      return NextResponse.json({ error: '候选复核项缺少必要字段。' }, { status: 400 });
    }
    await ensureSchema();
    await seedIfEmpty();
    const id = `CR-${Date.now().toString().slice(-4)}`;
    await upsertReview({
      id,
      sourceId: body.sourceId.trim(),
      level: body.level ?? 'review_recommended',
      title: body.title.trim(),
      titleEn: body.titleEn?.trim() || body.title.trim(),
      summary: body.summary.trim(),
      summaryEn: body.summaryEn?.trim() || body.summary.trim(),
      path: JSON.stringify(body.path ?? []),
      labels: JSON.stringify(body.labels ?? []),
      excerpt: body.excerpt?.trim() ?? '',
      action: null,
      rationale: null,
      updatedStatement: null,
      savedAt: null,
    });
    return NextResponse.json({ reviewId: id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存候选复核项失败。' }, { status: 500 });
  }
}
