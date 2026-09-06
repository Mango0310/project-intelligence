import { NextResponse } from 'next/server';

type ModelsRequest = { baseUrl?: string; apiKey?: string; model?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelsRequest;
    if (!body.baseUrl?.trim()) return NextResponse.json({ error: '请填写接口地址。' }, { status: 400 });

    const endpoint = `${body.baseUrl.replace(/\/$/, '')}/models`;
    const response = await fetch(endpoint, {
      headers: body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {},
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: `模型列表接口返回 ${response.status}。请检查 Base URL 和 API Key。` }, { status: 502 });
    }

    const payload = await response.json() as { data?: Array<{ id?: string }>; models?: Array<{ name?: string; model?: string }> };
    const models = [
      ...(payload.data ?? []).map((item) => item.id),
      ...(payload.models ?? []).map((item) => item.name ?? item.model),
    ].filter((item): item is string => Boolean(item));
    const uniqueModels = [...new Set(models)];
    const verifiedModel = body.model && uniqueModels.includes(body.model) ? body.model : undefined;

    return NextResponse.json({ models: uniqueModels, verifiedModel, note: uniqueModels.length ? undefined : '接口已响应，但没有返回模型名称。' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? '连接超时，请检查接口地址或网络。' : error instanceof Error ? error.message : '连接检测失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
