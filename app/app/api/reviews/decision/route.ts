import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, loadContext, upsertReview, updateIntentStatement } from '@/lib/db';

type DecisionInput = { reviewId?: string; action?: string; rationale?: string; updatedStatement?: string };

const ACTIONS = ['confirm', 'revise', 'reject', 'investigate'];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DecisionInput;
    if (!body.reviewId?.startsWith('CR-')) return NextResponse.json({ error: '无效的复核编号。' }, { status: 400 });
    if (!body.action || !ACTIONS.includes(body.action)) return NextResponse.json({ error: '无效的判断动作。' }, { status: 400 });
    if (!body.rationale?.trim()) return NextResponse.json({ error: '判断理由是必填项。' }, { status: 400 });
    if (body.action === 'revise' && !body.updatedStatement?.trim()) return NextResponse.json({ error: '修改需要提供新的表述。' }, { status: 400 });

    await ensureSchema();
    await seedIfEmpty();
    const { reviews } = await loadContext();
    const review = reviews.find((item) => item.id === body.reviewId);
    if (!review) return NextResponse.json({ error: '找不到该复核项。' }, { status: 404 });

    await upsertReview({
      ...review,
      action: body.action,
      rationale: body.rationale.trim(),
      updatedStatement: body.action === 'revise' ? body.updatedStatement!.trim() : null,
      savedAt: new Date().toISOString(),
    });

    if (body.action === 'revise') {
      const path = JSON.parse(review.path) as string[];
      const intentId = path.find((node) => node.startsWith('LS-I'));
      if (intentId) await updateIntentStatement(intentId, body.updatedStatement!.trim());
    }

    return NextResponse.json({ status: 'saved_to_decision_history', reviewId: body.reviewId, action: body.action });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存判断失败。' }, { status: 500 });
  }
}
