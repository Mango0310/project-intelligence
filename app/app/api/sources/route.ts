import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, insertSource } from '@/lib/db';

type SourceInput = {
  id?: string; date?: string; title?: string; titleEn?: string; body?: string; role?: string;
  assetName?: string; assetType?: string; assetUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SourceInput;
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: '请填写材料标题和内容。' }, { status: 400 });
    }
    if (body.assetUrl && (!body.assetUrl.startsWith('data:image/') || body.assetUrl.length > 3000000)) {
      return NextResponse.json({ error: '图片格式无效或超过 2 MB。' }, { status: 400 });
    }
    await ensureSchema();
    await seedIfEmpty();
    const id = body.id?.trim() || 'HC-S' + Date.now();
    const row = await insertSource({
      id,
      date: body.date?.trim() || new Date().toLocaleDateString('zh-CN'),
      title: body.title.trim(),
      titleEn: body.titleEn?.trim() || body.title.trim(),
      body: body.body.trim(),
      role: body.role?.trim() || '新增材料 / New source',
      assetName: body.assetName?.trim() || null,
      assetType: body.assetType?.trim() || null,
      assetUrl: body.assetUrl || null,
    });
    return NextResponse.json({ source: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存材料失败。' }, { status: 500 });
  }
}
