'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Download, FilePlus2, FileText, GitBranch, Layers3, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ReviewAction = 'confirm' | 'revise' | 'reject' | 'investigate';
type View = 'context' | 'analyze' | 'map' | 'review' | 'impact' | 'intent';
type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';
type ReviewItem = {
  id: string; source: string; date: string; level: string; title: string; titleEn: string;
  summary: string; summaryEn: string; path: string[]; labels: string[]; excerpt?: string; status?: string;
};
type DecisionRecord = { reviewId: string; action: ReviewAction; rationale: string; savedAt: string; updatedStatement?: string };
type IntentRecord = { id: string; title: string; titleEn: string; statement: string; originalStatement: string };

type WebMCPContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options: { signal: AbortSignal }) => void | Promise<void>;
};

const initialReviews: ReviewItem[] = [
  { id: 'CR-014', source: '新实验流程要求 / Protocol change', date: '2026.02.18', level: '必须复核 / Required', title: '单向样本流程可能影响共享前处理决定', titleEn: 'A unidirectional protocol may affect the shared preparation decision', summary: '新增研究流程可能挑战“所有项目可以共用前处理流程”的假设，适用范围仍需专业人员确认。', summaryEn: 'A new protocol may challenge the shared-preparation assumption; its scope still needs professional judgment.', path: ['LS-S004', 'LS-A001', 'LS-I001', 'LS-D001'], labels: ['新要求 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision'] },
  { id: 'CR-015', source: '新设备协调条件 / Equipment update', date: '2026.03.04', level: '必须复核 / Required', title: '设备条件超出早期通用模块的设计输入', titleEn: 'Equipment conditions exceed the early generic module inputs', summary: '新增散热、振动和维护条件可能影响模块化服务策略，需要设备、实验室规划和工程专业共同核实。', summaryEn: 'New heat, vibration and maintenance conditions may affect the modular service strategy and require multidisciplinary review.', path: ['LS-S005', 'LS-A002', 'LS-I002', 'LS-D002'], labels: ['新条件 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision'] },
  { id: 'CR-016', source: '数据治理评审 / Data governance', date: '2026.03.20', level: '建议复核 / Recommended', title: '研究信息展示需要区分访问边界', titleEn: 'Research visibility needs differentiated access boundaries', summary: '新治理规则挑战了“研究信息可以持续跨区域展示”的假设，但仍支持跨专业可见性的总体意图。', summaryEn: 'New governance rules challenge continuous cross-zone display while still supporting the broader intent of interdisciplinary visibility.', path: ['LS-S006', 'LS-A003', 'LS-I003', 'LS-D003'], labels: ['新规则 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision'] },
];

const excerpts: Record<string, string> = {
  'CR-014': '新增研究流程要求样本在接收、特定前处理和分析之间保持单向流转，并与常规共享活动区分。 / A new protocol requires unidirectional sample movement and separation from routine shared preparation activities.',
  'CR-015': '候选设备增加了散热、振动控制、维护净空和连续运行条件，部分超出早期设计输入。 / Candidate equipment adds heat, vibration, maintenance-clearance and continuous-operation conditions beyond early inputs.',
  'CR-016': '原始数据、样本标识和合作伙伴资料具有不同访问边界。 / Raw data, sample identifiers and partner information have different access boundaries.',
};

const actionLabels: Record<ReviewAction, string> = { confirm: '确认不变 / Confirm', revise: '修改 / Revise', reject: '否决 AI 解读 / Reject', investigate: '需要更多证据 / Investigate' };

const levelLabel = (level: string) => level === 'review_required' ? '必须复核 / Required' : level === 'review_recommended' ? '建议复核 / Recommended' : level === 'need_clarification' ? '需要澄清 / Clarify' : '仅记录 / Monitor';

export default function Home() {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [selectedId, setSelectedId] = useState('CR-015');
  const [view, setView] = useState<View>('impact');
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [updatedStatement, setUpdatedStatement] = useState('');
  const [saved, setSaved] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [sources, setSources] = useState<string[][]>([]);
  const [intents, setIntents] = useState<IntentRecord[]>([]);
  const [baseUrl, setBaseUrl] = useState(() => typeof window === 'undefined' ? 'http://localhost:11434/v1' : window.localStorage.getItem('project-intelligence-base-url') ?? 'http://localhost:11434/v1');
  const [model, setModel] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('project-intelligence-model') ?? '');
  const [apiKey, setApiKey] = useState(() => typeof window === 'undefined' ? '' : window.sessionStorage.getItem('project-intelligence-api-key') ?? '');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState('尚未检测 / Not checked');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'error'>('idle');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const selected = useMemo(() => reviews.find((item) => item.id === selectedId) ?? reviews[0], [selectedId, reviews]);
  const isResolved = (reviewId: string) => records.some((record) => record.reviewId === reviewId && record.action !== 'investigate');
  const unresolvedCount = reviews.filter((item) => !isResolved(item.id)).length;
  const closedCount = reviews.length - unresolvedCount;
  const evidenceTasks = records.filter((record) => record.action === 'investigate').length;

  const reloadContext = useCallback(async () => {
    const response = await fetch('/api/context');
    if (!response.ok) return;
    const data = await response.json() as {
      sources: Array<{ id: string; seq: number; date: string; title: string; titleEn: string; body: string; role: string }>;
      intents: IntentRecord[];
      reviews: Array<{ id: string; sourceId: string; level: string; title: string; titleEn: string; summary: string; summaryEn: string; path: string; labels: string; excerpt: string; action: string | null; rationale: string | null; updatedStatement: string | null; savedAt: string | null }>;
    };
    const sourceById = new Map(data.sources.map((s) => [s.id, s]));
    const nextReviews: ReviewItem[] = data.reviews.map((r) => ({
      id: r.id,
      source: sourceById.get(r.sourceId)?.title ?? r.sourceId,
      date: sourceById.get(r.sourceId)?.date ?? '',
      level: levelLabel(r.level),
      title: r.title,
      titleEn: r.titleEn,
      summary: r.summary,
      summaryEn: r.summaryEn,
      path: JSON.parse(r.path) as string[],
      labels: JSON.parse(r.labels) as string[],
      excerpt: r.excerpt,
    }));
    const nextRecords: DecisionRecord[] = data.reviews.filter((r) => r.action).map((r) => ({
      reviewId: r.id, action: r.action as ReviewAction, rationale: r.rationale ?? '', savedAt: r.savedAt ?? '', ...(r.updatedStatement ? { updatedStatement: r.updatedStatement } : {}),
    }));
    setReviews(nextReviews);
    setRecords(nextRecords);
    setSources(data.sources.map((s) => [s.id, s.title, s.date, s.role]));
    setIntents(data.intents);
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- initial data fetch effect
    void reloadContext();
  }, [reloadContext]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const allowedActions: ReviewAction[] = ['confirm', 'revise', 'reject', 'investigate'];

    void Promise.resolve(context.registerTool({
      name: 'complete_change_impact_review',
      title: 'Complete change impact review',
      description: 'Record a professional judgment and rationale for one visible change-impact review.',
      inputSchema: {
        type: 'object',
        properties: {
          reviewId: { type: 'string', pattern: '^CR-' },
          action: { type: 'string', enum: allowedActions },
          rationale: { type: 'string', minLength: 1 },
          updatedStatement: { type: 'string' },
        },
        required: ['reviewId', 'action', 'rationale'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object') throw new Error('Review input must be an object.');
        const value = input as { reviewId?: unknown; action?: unknown; rationale?: unknown; updatedStatement?: unknown };
        if (typeof value.reviewId !== 'string' || !value.reviewId.startsWith('CR-')) throw new Error('Unknown reviewId.');
        if (typeof value.action !== 'string' || !allowedActions.includes(value.action as ReviewAction)) throw new Error('Unknown review action.');
        if (typeof value.rationale !== 'string' || !value.rationale.trim()) throw new Error('A professional rationale is required.');
        if (value.action === 'revise' && (typeof value.updatedStatement !== 'string' || !value.updatedStatement.trim())) throw new Error('A revised statement is required for a revision.');
        setSelectedId(value.reviewId);
        setAction(value.action as ReviewAction);
        setReason(value.rationale.trim());
        void fetch('/api/reviews/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId: value.reviewId, action: value.action, rationale: (value.rationale as string).trim(), updatedStatement: (value.updatedStatement as string).trim() }) }).then(() => reloadContext());
        setSaved(true);
        return { reviewId: value.reviewId, action: value.action, status: 'saved_to_decision_history' };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, [reloadContext]);

  useEffect(() => {
    window.localStorage.setItem('project-intelligence-base-url', baseUrl);
    window.localStorage.setItem('project-intelligence-model', model);
    window.sessionStorage.setItem('project-intelligence-api-key', apiKey);
  }, [baseUrl, model, apiKey]);

  function resetSelection(id: string) { setSelectedId(id); setAction(null); setReason(''); setUpdatedStatement(''); setSaved(false); setSourceOpen(false); }
  function chooseAction(next: ReviewAction) { setAction(next); setUpdatedStatement(''); setSaved(false); }
  async function saveReview() {
    if (!action || !reason.trim() || (action === 'revise' && !updatedStatement.trim())) return;
    const response = await fetch('/api/reviews/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId: selected.id, action, rationale: reason.trim(), updatedStatement: updatedStatement.trim() }),
    });
    if (!response.ok) return;
    setSaved(true);
    await reloadContext();
  }
  function continueInvestigation() {
    setSourceTitle(`补充证据 / Follow-up evidence · ${selected.id}`);
    setSourceText('');
    setView('analyze');
  }

  async function testConnection() {
    setConnectionState('checking');
    setConnectionMessage('正在读取模型列表… / Checking models…');
    try {
      const response = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl, apiKey, model }) });
      const payload = await response.json() as { error?: string; models?: string[]; verifiedModel?: string; note?: string };
      if (!response.ok) throw new Error(payload.error ?? '连接失败');
      const models = payload.models ?? [];
      setAvailableModels(models);
      const qwenModels = models.filter((item) => item.toLowerCase().includes('qwen'));
      const detected = payload.verifiedModel || (qwenModels.length === 1 ? qwenModels[0] : '');
      if (!model && detected) setModel(detected);
      setConnectionState('connected');
      setConnectionMessage(models.length ? `已连接，发现 ${models.length} 个模型 / ${models.length} models` : payload.note ?? '接口已连接 / Connected');
    } catch (error) {
      setAvailableModels([]);
      setConnectionState('error');
      setConnectionMessage(error instanceof Error ? error.message : '连接失败 / Connection failed');
    }
  }

  async function runAnalysis() {
    setAnalysisState('running'); setAnalysisMessage('');
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceTitle, sourceText, baseUrl, model, apiKey }) });
      const payload = await response.json() as { error?: string; result?: Record<string, string> };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? '分析失败');
      const result = payload.result;
      const path = [result.affectedAssumption, result.affectedIntent, result.affectedDecision].filter(Boolean) as string[];

      const sourceRes = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: sourceTitle, titleEn: sourceTitle, body: sourceText, role: '实时模型分析材料 / Live model source' }) });
      const sourcePayload = await sourceRes.json() as { source?: { id: string } };
      const sourceId = sourcePayload.source?.id ?? `NEW-${String(Date.now()).slice(-3)}`;

      const level = result.level ?? 'review_recommended';
      const reviewRes = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId, level, title: result.titleZh || '模型分析结果', titleEn: result.titleEn || 'Model analysis result', summary: result.summaryZh || result.reasonZh || '', summaryEn: result.summaryEn || result.reasonEn || '', path: [sourceId, ...path], labels: ['新材料 / Source', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision'].slice(0, path.length + 1), excerpt: sourceText }) });
      const reviewPayload = await reviewRes.json() as { reviewId?: string };

      await reloadContext();
      if (reviewPayload.reviewId) setSelectedId(reviewPayload.reviewId);
      setView('impact'); setSourceOpen(true); setSourceTitle(''); setSourceText('');
    } catch (error) { setAnalysisState('error'); setAnalysisMessage(error instanceof Error ? error.message : '分析失败'); return; }
    setAnalysisState('idle');
  }
  function exportBrief() {
    const brief = {
      project: 'HelixNova Translational Research Centre', contextVersion: 'V4', generatedAt: new Date().toISOString(),
      designIntents: intents.map((intent) => ({ id: intent.id, title: intent.titleEn, currentStatement: intent.statement, status: 'approved' })),
      unresolved: reviews.filter((item) => !isResolved(item.id)).map((item) => ({ reviewId: item.id, impactPath: item.path })),
      humanReviewHistory: records,
      guardrail: 'No design intent or decision may be changed without a recorded human judgment.',
    };
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'design-intent-change-brief-v4.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  async function addSource(title: string, body: string, role: string) {
    const response = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, titleEn: title, body, role: role || '手动录入 / Manually added' }) });
    if (response.ok) await reloadContext();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="topbar">
        <div className="brand-mark">PI</div>
        <div><p className="eyebrow">PROJECT INTELLIGENCE · 项目智能</p><h1>设计意图与决策连续性 / Design Intent & Decision Continuity</h1></div>
        <div className="project-switcher"><span className="project-dot" /><div><small>模拟能力实验 / Synthetic experiment</small><strong>HelixNova 生命科学研发中心</strong></div><ChevronRight /></div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <nav aria-label="Project navigation">
            <button className={view === 'context' ? 'active' : ''} onClick={() => setView('context')}><FileText />项目语境 / Context</button>
            <button className={view === 'analyze' ? 'active' : ''} onClick={() => setView('analyze')}><FilePlus2 />分析新材料 / Analyze</button>
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}><GitBranch />关系图 / Map</button>
            <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><ShieldCheck />人工审核 / Review</button>
            <button className={view === 'impact' ? 'active' : ''} onClick={() => setView('impact')}><Sparkles />变化影响 / Impact <span>{unresolvedCount}</span></button>
            <button className={view === 'intent' ? 'active' : ''} onClick={() => setView('intent')}><Layers3 />当前意图 / Intent</button>
          </nav>
          <div className="version-card"><div><Clock3 /><span>语境版本 / Context</span></div><strong>V4 · 2026.03.20</strong><p>3 项设计意图 · {unresolvedCount} 项待复核</p></div>
          <div className="principle"><span>协作原则 / PRINCIPLE</span><p>AI 提醒 / AI surfaces</p><p>人来判断 / Human judges</p><p>系统保留理由 / Reasoning preserved</p></div>
          <div className={`connection-card ${connectionState}`}>
            <div>{connectionState === 'connected' ? <Wifi /> : connectionState === 'checking' ? <Loader2 className="spin" /> : <WifiOff />}<span>AI 接口 / CONNECTION</span></div>
            <strong>{connectionState === 'connected' ? '已连接 / Connected' : connectionState === 'checking' ? '检测中 / Checking' : connectionState === 'error' ? '连接失败 / Failed' : '未确认 / Unverified'}</strong>
            <p>{connectionMessage}</p>
            {model && <code>{model}</code>}
            <button disabled={connectionState === 'checking' || !baseUrl.trim()} onClick={testConnection}><RefreshCw />检测连接与模型 / Test</button>
          </div>
        </aside>

        {view === 'analyze' ? <AnalyzeView baseUrl={baseUrl} setBaseUrl={setBaseUrl} model={model} setModel={setModel} apiKey={apiKey} setApiKey={setApiKey} availableModels={availableModels} connectionState={connectionState} connectionMessage={connectionMessage} onTestConnection={testConnection} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} sourceText={sourceText} setSourceText={setSourceText} state={analysisState} message={analysisMessage} onAnalyze={runAnalysis} /> : view !== 'impact' ? <SecondaryView view={view} records={records} sources={sources} intents={intents} onOpenImpact={() => setView('impact')} onExport={exportBrief} onAddSource={addSource} /> : <section className="workspace" id="impact">
          <div className="loop-status">
            <div><span>01 · 项目资料 / Sources</span><strong>{8 + Math.max(0, reviews.length - initialReviews.length)}</strong><small>持续进入 / incoming</small></div>
            <ArrowRight />
            <div><span>02 · AI 候选 / AI findings</span><strong>{reviews.length}</strong><small>保留出处 / traceable</small></div>
            <ArrowRight />
            <div><span>03 · 待人工判断 / Open</span><strong>{unresolvedCount}</strong><small>{evidenceTasks} 项待补证据 / evidence</small></div>
            <ArrowRight />
            <div><span>04 · 已形成结论 / Closed</span><strong>{closedCount}</strong><small>写回当前语境 / saved</small></div>
          </div>
          <div className="how-to-use">
            <div><strong>这一页怎么用？</strong><span>How to use this page</span></div>
            <ol><li><b>1</b>查看新材料来源</li><li><b>2</b>理解 AI 找到的影响路径</li><li><b>3</b>由你选择怎么处理</li><li><b>4</b>填写理由并保存</li></ol>
            <button onClick={() => setView('context')}>查看全部 8 份模拟材料 / View sources <ChevronRight /></button>
          </div>
          <div className="workspace-heading">
            <div><p className="eyebrow">变化影响收件箱 / CHANGE IMPACT INBOX</p><h2>哪些已有决定值得重新看一眼？</h2><p className="bilingual-note">AI 已提出潜在影响，尚未修改任何已确认的意图或决定。<span>AI has surfaced candidate impacts. No approved record has changed.</span></p></div>
            <button className="search-button" aria-label="搜索复核项"><Search />搜索 / Search</button>
          </div>

          <div className="review-layout">
            <div className="review-list" aria-label="Open impact reviews">
              <div className="list-title"><span>复核列表 / REVIEW QUEUE</span><strong>{unresolvedCount}</strong></div>
              {reviews.map((review) => (
                <button key={review.id} className={`review-row ${review.id === selectedId ? 'selected' : ''}`} onClick={() => resetSelection(review.id)}>
                  <div className="row-meta"><span className={isResolved(review.id) ? 'level closed' : review.level.includes('Required') ? 'level required' : 'level'}>{isResolved(review.id) ? '已处理 / Closed' : records.some((record) => record.reviewId === review.id && record.action === 'investigate') ? '等待证据 / Evidence needed' : review.level}</span><small>{review.date}</small></div>
                  <h3>{review.title}<small>{review.titleEn}</small></h3><p>{review.summary}<small>{review.summaryEn}</small></p>
                  <div className="row-footer"><span>{review.source}</span><ChevronRight /></div>
                </button>
              ))}
            </div>

            <article className="review-detail">
              <div className="detail-header">
                <div><span className={selected.level.includes('Required') ? 'level required' : 'level'}>{selected.level}</span><p>{selected.id} · 来源 / Source: {selected.source}</p><h2>{selected.title}<small>{selected.titleEn}</small></h2></div>
                <div className="confidence"><span>证据充分性 / SUFFICIENCY</span><strong>需要专业复核 / Review needed</strong></div>
              </div>

              <section className="source-block">
                <div className="section-label"><BookOpen />来源原文 / SOURCE EXCERPT <button onClick={() => setSourceOpen((open) => !open)}>{sourceOpen ? '收起完整资料 / Close' : '查看完整资料 / View source'}</button></div>
                <blockquote>“{selected.excerpt ?? excerpts[selected.id]}”</blockquote>
                <p>模拟材料 · 保留原文位置 · 提取置信度高 / Synthetic source · exact passage retained</p>
                {sourceOpen && <div className="full-source"><strong>{selected.source}</strong><p>{selected.id === 'CR-014' ? '一个新增研究流程要求样本从接收、特定前处理到分析之间保持单向流转，并与常规共享前处理活动区分。记录没有说明该要求是否适用于所有项目，也没有给出最终安全分区结论。' : selected.id === 'CR-015' ? '候选分析设备的最新协调资料增加了散热、振动控制、维护净空和连续运行条件。部分条件超出早期通用设备模块采用的设计输入，需要设备供应商、实验室规划师、结构与机电工程师共同核实。' : '治理评审将研究信息分为可广泛展示的项目状态、仅限内部团队的分析内容，以及受合作协议限制的原始数据与样本标识。当前展示假设没有区分这些访问边界。'}</p><small>文件位置 / File: case-study-life-sciences/materials</small></div>}
              </section>

              <section className="impact-section">
                <div className="section-label"><GitBranch />AI 提出的影响路径 / PROPOSED IMPACT PATH</div>
                <div className="impact-path">
                  {selected.path.map((node, index) => (
                    <div className="path-part" key={node}>
                      <div className={`path-node node-${index}`}><small>{selected.labels[index]}</small><strong>{node}</strong></div>
                      {index < selected.path.length - 1 && <div className="path-arrow"><span>{index === 0 ? '挑战 / challenges' : '关联 / informs'}</span><ArrowRight /></div>}
                    </div>
                  ))}
                </div>
                <div className="ai-rationale"><Sparkles /><div><strong>为什么 AI 提醒这一项 / Why AI surfaced this</strong><p>{selected.summary} 这是一项复核提醒，不是修改设计的建议。<span>{selected.summaryEn}</span></p></div></div>
              </section>

              <section className="decision-section">
                <div className="section-label"><ShieldCheck />专业人员判断 / PROFESSIONAL JUDGMENT</div>
                <div className="action-grid">
                  {(['confirm', 'revise', 'reject', 'investigate'] as ReviewAction[]).map((value) => (
                    <Button key={value} variant={action === value ? 'default' : 'outline'} className="action-button" onClick={() => chooseAction(value)}>
                      {value === 'confirm' && <Check />}{value === 'revise' && <GitBranch />}{value === 'reject' && <X />}{value === 'investigate' && <CircleHelp />}{actionLabels[value]}
                    </Button>
                  ))}
                </div>
                <label htmlFor="rationale">判断理由 / Decision rationale <span>必填 / required</span></label>
                <Textarea id="rationale" value={reason} onChange={(event) => { setReason(event.target.value); setSaved(false); }} placeholder="说明为什么维持、修改、否决，或需要补充证据…… / Explain the professional rationale…" />
                {action === 'revise' && <><label htmlFor="updated-statement">更新后的意图或决定 / Updated statement <span>必填 / required</span></label><Textarea id="updated-statement" value={updatedStatement} onChange={(event) => { setUpdatedStatement(event.target.value); setSaved(false); }} placeholder="写下团队现在认可、可供下游使用的新表述…… / Enter the revised statement for downstream work…" /></>}
                <div className="decision-footer"><p>{saved ? action === 'investigate' ? '证据任务已保存，事项仍保持打开。 / Evidence task saved; review remains open.' : '人工结论已写回决策历史和当前语境。 / Judgment saved to the current context.' : 'AI 无权关闭或修改这项决定 / AI cannot modify this decision.'}</p><div>{saved && action === 'investigate' && <Button variant="outline" size="lg" onClick={continueInvestigation}>补充新证据 / Add evidence</Button>}<Button size="lg" disabled={!action || !reason.trim() || (action === 'revise' && !updatedStatement.trim())} onClick={saveReview}>保存人工判断 / Save review</Button></div></div>
              </section>
            </article>
          </div>
        </section>}
      </div>
    </main>
  );
}

function AnalyzeView({ baseUrl, setBaseUrl, model, setModel, apiKey, setApiKey, availableModels, connectionState, connectionMessage, onTestConnection, sourceTitle, setSourceTitle, sourceText, setSourceText, state, message, onAnalyze }: {
  baseUrl: string; setBaseUrl: (value: string) => void; model: string; setModel: (value: string) => void; apiKey: string; setApiKey: (value: string) => void;
  availableModels: string[]; connectionState: ConnectionState; connectionMessage: string; onTestConnection: () => void;
  sourceTitle: string; setSourceTitle: (value: string) => void; sourceText: string; setSourceText: (value: string) => void;
  state: 'idle' | 'running' | 'error'; message: string; onAnalyze: () => void;
}) {
  return <section className="workspace secondary-view analyze-view">
    <div className="workspace-heading"><div><p className="eyebrow">分析新材料 / ANALYZE NEW SOURCE</p><h2>把新信息放进项目判断链</h2><p className="bilingual-note">连接真实模型后，系统会提出需要人工复核的候选影响。<span>The model surfaces candidate impacts; it does not change approved decisions.</span></p></div></div>
    <div className="mode-notice"><Sparkles /><div><strong>真实模型模式 / Live model mode</strong><p>当前页面不会使用预设答案。未填写模型名称时无法运行；API 密钥仅保存在当前页面内存中。</p></div></div>
    <div className="analysis-grid">
      <section className="analysis-card"><h3>1. 配置模型 <small>Model connection</small></h3><label htmlFor="base-url">接口地址 / Base URL</label><Input id="base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:11434/v1" /><label htmlFor="model-name">模型名称 / Model</label><Input id="model-name" list="available-models" value={model} onChange={(event) => setModel(event.target.value)} placeholder="检测后可直接选择 Qwen 版本" /><datalist id="available-models">{availableModels.map((item) => <option value={item} key={item} />)}</datalist><label htmlFor="api-key">API 密钥 / API key（本地模型可留空）</label><Input id="api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="仅保存在当前浏览器标签页" /><div className={`inline-connection ${connectionState}`}>{connectionState === 'connected' ? <Wifi /> : <WifiOff />}<span>{connectionMessage}</span></div>{availableModels.length > 0 && <p className="model-results">可用模型 / Available: {availableModels.join(' · ')}</p>}<Button variant="outline" onClick={onTestConnection} disabled={connectionState === 'checking' || !baseUrl.trim()}>{connectionState === 'checking' ? <Loader2 className="spin" /> : <RefreshCw />}检测连接并识别模型 / Test connection</Button></section>
      <section className="analysis-card"><h3>2. 输入新材料 <small>New source</small></h3><label htmlFor="source-title">材料标题 / Source title</label><Input id="source-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="例如：设备协调条件更新" /><label htmlFor="source-text">材料内容 / Source text</label><Textarea id="source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="粘贴会议记录、协调说明或评审结论……" /><Button size="lg" aria-label="运行 AI 影响分析 / Analyze" disabled={state === 'running' || !model.trim() || !sourceTitle.trim() || !sourceText.trim()} onClick={onAnalyze}>{state === 'running' ? <Loader2 className="spin" /> : <Sparkles />}运行 AI 影响分析 / Analyze</Button>{state === 'error' && <p className="analysis-error">{message}</p>}</section>
    </div>
    <div className="analysis-next"><strong>运行后会发生什么？ / What happens next</strong><ol><li>AI 提取新材料中的事实、条件或观点</li><li>提出可能受影响的旧假设与决定</li><li>自动进入“变化影响”页面</li><li>由你保存最终判断和理由</li></ol></div>
  </section>;
}

const fallbackSources = [
  ['LS-S001', '初始研究简报 / Initial research brief', '01.12', '建立研究目标和初始边界 / Research goals and initial boundaries'],
  ['LS-S002', '跨专业访谈 / Discipline interviews', '01.19', '研究、运营、工程与数据治理观点 / Four discipline perspectives'],
  ['LS-S003', '设计意图与决定记录 / Intent record', '02.02', '已确认意图、工作假设和早期决定 / Approved context'],
  ['LS-S004', '新实验流程要求 / Protocol change', '02.18', '挑战共享前处理假设 / Challenges shared preparation'],
  ['LS-S005', '新设备协调条件 / Equipment update', '03.04', '触发设备与工程接口复核 / Triggers coordination review'],
  ['LS-S006', '数据治理评审 / Governance review', '03.20', '重新界定研究信息的展示边界 / Refines visibility boundaries'],
  ['LS-S007', '耗材送货通知 / Delivery note', '03.23', '无关信息误报测试 / False-alert control'],
  ['LS-S008', '模糊评审意见 / Ambiguous comment', '03.27', '不确定性与澄清测试 / Ambiguity test'],
];

function SourceContextView({ sources, onAddSource }: { sources: string[][]; onAddSource: (title: string, body: string, role: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const displaySources = sources.length ? sources : fallbackSources;
  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try { await onAddSource(title.trim(), body.trim(), role.trim()); setTitle(''); setBody(''); setRole(''); setShowForm(false); } finally { setSaving(false); }
  }
  return <section className="workspace secondary-view">
    <div className="workspace-heading"><div><p className="eyebrow">项目资料 / PROJECT SOURCES</p><h2>AI 到底读了哪些资料？</h2><p className="bilingual-note">下面 {displaySources.length} 份材料构成这次实验的数据源。<span>These documents are the source set for this experiment.</span></p></div></div>
    <div className="source-disclosure"><BookOpen /><div><strong>数据说明 / Data disclosure</strong><p>全部是为测试而编写的模拟材料，不是真实客户或实验室数据。数据现在保存在云端数据库，可在这里直接录入维护，刷新或换浏览器都不会丢失。</p></div></div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}><Button variant="outline" onClick={() => setShowForm((v) => !v)}>{showForm ? '收起表单 / Close' : '新增材料 / Add source'} <FilePlus2 /></Button></div>
    {showForm && <div style={{ display: 'grid', gap: '12px', padding: '20px', border: '1px solid var(--border, #e5e7eb)', borderRadius: '12px', marginBottom: '20px', background: 'var(--card, #fff)' }}>
      <label htmlFor="ns-title">材料标题 / Title</label><Input id="ns-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：新设备协调条件更新" />
      <label htmlFor="ns-body">材料内容 / Content</label><Textarea id="ns-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="粘贴会议记录、协调说明或评审结论……" />
      <label htmlFor="ns-role">用途说明 / Role（可选）</label><Input id="ns-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="这份材料为什么重要" />
      <div><Button size="lg" disabled={saving || !title.trim() || !body.trim()} onClick={submit}>{saving ? <Loader2 className="spin" /> : <FilePlus2 />}保存材料 / Save source</Button></div>
    </div>}
    <div className="source-table"><div className="source-table-head"><span>编号 / ID</span><span>材料 / SOURCE</span><span>日期 / DATE</span><span>为什么要用这份材料 / ROLE</span></div>{displaySources.map((source) => <div className="source-table-row" key={source[0]}><strong>{source[0]}</strong><span>{source[1]}</span><small>{source[2]}</small><p>{source[3]}</p></div>)}</div>
  </section>;
}

function SecondaryView({ view, records, sources, intents, onOpenImpact, onExport, onAddSource }: { view: Exclude<View, 'impact' | 'analyze'>; records: DecisionRecord[]; sources: string[][]; intents: IntentRecord[]; onOpenImpact: () => void; onExport: () => void; onAddSource: (title: string, body: string, role: string) => Promise<void> }) {
  if (view === 'context') return <SourceContextView sources={sources} onAddSource={onAddSource} />;

  if (view === 'map') return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">项目关系图 / INTELLIGENCE MAP</p><h2>追溯一个设计决定背后的判断链</h2><p className="bilingual-note">关系图同时显示人工已确认关系和等待复核的 AI 候选关系。<span>Human-approved relationships remain distinct from AI-proposed links.</span></p></div></div><div className="map-canvas"><div className="map-column"><p className="map-label">新条件 / Evidence</p><div className="map-card gold"><small>LS-S005</small><strong>设备增加散热、振动和维护条件</strong><span>保留原始出处 / Source retained</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">工作假设 / Assumption</p><div className="map-card coral"><small>LS-A002 · 受到挑战</small><strong>通用模块覆盖预期设备变化</strong><span>必须复核 / Review required</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">设计意图 / Intent</p><div className="map-card green"><small>LS-I002 · 已确认</small><strong>可调整的研究平台</strong><span>仍然有效 / Still active</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">已有决定 / Decision</p><div className="map-card"><small>LS-D002 · 等待复核</small><strong>标准化模块与服务分区</strong><span>需要跨专业判断 / Human review</span></div></div></div><div className="continuity-note"><ShieldCheck /><div><strong>连续性仍被保留 / Continuity preserved</strong><p>设备条件触发复核，但系统没有判断设备能否安装，也没有自动修改工程决定。</p></div></div></section>;

  if (view === 'review') return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">处理记录 / HUMAN REVIEW HISTORY</p><h2>人做了什么判断，为什么？</h2><p className="bilingual-note">这里保存人工结论，不让后续 AI 覆盖。<span>Human decisions and rationale remain part of the project context.</span></p></div></div><div className="certainty-grid"><div><span>01</span><small>提取置信度 / EXTRACTION</small><strong>高 / High</strong><p>系统从 LS-S005 找到新增设备条件。</p></div><div><span>02</span><small>证据充分性 / SUFFICIENCY</small><strong>有限 / Limited</strong><p>仍需设备、规划和工程负责人共同核实。</p></div><div><span>03</span><small>已保存人工判断 / SAVED REVIEWS</small><strong>{records.length} 条</strong><p>保存在当前浏览器中，并写入导出的项目语境。</p></div></div>{records.length > 0 && <div className="history-list">{records.map((record) => <article key={record.reviewId}><strong>{record.reviewId} · {actionLabels[record.action]}</strong><p>{record.rationale}</p><small>{new Date(record.savedAt).toLocaleString('zh-CN')}</small></article>)}</div>}<Button size="lg" onClick={onOpenImpact}>进入专业复核 / Open review <ArrowRight /></Button></section>;

  return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">当前设计意图 · V4 / CURRENT INTENT</p><h2>下游工作可以依赖的当前项目语境</h2><p className="bilingual-note">人工判断会改变这里显示的复核状态，并进入导出文件。<span>Human reviews update the visible status and exported context.</span></p></div><Button size="lg" onClick={onExport}><Download />导出结构化任务书 / Export</Button></div><div className="intent-grid">{intents.map((intent) => { const revised = intent.statement !== intent.originalStatement; return <article key={intent.id}><div><span>{intent.id} · 已确认 / APPROVED</span><em>{revised ? '人工已更新 / Revised' : '保持确认 / Approved'}</em></div><h3>{intent.title}<small>{intent.titleEn}</small></h3><p>{intent.statement}</p>{revised && <aside>人工更新 / Human revision</aside>}<button onClick={onOpenImpact}>查看关联判断 / View reasoning <ChevronRight /></button></article>; })}</div><div className="export-guardrail"><CircleHelp /><div><strong>下游 AI 约束 / Downstream AI guardrail</strong><p>不得从未解决的复核项直接形成实验室、安全或工程结论；必须交由对应专业人员判断。</p></div></div></section>;
}
