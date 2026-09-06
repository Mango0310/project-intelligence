import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, loadContext } from '@/lib/db';

export async function GET() {
  try {
    await ensureSchema();
    await seedIfEmpty();
    const context = await loadContext();
    return NextResponse.json(context);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取语境失败。' }, { status: 500 });
  }
}
