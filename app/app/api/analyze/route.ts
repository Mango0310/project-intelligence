import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, buildProjectContextText } from '@/lib/db';

type AnalyzeRequest = {
  sourceTitle?: string;
  sourceText?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    if (!body.sourceTitle?.trim() || !body.sourceText?.trim()) {
      return NextResponse.json({ error: '请填写材料标题和内容。' }, { status: 400 });
    }
    if (!body.baseUrl?.trim() || !body.model?.trim()) {
      return NextResponse.json({ error: '请先配置模型接口地址和模型名称。' }, { status: 400 });
    }

    await ensureSchema();
    await seedIfEmpty();
    const projectContext = await buildProjectContextText();

    const endpoint = `${body.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: body.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `你是项目影响分析助手。你的职责是提出值得专业人员复核的候选关系，不作实验室、安全、工程或设计结论。区分材料原文、推测和证据不足。只返回 JSON：{"titleZh":"","titleEn":"","summaryZh":"","summaryEn":"","level":"review_required|review_recommended|monitor|need_clarification","sourceTypeZh":"","sourceTypeEn":"","affectedAssumption":"","affectedIntent":"","affectedDecision":"","reasonZh":"","reasonEn":"","uncertaintyZh":"","uncertaintyEn":""}。若材料无关或过于模糊，受影响对象字段必须为空。${projectContext}`,
          },
          { role: 'user', content: `材料标题：${body.sourceTitle}\n\n材料内容：${body.sourceText}` },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `模型接口返回 ${response.status}`, detail: detail.slice(0, 500) }, { status: 502 });
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: '模型没有返回可分析内容。' }, { status: 502 });

    const result = parseJson(content);
    return NextResponse.json({ mode: 'live_model', result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '分析失败。' }, { status: 500 });
  }
}
