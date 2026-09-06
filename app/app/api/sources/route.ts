import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, insertSource } from '@/lib/db';

type SourceInput = { id?: string; date?: string; title?: string; titleEn?: string; body?: string; role?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SourceInput;
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: '请填写材料标题和内容。' }, { status: 400 });
    }
    await ensureSchema();
    await seedIfEmpty();
    const id = body.id?.trim() || `LS-S${Date.now().toString().slice(-4)}`;
    const row = await insertSource({
      id,
      date: body.date?.trim() || new Date().toLocaleDateString('zh-CN'),
      title: body.title.trim(),
      titleEn: body.titleEn?.trim() || body.title.trim(),
      body: body.body.trim(),
      role: body.role?.trim() || '新增材料 / New source',
    });
    return NextResponse.json({ source: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存材料失败。' }, { status: 500 });
  }
}
