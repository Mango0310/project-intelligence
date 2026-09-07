import { NextResponse } from 'next/server';
import { ensureSchema, seedIfEmpty, buildProjectContextText } from '@/lib/db';

type AnalyzeRequest = {
  sourceTitle?: string;
  sourceText?: string;
  sourceImageDataUrl?: string;
  sourceImageName?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function typedNode(value: unknown, type: 'A' | 'I' | 'D') {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  return new RegExp(`^HC-${type}\\d{3,}$`).test(candidate) ? candidate : '';
}

function normalizeResult(raw: Record<string, unknown>) {
  const levels = ['review_required', 'review_recommended', 'monitor', 'need_clarification'];
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const affectedAssumption = typedNode(raw.affectedAssumption, 'A');
  const affectedIntent = typedNode(raw.affectedIntent, 'I');
  const affectedDecision = typedNode(raw.affectedDecision, 'D');
  const appliedPriorReviewId = /^CR-\d+$/.test(text(raw.appliedPriorReviewId)) ? text(raw.appliedPriorReviewId) : '';
  const requestedLevel = typeof raw.level === 'string' && levels.includes(raw.level) ? raw.level : 'need_clarification';
  const level = appliedPriorReviewId && !affectedAssumption && !affectedIntent && !affectedDecision ? 'monitor' : requestedLevel;
  return {
    ...raw,
    level,
    affectedAssumption,
    affectedIntent,
    affectedDecision,
    appliedPriorReviewId,
    priorDecisionEffectZh: text(raw.priorDecisionEffectZh),
    priorDecisionEffectEn: text(raw.priorDecisionEffectEn),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    if (!body.sourceTitle?.trim() || (!body.sourceText?.trim() && !body.sourceImageDataUrl)) {
      return NextResponse.json({ error: '请填写材料标题，并提供文字或图片。' }, { status: 400 });
    }
    if (!body.baseUrl?.trim() || !body.model?.trim()) {
      return NextResponse.json({ error: '请先在左下角连接模型。' }, { status: 400 });
    }
    if (body.sourceImageDataUrl && (!body.sourceImageDataUrl.startsWith('data:image/') || body.sourceImageDataUrl.length > 3000000)) {
      return NextResponse.json({ error: '图片格式无效或超过 2 MB。' }, { status: 400 });
    }

    await ensureSchema();
    await seedIfEmpty();
    const projectContext = await buildProjectContextText();
    const endpoint = body.baseUrl.replace(/\/$/, '') + '/chat/completions';
    const sourcePrompt = '材料标题：' + body.sourceTitle + '\n图片文件：' + (body.sourceImageName || '无') + '\n\n材料文字：' + (body.sourceText || '无文字，请仅根据图片中可见内容分析，并明确不确定性。');
    const userContent = body.sourceImageDataUrl ? [
      { type: 'text', text: sourcePrompt },
      { type: 'image_url', image_url: { url: body.sourceImageDataUrl } },
    ] : sourcePrompt;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(body.apiKey ? { Authorization: 'Bearer ' + body.apiKey } : {}) },
      body: JSON.stringify({
        model: body.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: '你是项目影响分析助手。你的职责是提出值得专业人员复核的候选关系，不作建筑、消防、结构、机电、造价、施工或设计结论。对象类型必须严格遵守：Source（HC-S）是来源；Assumption（HC-A）是暂时成立、可被新证据挑战的推理前提；Intent（HC-I）是项目希望保持的目标，只能作为相关或仍需保留的目标，绝不能被描述为“受到挑战的假设”；Decision（HC-D）是基于意图和假设形成的已有决定，只能建议人工重新打开，不能自动修改。affectedAssumption 只能填写一个完整 HC-A 编号，affectedIntent 只能填写一个完整 HC-I 编号，affectedDecision 只能填写一个完整 HC-D 编号；不要在单个字段内填写多个编号。人工 reject 是具有约束力的项目记录：如果新材料只是重复被否决的触发理由，不得再次提出同一路径，也不得改为挑战另一个 Intent 来绕开否决；只有出现独立且实质性的新证据时，才可解释差异并提出新的候选复核。如果某条历史人工决定实际约束了本次输出，必须在 appliedPriorReviewId 填入准确的 CR 编号，并在 priorDecisionEffectZh/priorDecisionEffectEn 说明该决定如何改变了本次判断；若没有采用历史人工决定，这三个字段必须为空。区分材料原文、图片中直接可见内容、推测和证据不足。若图片没有图例、比例、方向、尺寸或版本信息，必须明确说明，禁止补写图中不存在的数值、材料或构造。只返回 JSON：{"titleZh":"","titleEn":"","summaryZh":"","summaryEn":"","level":"review_required|review_recommended|monitor|need_clarification","sourceTypeZh":"","sourceTypeEn":"","affectedAssumption":"","affectedIntent":"","affectedDecision":"","appliedPriorReviewId":"","priorDecisionEffectZh":"","priorDecisionEffectEn":"","reasonZh":"","reasonEn":"","uncertaintyZh":"","uncertaintyEn":""}。若材料无关、重复已否决理由或过于模糊，受影响对象字段必须为空。\n' + projectContext,
          },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: '模型接口返回 ' + response.status, detail: detail.slice(0, 500) }, { status: 502 });
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: '模型没有返回可分析内容。' }, { status: 502 });
    return NextResponse.json({ mode: 'live_multimodal_model', result: normalizeResult(parseJson(content)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '分析失败。' }, { status: 500 });
  }
}
