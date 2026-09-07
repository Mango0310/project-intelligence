'use client';
/* oxlint-disable next/no-img-element -- project evidence may be a local SVG or an uploaded data URL */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Download, FilePlus2, FileText, GitBranch, ChevronDown, ImageIcon, Layers3, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, Upload, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ReviewAction = 'confirm' | 'revise' | 'reject' | 'investigate';
type View = 'overview' | 'context' | 'analyze' | 'map' | 'review' | 'impact' | 'intent';
type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';
type ReviewItem = {
  id: string; source: string; date: string; level: string; title: string; titleEn: string;
  summary: string; summaryEn: string; path: string[]; labels: string[]; excerpt?: string; status?: string;
  assetUrl?: string; assetName?: string;
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
  { id: 'CR-101', source: '客户对中庭使用的新理解 / New client understanding', date: '2026.02.18', level: '建议复核 / Recommended', title: '客户对中庭的新理解需要重新确认疏散方案', titleEn: 'A new client understanding reopens the atrium strategy', summary: '客户希望中庭承担更多公共活动与更大人群，这可能改变疏散与消防假设；连续公共动线的意图仍可保留。', summaryEn: 'A new client ambition for the atrium may change the evacuation assumption while the public-circulation intent can remain.', path: ['HC-S004', 'HC-A001', 'HC-I001', 'HC-D001'], labels: ['客户新理解 / Evidence', '疏散工作假设 / Assumption', '公共动线意图 / Intent', '中庭决定 / Decision'] },
  { id: 'CR-102', source: '工程团队的结构边界更新 / Structural boundary update', date: '2026.03.04', level: '建议复核 / Recommended', title: '结构边界条件更新影响大跨度空间假设', titleEn: 'Updated structural boundary conditions affect the long-span assumption', summary: '工程团队更新了滨水地基与屋面荷载的接口条件，这可能改变大跨度结构假设；灵活大空间的意图仍可保留。', summaryEn: 'Updated foundation and roof-load conditions may change the long-span assumption while the flexible-space intent can remain.', path: ['HC-S005', 'HC-A002', 'HC-I002', 'HC-D002'], labels: ['工程新边界 / Evidence', '结构工作假设 / Assumption', '灵活空间意图 / Intent', '大跨度决定 / Decision'] },
  { id: 'CR-103', source: '滨水建筑新规范要求 / New waterfront regulation', date: '2026.03.20', level: '建议复核 / Recommended', title: '滨水新规范对幕墙系统提出新要求', titleEn: 'New waterfront regulations raise facade requirements', summary: '当地耐久与节能新规范对临水立面提出新要求，这可能改变幕墙假设；滨水公共可达的意图仍可保留。', summaryEn: 'New durability and energy regulations may change the facade assumption while the waterfront-access intent can remain.', path: ['HC-S006', 'HC-A003', 'HC-I003', 'HC-D003'], labels: ['规范新要求 / Evidence', '幕墙工作假设 / Assumption', '滨水可达意图 / Intent', '幕墙决定 / Decision'] },
];

const excerpts: Record<string, string> = {
  'CR-101': '客户希望中庭承办更多公共活动、容纳更大规模的人群聚集。 / A new client ambition for the atrium may raise crowd and evacuation needs.',
  'CR-102': '工程团队基于滨水地基与风荷载更新了大跨度屋面的结构接口条件。 / Updated foundation and roof-load boundary conditions from the engineering team.',
  'CR-103': '当地新规范对临水立面的材料、隔热和维护提出新的要求。 / New local regulations raise material, insulation and maintenance requirements.',
};

const actionLabels: Record<ReviewAction, string> = { confirm: '确认不变 / Confirm', revise: '修改 / Revise', reject: '否决 AI 解读 / Reject', investigate: '需要更多证据 / Investigate' };

const levelLabel = (level: string) => level === 'review_required' ? '必须复核 / Required' : level === 'review_recommended' ? '建议复核 / Recommended' : level === 'need_clarification' ? '需要澄清 / Clarify' : '仅记录 / Monitor';

export default function Home() {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [selectedId, setSelectedId] = useState('CR-101');
  const [view, setView] = useState<View>('overview');
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
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState('');
  const [sourceImageName, setSourceImageName] = useState('');
  const [sourceImageType, setSourceImageType] = useState('');
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
      sources: Array<{ id: string; seq: number; date: string; title: string; titleEn: string; body: string; role: string; assetName?: string | null; assetType?: string | null; assetUrl?: string | null }>;
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
      assetUrl: sourceById.get(r.sourceId)?.assetUrl ?? undefined,
      assetName: sourceById.get(r.sourceId)?.assetName ?? undefined,
    }));
    const nextRecords: DecisionRecord[] = data.reviews.filter((r) => r.action).map((r) => ({
      reviewId: r.id, action: r.action as ReviewAction, rationale: r.rationale ?? '', savedAt: r.savedAt ?? '', ...(r.updatedStatement ? { updatedStatement: r.updatedStatement } : {}),
    }));
    setReviews(nextReviews);
    setRecords(nextRecords);
    setSources(data.sources.map((s) => [s.id, s.title, s.date, s.role, s.assetUrl ?? '', s.assetName ?? '', s.body]));
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

  function markConnectionChanged() {
    setConnectionState('idle');
    setConnectionMessage('配置已修改，请重新检测 / Configuration changed');
  }

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
    setSourceImageDataUrl('');
    setSourceImageName('');
    setSourceImageType('');
    setView('analyze');
  }
  function continueFlow() {
    if (action === 'investigate') {
      continueInvestigation();
      return;
    }
    const next = reviews.find((item) => item.id !== selected.id && !isResolved(item.id));
    if (next) resetSelection(next.id);
    else setView('intent');
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
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceTitle, sourceText, sourceImageDataUrl, sourceImageName, baseUrl, model, apiKey }) });
      const payload = await response.json() as { error?: string; result?: Record<string, string> };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? '分析失败');
      const result = payload.result;
      const path = [result.affectedAssumption, result.affectedIntent, result.affectedDecision].filter(Boolean) as string[];
      const summaryZh = (result.summaryZh || result.reasonZh || '') + (result.uncertaintyZh ? ` 不确定性：${result.uncertaintyZh}` : '') + (result.appliedPriorReviewId ? ` 已应用人工决定 ${result.appliedPriorReviewId}：${result.priorDecisionEffectZh || '该历史决定约束了本次候选路径。'}` : '');
      const summaryEn = (result.summaryEn || result.reasonEn || '') + (result.uncertaintyEn ? ` Uncertainty: ${result.uncertaintyEn}` : '') + (result.appliedPriorReviewId ? ` Applied human decision ${result.appliedPriorReviewId}: ${result.priorDecisionEffectEn || 'The prior decision constrained this candidate path.'}` : '');

      const sourceRes = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: sourceTitle, titleEn: sourceTitle, body: sourceText || '图片证据 / Image evidence: ' + sourceImageName, role: sourceImageDataUrl ? '多模态模型分析材料 / Multimodal model source' : '实时模型分析材料 / Live model source', assetName: sourceImageName, assetType: sourceImageType, assetUrl: sourceImageDataUrl }) });
      const sourcePayload = await sourceRes.json() as { source?: { id: string } };
      const sourceId = sourcePayload.source?.id ?? `NEW-${Date.now()}`;

      const level = result.level ?? 'review_recommended';
      const reviewRes = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId, level, title: result.titleZh || '模型分析结果', titleEn: result.titleEn || 'Model analysis result', summary: summaryZh, summaryEn, path: [sourceId, ...path], labels: ['新材料 / Source', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision'].slice(0, path.length + 1), excerpt: sourceText.trim() || `图像证据 / Image evidence: ${sourceImageName}` }) });
      const reviewPayload = await reviewRes.json() as { reviewId?: string };

      await reloadContext();
      if (reviewPayload.reviewId) setSelectedId(reviewPayload.reviewId);
      setView('impact'); setSourceOpen(true); setSourceTitle(''); setSourceText(''); setSourceImageDataUrl(''); setSourceImageName(''); setSourceImageType('');
    } catch (error) { setAnalysisState('error'); setAnalysisMessage(error instanceof Error ? error.message : '分析失败'); return; }
    setAnalysisState('idle');
  }
  function exportBrief() {
    const brief = {
      project: 'Harbourside Cultural Centre (synthetic)', contextVersion: 'V6', generatedAt: new Date().toISOString(),
      designIntents: intents.map((intent) => ({ id: intent.id, title: intent.titleEn, currentStatement: intent.statement, status: 'approved' })),
      unresolved: reviews.filter((item) => !isResolved(item.id)).map((item) => ({ reviewId: item.id, impactPath: item.path })),
      humanReviewHistory: records,
      guardrail: 'No design intent or decision may be changed without a recorded human judgment.',
    };
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'design-intent-change-brief-v6.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  async function addSource(title: string, body: string, role: string) {
    const response = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, titleEn: title, body, role: role || '手动录入 / Manually added' }) });
    if (response.ok) await reloadContext();
  }

  async function removeReview(reviewId: string) {
    const response = await fetch(`/api/reviews?reviewId=${encodeURIComponent(reviewId)}`, { method: 'DELETE' });
    if (!response.ok) return;
    if (selectedId === reviewId) {
      const remaining = reviews.filter((item) => item.id !== reviewId);
      setSelectedId(remaining[0]?.id ?? '');
    }
    setAction(null); setReason(''); setUpdatedStatement(''); setSaved(false);
    await reloadContext();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="topbar">
        <div className="brand-mark">PI</div>
        <div><p className="eyebrow">PROJECT INTELLIGENCE · 项目智能</p><h1>设计意图与决策连续性 / Design Intent & Decision Continuity</h1></div>
        <div className="project-switcher"><span className="project-dot" /><div><small>能力实验 / Capability experiment</small><strong>临港文化中心 · 设计连续性</strong></div><ChevronRight /></div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <nav aria-label="Project navigation">
            <p className="nav-group">工作流程 / WORKFLOW</p>
            <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><Layers3 /><b>1</b>项目首页 / Overview</button>
            <button className={view === 'context' ? 'active' : ''} onClick={() => setView('context')}><FileText /><b>2</b>项目资料 / Sources</button>
            <button className={view === 'analyze' ? 'active' : ''} onClick={() => setView('analyze')}><FilePlus2 /><b>3</b>分析新材料 / Analyze</button>
            <button className={view === 'impact' ? 'active' : ''} onClick={() => setView('impact')}><Sparkles /><b>4</b>专业判断 / Decide <span>{unresolvedCount}</span></button>
            <button className={view === 'intent' ? 'active' : ''} onClick={() => setView('intent')}><Check /><b>5</b>当前意图 / Intent</button>
            <p className="nav-group reference">参考 / REFERENCE</p>
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}><GitBranch />关系图 / Map</button>
            <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><ShieldCheck />决策记录 / History</button>
          </nav>
          <div className="version-card"><div><Clock3 /><span>语境版本 / Context</span></div><strong>V6 · 2026.03.27</strong><p>3 项设计意图 · {unresolvedCount} 项待复核</p></div>
          <div className={'connection-card ' + connectionState}>
            <div className="connection-head">
              <span className="connection-status-dot" />
              <span className="connection-copy"><small>AI 模型 / AI MODEL</small><strong>{connectionState === 'connected' ? model || '已连接' : connectionState === 'checking' ? '正在检测…' : connectionState === 'error' ? '连接失败' : '未连接 / Not connected'}</strong></span>
            </div>
            <div className="api-settings">
              <label htmlFor="sidebar-base-url">接口地址 <span>Base URL</span></label>
              <Input id="sidebar-base-url" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); markConnectionChanged(); }} placeholder="https://.../v1" />
              <label htmlFor="sidebar-model">模型名称 <span>Model</span></label>
              <Input className="model-input" id="sidebar-model" list="sidebar-models" value={model} onChange={(event) => { setModel(event.target.value); markConnectionChanged(); }} placeholder="例如 qwen-vl-max" />
              <datalist id="sidebar-models">{availableModels.map((item) => <option value={item} key={item}>{item}</option>)}</datalist>
              <label htmlFor="sidebar-key">API 密钥 <span>API key</span></label>
              <Input id="sidebar-key" type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); markConnectionChanged(); }} placeholder="本地模型可留空" />
              <div className="connection-message">{connectionState === 'connected' ? <Wifi /> : <WifiOff />}<span>{connectionMessage}</span></div>
              <button className="connect-button" disabled={connectionState === 'checking' || !baseUrl.trim()} onClick={testConnection}>{connectionState === 'checking' ? <Loader2 className="spin" /> : <RefreshCw />}检测并连接 / Connect</button>
            </div>
          </div>
          <div className="principle"><span>协作原则 / PRINCIPLE</span><p>AI 提醒 / AI surfaces</p><p>人来判断 / Human judges</p><p>系统保留理由 / Reasoning preserved</p></div>
        </aside>

        {view === 'overview' ? <OverviewView sources={sources} intents={intents} reviews={reviews} records={records} onNavigate={setView} /> : view === 'analyze' ? <AnalyzeView model={model} connectionState={connectionState} sourceTitle={sourceTitle} setSourceTitle={setSourceTitle} sourceText={sourceText} setSourceText={setSourceText} sourceImageDataUrl={sourceImageDataUrl} setSourceImageDataUrl={setSourceImageDataUrl} sourceImageName={sourceImageName} setSourceImageName={setSourceImageName} setSourceImageType={setSourceImageType} state={analysisState} message={analysisMessage} onAnalyze={runAnalysis} /> : view !== 'impact' ? <SecondaryView view={view} records={records} sources={sources} intents={intents} onOpenImpact={() => setView('impact')} onExport={exportBrief} onAddSource={addSource} /> : <section className="workspace" id="impact">
          <div className="journey-hero">
            <div><p className="eyebrow">本轮任务 / CURRENT JOURNEY</p><h2>判断一次建筑变化会影响哪些专业决定</h2><p>从客户新理解、工程新边界或规范新要求出发，沿着假设、设计意图和既有决定追踪连锁影响，再由专业人员写回结论。</p></div>
            <div className="journey-progress"><span>本轮进度 / PROGRESS</span><strong>{closedCount}<small> / {reviews.length}</small></strong><p>{unresolvedCount > 0 ? `还有 ${unresolvedCount} 项需要处理` : '本轮判断已经完成'}</p></div>
          </div>
          <div className="loop-status">
            <button onClick={() => setView('context')}><span>01 · 查看来源 / Sources</span><strong>{sources.length}</strong><small>材料已进入 / received</small></button>
            <ArrowRight />
            <button onClick={() => setView('analyze')}><span>02 · AI 分析 / Analyze</span><strong>{reviews.length}</strong><small>候选影响 / findings</small></button>
            <ArrowRight />
            <button className="current"><span>03 · 专业判断 / Decide</span><strong>{unresolvedCount}</strong><small>{evidenceTasks} 项待补证据 / evidence</small></button>
            <ArrowRight />
            <button onClick={() => setView('intent')}><span>04 · 写回意图 / Update</span><strong>{closedCount}</strong><small>已形成结论 / saved</small></button>
          </div>
          <div className="workspace-heading">
            <div><p className="eyebrow">变化影响收件箱 / CHANGE IMPACT INBOX</p><h2>这条新信息会让哪些设计决定失效？</h2><p className="bilingual-note">AI 已提出潜在影响，尚未修改任何已确认的意图或决定。<span>AI has surfaced candidate impacts. No approved record has changed.</span></p></div>
            <button className="search-button" aria-label="搜索复核项"><Search />搜索 / Search</button>
          </div>

          <div className="review-layout">
            <div className="review-list" aria-label="Open impact reviews">
              <div className="list-title"><span>复核列表 / REVIEW QUEUE</span><strong>{unresolvedCount}</strong></div>
              {reviews.map((review) => (
                /* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- row contains a separate delete button */
                <div key={review.id} className={`review-row ${review.id === selectedId ? 'selected' : ''}`} onClick={() => resetSelection(review.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetSelection(review.id); } }}>
                  <div className="row-meta"><span className={isResolved(review.id) ? 'level closed' : review.level.includes('Required') ? 'level required' : 'level'}>{isResolved(review.id) ? '已处理 / Closed' : records.some((record) => record.reviewId === review.id && record.action === 'investigate') ? '等待证据 / Evidence needed' : review.level}</span><small>{review.date}</small></div>
                  <h3>{review.title}<small>{review.titleEn}</small></h3><p>{review.summary}<small>{review.summaryEn}</small></p>
                  <div className="row-footer"><span>{review.source}</span><button className="review-delete" aria-label={`删除 ${review.id}`} onClick={(event) => { event.stopPropagation(); void removeReview(review.id); }}><Trash2 /></button></div>
                </div>
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
                <p>模拟材料 · 保留原文与图像来源 / Synthetic source · text and image provenance retained</p>{selected.assetUrl && <figure className="review-asset"><img src={selected.assetUrl} alt={selected.assetName || selected.source} /><figcaption><ImageIcon />{selected.assetName}</figcaption></figure>}
                {sourceOpen && <div className="full-source"><strong>{selected.source}</strong><p>{selected.excerpt || excerpts[selected.id] || '完整来源已保存在项目资料库。'}</p><small>来源边界 / Provenance: 模拟变化条件，不代表真实项目事件</small></div>}
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
                <div className={`decision-footer ${saved ? 'saved' : ''}`}><p>{saved ? action === 'investigate' ? '已建立补证据任务，这项判断保持打开。 / Evidence requested; review stays open.' : '人工结论已写回当前项目语境。 / Judgment saved to current context.' : '选择处理方式并说明理由，AI 不会替你关闭决定。'}</p><div>{saved ? <Button size="lg" onClick={continueFlow}>{action === 'investigate' ? '去补充证据 / Add evidence' : unresolvedCount > 0 ? '处理下一项 / Next review' : '查看当前意图 / View intent'}<ArrowRight /></Button> : <Button size="lg" disabled={!action || !reason.trim() || (action === 'revise' && !updatedStatement.trim())} onClick={saveReview}>保存并写回 / Save & update</Button>}</div></div>
              </section>
            </article>
          </div>
        </section>}
      </div>
    </main>
  );
}

function OverviewView({ sources, intents, reviews, records, onNavigate }: {
  sources: string[][]; intents: IntentRecord[]; reviews: ReviewItem[]; records: DecisionRecord[]; onNavigate: (view: View) => void;
}) {
  const resolved = new Set(records.filter((record) => record.action !== 'investigate').map((record) => record.reviewId));
  const openReviews = reviews.filter((review) => !resolved.has(review.id));
  const recentChanges = reviews.slice(0, 3);
  return <section className="workspace secondary-view overview-view">
    <div className="overview-hero"><div><p className="eyebrow">当前项目状态 / CURRENT PROJECT STATE</p><h2>先看项目现在理解了什么，再处理新的变化</h2><p>基于虚构的项目简报建立当前语境；变化事件只用于测试 AI 能否找到影响，并把决定交还给专业人员。</p></div><div className="overview-version"><small>CONTEXT VERSION</small><strong>V6</strong><span>人工确认后持续更新</span></div></div>
    <div className="overview-grid">
      <article className="overview-panel understanding"><header><span>01</span><div><strong>当前项目理解</strong><small>CURRENT PROJECT UNDERSTANDING</small></div></header><p>团队当前可以依赖的目标、意图、假设和决定。</p><div className="overview-metrics"><div><strong>{sources.length || 8}</strong><span>份来源 / sources</span></div><div><strong>{intents.length || 3}</strong><span>项当前意图 / intents</span></div></div><ul>{intents.slice(0, 3).map((intent) => <li key={intent.id}><span>{intent.id}</span>{intent.title}</li>)}</ul><button onClick={() => onNavigate('intent')}>查看当前语境 / View current context <ArrowRight /></button></article>
      <article className="overview-panel changes"><header><span>02</span><div><strong>最新变化</strong><small>NEW CHANGES</small></div></header><p>新材料进入后，AI 先说明发生了什么变化。</p><div className="change-preview">{recentChanges.map((review) => <div key={review.id}><span>{review.date}</span><strong>{review.title}</strong><small>{review.source}</small></div>)}</div><button onClick={() => onNavigate('analyze')}>加入新材料 / Add new material <ArrowRight /></button></article>
      <article className="overview-panel needs-review"><header><span>03</span><div><strong>待人工复核</strong><small>NEEDS HUMAN REVIEW</small></div></header><p>AI 只提出可能影响，专业人员决定是否维持、修改或否决。</p><div className="review-count"><strong>{openReviews.length}</strong><span>项等待判断<br />open reviews</span></div>{openReviews[0] && <div className="next-review"><small>下一项 / NEXT</small><strong>{openReviews[0].title}</strong><span>{openReviews[0].level}</span></div>}<button onClick={() => onNavigate('impact')}>开始专业判断 / Start review <ArrowRight /></button></article>
    </div>
    <div className="overview-loop"><div><strong>Initial materials</strong><span>建立基线</span></div><ArrowRight /><div><strong>AI builds baseline</strong><span>提取项目理解</span></div><ArrowRight /><div><strong>New material</strong><span>识别变化与影响</span></div><ArrowRight /><div><strong>Human review</strong><span>人工判断并说明理由</span></div><ArrowRight /><div><strong>Context updates</strong><span>进入下一轮</span></div></div>
    <div className="overview-boundary"><ShieldCheck /><div><strong>这是一项 AI Practice 能力实验</strong><p>所有项目材料都是明确标注的模拟内容，用于测试能力边界；当前结果不代表真实项目验证，也不构成建筑、消防、结构或工程结论。</p></div><button onClick={() => onNavigate('context')}>查看全部依据 / View evidence</button></div>
  </section>;
}

function AnalyzeView({ model, connectionState, sourceTitle, setSourceTitle, sourceText, setSourceText, sourceImageDataUrl, setSourceImageDataUrl, sourceImageName, setSourceImageName, setSourceImageType, state, message, onAnalyze }: {
  model: string; connectionState: ConnectionState;
  sourceTitle: string; setSourceTitle: (value: string) => void; sourceText: string; setSourceText: (value: string) => void;
  sourceImageDataUrl: string; setSourceImageDataUrl: (value: string) => void; sourceImageName: string; setSourceImageName: (value: string) => void; setSourceImageType: (value: string) => void;
  state: 'idle' | 'running' | 'error'; message: string; onAnalyze: () => void;
}) {
  const [documentName, setDocumentName] = useState('');
  const [documentMessage, setDocumentMessage] = useState('支持 TXT、Markdown、CSV、TSV、JSON，最大 2 MB');
  async function chooseDocument(file?: File) {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'md', 'csv', 'tsv', 'json'].includes(extension)) {
      setDocumentMessage('暂不支持该格式；请先导出为 TXT、CSV 或 JSON。');
      return;
    }
    if (file.size > 2000000) {
      setDocumentMessage('文件超过 2 MB，请精简或拆分后上传。');
      return;
    }
    try {
      const content = await file.text();
      if (!content.trim()) throw new Error('文件没有可读取文字');
      const prefix = `【上传文件 / Uploaded file: ${file.name}】\n`;
      setSourceText(sourceText.trim() ? `${sourceText.trim()}\n\n${prefix}${content}` : `${prefix}${content}`);
      if (!sourceTitle.trim()) setSourceTitle(file.name.replace(/\.[^.]+$/, ''));
      setDocumentName(file.name);
      setDocumentMessage(`${file.name} 已读取，将作为可追溯原文进入分析。`);
    } catch {
      setDocumentMessage('文件读取失败，请检查编码或改为 UTF-8。');
    }
  }
  async function chooseImage(file?: File) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    if (!isImage) return;
    if (file.size > 2000000) {
      window.alert('图片请控制在 2 MB 以内 / Image must be under 2 MB');
      return;
    }
    const isSvg = file.type === 'image/svg+xml' || ext === 'svg';
    if (isSvg) {
      try {
        const svgText = await file.text();
        const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        const image = new window.Image();
        image.src = svgUrl;
        await image.decode();
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth || 1200, image.naturalHeight || 800));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.naturalWidth || 1200) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || 800) * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setSourceImageDataUrl(canvas.toDataURL('image/png'));
        setSourceImageName(file.name.replace(/\.svg$/i, '') + '.png');
        setSourceImageType('image/png');
      } catch {
        window.alert('SVG 转换失败，请改用 PNG / SVG conversion failed. Please use PNG.');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImageDataUrl(typeof reader.result === 'string' ? reader.result : '');
      setSourceImageName(file.name);
      setSourceImageType(file.type || ('image/' + ext));
    };
    reader.readAsDataURL(file);
  }
  function removeImage() {
    setSourceImageDataUrl('');
    setSourceImageName('');
    setSourceImageType('');
  }
  async function loadTest04Image() {
    try {
      const response = await fetch('/case-assets/test-04-atrium-review.png');
      if (!response.ok) throw new Error('Test image unavailable');
      const blob = await response.blob();
      await chooseImage(new File([blob], 'test-04-atrium-review.png', { type: 'image/png' }));
      setSourceTitle('测试 04：中庭大型公共活动复核');
      setSourceText('客户确认中庭将用于大型公共活动，希望保留开放感与连续公共动线。请只根据图中可见内容和现有项目语境，判断哪些既有假设需要专业复核；不要推测图中未提供的尺寸、容量、材料或合规结论。');
    } catch {
      window.alert('测试图片读取失败 / Unable to load the test image.');
    }
  }
  const ready = connectionState === 'connected' && Boolean(model.trim()) && Boolean(sourceTitle.trim()) && Boolean(sourceText.trim() || sourceImageDataUrl);
  return <section className="workspace secondary-view analyze-view">
    <div className="workspace-heading"><div><p className="eyebrow">分析新材料 / ANALYZE NEW SOURCE</p><h2>把建筑图像和文字放进同一条判断链</h2><p className="bilingual-note">左侧说明材料，右侧核对图像与分析条件。<span>Describe the source, attach evidence, then run one traceable review.</span></p></div></div>
    <div className="analysis-grid balanced">
      <section className="analysis-card material-copy">
        <div className="card-step"><span>01</span><div><strong>材料信息</strong><small>SOURCE DETAILS</small></div></div>
        <label htmlFor="source-title">材料标题 / Source title</label>
        <Input id="source-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="例如：客户对中庭使用的新理解" />
        <label htmlFor="source-document">上传文件或表格 / Document or table</label>
        <label className="document-upload" htmlFor="source-document"><FileText /><span><strong>{documentName || '选择文件 / Choose file'}</strong><small>{documentMessage}</small></span><input id="source-document" type="file" accept=".txt,.md,.csv,.tsv,.json,text/plain,text/csv,application/json" onChange={(event) => void chooseDocument(event.target.files?.[0])} /></label>
        <label htmlFor="source-text">文字说明 / Written evidence</label>
        <Textarea id="source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="粘贴工程报告、审批反馈、图纸说明或供应链更新；只有图片时可以留空。" />
        <p className="field-help">写清“这次发生了什么变化”即可，不需要先写专业结论。只有图片时，系统只能读取图中可见内容。</p>
      </section>
      <section className="analysis-card visual-copy">
        <div className="card-step"><span>02</span><div><strong>图像与分析准备</strong><small>IMAGE & READINESS</small></div></div>
        {sourceImageDataUrl ? <div className="image-preview"><img src={sourceImageDataUrl} alt={sourceImageName} /><div><ImageIcon /><span><strong>{sourceImageName}</strong><small>将与文字一起分析并保存来源</small></span><button onClick={removeImage} aria-label="移除图片"><Trash2 /></button></div></div> : <label className="image-drop" htmlFor="source-image"><Upload /><strong>上传平面、剖面、分析图或照片</strong><span>Upload plan, section, diagram or site photo</span><small>PNG · JPG · WEBP · SVG，最大 2 MB</small><input id="source-image" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void chooseImage(event.target.files?.[0])} /></label>}
        {!sourceImageDataUrl && <Button variant="outline" className="test-image-button" onClick={() => void loadTest04Image()}><ImageIcon />载入测试 04 标准图 / Load test image</Button>}
        <div className={'analysis-readiness ' + (ready ? 'ready' : '')}>
          <div><span className="connection-status-dot" /><strong>{connectionState === 'connected' ? '模型已连接 · ' + model : '模型尚未连接'}</strong></div>
          <p>{!sourceTitle.trim() ? '请填写材料标题' : !sourceText.trim() && !sourceImageDataUrl ? '请提供文字或图片' : connectionState !== 'connected' ? '请在左下角连接视觉模型' : sourceImageDataUrl && !sourceText.trim() ? '仅图片模式：可以读取可见内容，但无法判断发生了什么变化' : sourceImageDataUrl ? '图文模式：可以对照变化说明与图像进行影响分析' : '文字材料已准备，可以开始影响分析'}</p>
        </div>
      </section>
    </div>
    <div className="analysis-runbar"><div><strong>{sourceImageDataUrl && !sourceText.trim() ? '当前只会读取图片；补充变化说明后才能分析影响' : 'AI 将输出候选影响，不会自动修改设计决定'}</strong><span>{sourceImageDataUrl && !sourceText.trim() ? 'Image reading only. Add a change statement for impact analysis.' : 'Candidate impact only. Professional judgment remains required.'}</span></div><Button size="lg" disabled={state === 'running' || !ready} onClick={onAnalyze}>{state === 'running' ? <Loader2 className="spin" /> : <Sparkles />}{sourceImageDataUrl && !sourceText.trim() ? '读取图片 / Read image' : '运行图文影响分析 / Analyze'}</Button></div>
    {state === 'error' && <p className="analysis-error">{message}</p>}
    <div className="analysis-next"><strong>分析流程 / ANALYSIS FLOW</strong><ol><li>识别图中直接可见内容</li><li>与文字和既有语境对照</li><li>提出带关系类型的影响路径</li><li>由专业人员保存结论</li></ol></div>
  </section>;
}

const fallbackSources = [
  ['HC-S001', '项目简报 / Project brief', '01.12', '建立项目目标与初始边界 / Project goals and initial boundaries'],
  ['HC-S002', '利益相关方访谈 / Stakeholder interviews', '01.19', '多方诉求与专业观点 / Stakeholder views'],
  ['HC-S003', '设计意图与决定基线 / Intent & decision baseline', '02.02', '已确认意图、工作假设与早期决定 / Approved context'],
  ['HC-S004', '客户对中庭使用的新理解 / New client understanding', '02.18', '测试客户新诉求对疏散假设的影响 / Tests impact on evacuation assumption', '/case-assets/atrium-circulation-section.svg', 'atrium-circulation-section.svg'],
  ['HC-S005', '工程团队的结构边界更新 / Structural boundary update', '03.04', '测试工程新边界对大跨度假设的影响 / Tests impact on long-span assumption', '/case-assets/long-span-structure-section.svg', 'long-span-structure-section.svg'],
  ['HC-S006', '滨水建筑新规范要求 / New waterfront regulation', '03.20', '测试规范新要求对立面假设的影响 / Tests impact on facade assumption', '/case-assets/waterfront-facade-elevation.svg', 'waterfront-facade-elevation.svg'],
  ['HC-S007', '活动家具到货时间调整 / Furniture delivery note', '03.23', '无关信息误报测试 / False-alert control'],
  ['HC-S008', '模糊的空间弹性意见 / Ambiguous flexibility comment', '03.27', '不确定性与澄清测试 / Ambiguity test'],
];

const publicPracticeEvidence = [
  {
    tag: 'AI-NATIVE DESIGN',
    title: 'AI-native architectural design workflow',
    date: '2026.08.14',
    finding: 'M Moser 公开说明其智能体工作流会读取更广泛的项目语境与设计师意图，并由设计师保留专业判断和最终决定。',
    supports: '支持本项目研究“AI 如何理解变化并触发人工复核”。',
    href: 'https://www.mmoser.com/news/m-moser-recognised-for-ai-native-architectural-design-workflow/',
  },
  {
    tag: 'AI + BIM',
    title: 'buildingSMART China 智联杯 AI+BIM 实践',
    date: '2026.02.06',
    finding: '官方案例强调在 BIM 完成前引入 AI，连接早期设计意图与结构化 BIM 信息，减少设计到交付的信息割裂。',
    supports: '支持本项目研究“设计意图与决定如何跨阶段保持连续”。',
    href: 'https://www.mmoser.com/zh-hans/news/m-moser-receives-top-honor-at-buildingsmart-china-zhilian-cup/',
  },
  {
    tag: 'INTEGRATED DELIVERY',
    title: 'Integrated Design · Engineer · Deliver services',
    date: '持续公开 / Ongoing',
    finding: 'M Moser 将建筑、机电、可持续、智能建筑、施工前期与施工管理组织在一体化交付体系中。',
    supports: '支持本项目把变化影响放在跨专业关系中，而不是只做单份文档总结。',
    href: 'https://www.mmoser.com/services/',
  },
];

function SourceContextView({ sources, onAddSource }: { sources: string[][]; onAddSource: (title: string, body: string, role: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const displaySources = sources.length ? sources : fallbackSources;
  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try { await onAddSource(title.trim(), body.trim(), role.trim()); setTitle(''); setBody(''); setRole(''); setShowForm(false); } finally { setSaving(false); }
  }
  return <section className="workspace secondary-view">
    <div className="workspace-heading"><div><p className="eyebrow">证据与测试材料 / EVIDENCE & TEST SOURCES</p><h2>这个项目的依据从哪里来？</h2><p className="bilingual-note">研究背景来自 M Moser 公开的 AI 实践；案例材料是明确标注的虚构内容。<span>Public AI practice grounds the research; the case materials are synthetic.</span></p></div></div>
    <div className="source-section-heading"><div><span>01</span><div><strong>研究背景</strong><small>RESEARCH BACKGROUND</small></div></div><p>来自 M Moser 官方网站的公开 AI 实践，说明为什么研究“变化影响与决策连续性”这个方向。</p></div>
    <div className="practice-disclosure"><ShieldCheck /><div><strong>研究边界 / Research boundary</strong><p>这些公开资料用于说明研究方向，不构成本项目的案例。系统不会把网页未公开的信息当作事实，也不能替代对真实项目团队的访谈和验证。</p></div></div>
    <div className="practice-evidence-grid">{publicPracticeEvidence.map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={item.href}><div><span>{item.tag}</span><small>{item.date}</small></div><h3>{item.title}</h3><p>{item.finding}</p><strong>{item.supports}</strong><footer>查看 M Moser 官方原文 / Open official source <ArrowRight /></footer></a>)}</div>
    <div className="source-section-heading synthetic-heading"><div><span>02</span><div><strong>虚构案例：临港文化中心</strong><small>SYNTHETIC CASE</small></div></div><p>{displaySources.length} 份明确标注的模拟测试材料。</p></div>
    <div className="source-disclosure"><BookOpen /><div><strong>事实与模拟边界 / Fact–simulation boundary</strong><p><b>临港文化中心是一个虚构项目。</b> 所有材料，包括客户新理解、工程边界和规范要求，都是为能力测试编写的模拟内容，不代表任何真实客户或真实项目。每份材料打开后会显示来源类型。</p></div></div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}><Button variant="outline" onClick={() => setShowForm((v) => !v)}>{showForm ? '收起表单 / Close' : '新增材料 / Add source'} <FilePlus2 /></Button></div>
    {showForm && <div style={{ display: 'grid', gap: '12px', padding: '20px', border: '1px solid var(--border, #e5e7eb)', borderRadius: '12px', marginBottom: '20px', background: 'var(--card, #fff)' }}>
      <label htmlFor="ns-title">材料标题 / Title</label><Input id="ns-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：新设备协调条件更新" />
      <label htmlFor="ns-body">材料内容 / Content</label><Textarea id="ns-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="粘贴工程报告、审批反馈、评审结论或供应链更新……" />
      <label htmlFor="ns-role">用途说明 / Role（可选）</label><Input id="ns-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="这份材料为什么重要" />
      <div><Button size="lg" disabled={saving || !title.trim() || !body.trim()} onClick={submit}>{saving ? <Loader2 className="spin" /> : <FilePlus2 />}保存材料 / Save source</Button></div>
    </div>}
    <div className="source-table"><div className="source-table-head"><span>编号 / ID</span><span>材料 / SOURCE</span><span>日期 / DATE</span><span>用途 / ROLE</span><span>查看 / VIEW</span></div>{displaySources.map((source) => <article className="source-record" key={source[0]}><div className="source-table-row"><strong>{source[0]}</strong><span className="source-name">{source[4] && <img src={source[4]} alt={source[5] || source[1]} />}<span>{source[1]}{source[5] && <small><ImageIcon />{source[5]}</small>}</span></span><small>{source[2]}</small><p>{source[3]}</p><button onClick={() => setExpandedSource(expandedSource === source[0] ? null : source[0])}>{expandedSource === source[0] ? '收起 / Close' : '打开 / Open'}<ChevronDown className={expandedSource === source[0] ? 'rotate' : ''} /></button></div>{expandedSource === source[0] && <div className="source-expanded">{source[4] && <img src={source[4]} alt={source[5] || source[1]} />}<div><strong>{source[1]}</strong><p>{source[6] || '该材料的完整文字将在数据库载入后显示。'}</p><small>来源编号 {source[0]} · 模拟项目材料 / Synthetic project evidence</small></div></div>}</article>)}</div>
  </section>;
}

function SecondaryView({ view, records, sources, intents, onOpenImpact, onExport, onAddSource }: { view: Exclude<View, 'overview' | 'impact' | 'analyze'>; records: DecisionRecord[]; sources: string[][]; intents: IntentRecord[]; onOpenImpact: () => void; onExport: () => void; onAddSource: (title: string, body: string, role: string) => Promise<void> }) {
  if (view === 'context') return <SourceContextView sources={sources} onAddSource={onAddSource} />;

  if (view === 'map') return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">项目关系图 / INTELLIGENCE MAP</p><h2>追溯一次客户新理解如何穿过项目</h2><p className="bilingual-note">关系图把来源、假设、意图和决定连接起来，帮助团队看到跨专业连锁影响。<span>The map traces change across professional boundaries.</span></p></div></div><div className="map-canvas"><div className="map-column"><p className="map-label">新证据 / Evidence</p><div className="map-card gold"><small>HC-S004 · 客户新理解</small><strong>中庭需容纳更大人群</strong><span>测试条件 / Simulated input</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">工作假设 / Assumption</p><div className="map-card coral"><small>HC-A001 · 受到挑战</small><strong>疏散方案支持连续开放中庭</strong><span>建议复核 / Review recommended</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">设计意图 / Intent</p><div className="map-card green"><small>HC-I001 · 仍可保留</small><strong>连续的公共动线</strong><span>项目简报衍生 / Grounded intent</span></div></div><ArrowRight /><div className="map-column"><p className="map-label">已有决定 / Decision</p><div className="map-card"><small>HC-D001 · 等待复核</small><strong>连续开放中庭与光井序列</strong><span>建筑 × 消防 × 机电</span></div></div></div><div className="continuity-note"><ShieldCheck /><div><strong>AI 只触发复核 / AI triggers review</strong><p>系统没有取消连续公共动线，也没有自动选择疏散或消防方案；它把需要共同判断的影响链交给专业团队。</p></div></div></section>;

  if (view === 'review') return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">处理记录 / HUMAN REVIEW HISTORY</p><h2>人做了什么判断，为什么？</h2><p className="bilingual-note">这里保存人工结论，不让后续 AI 覆盖。<span>Human decisions and rationale remain part of the project context.</span></p></div></div><div className="certainty-grid"><div><span>01</span><small>提取置信度 / EXTRACTION</small><strong>高 / High</strong><p>系统从 HC-S004 找到客户对中庭的新理解。</p></div><div><span>02</span><small>证据充分性 / SUFFICIENCY</small><strong>有限 / Limited</strong><p>仍需建筑、消防、机电和造价负责人共同核实。</p></div><div><span>03</span><small>已保存人工判断 / SAVED REVIEWS</small><strong>{records.length} 条</strong><p>已写入 D1 数据库，并进入后续 AI 语境和导出文件。</p></div></div>{records.length > 0 && <div className="history-list">{records.map((record) => <article key={record.reviewId}><strong>{record.reviewId} · {actionLabels[record.action]}</strong><p>{record.rationale}</p><small>{new Date(record.savedAt).toLocaleString('zh-CN')}</small></article>)}</div>}<Button size="lg" onClick={onOpenImpact}>进入专业复核 / Open review <ArrowRight /></Button></section>;

  return <section className="workspace secondary-view"><div className="workspace-heading"><div><p className="eyebrow">当前设计意图 · V6 / CURRENT INTENT</p><h2>下游工作可以依赖的当前项目语境</h2><p className="bilingual-note">人工判断会改变这里显示的复核状态，并进入导出文件。<span>Human reviews update the visible status and exported context.</span></p></div><Button size="lg" onClick={onExport}><Download />导出结构化任务书 / Export</Button></div><div className="intent-grid">{intents.map((intent) => { const revised = intent.statement !== intent.originalStatement; return <article key={intent.id}><div><span>{intent.id} · 已确认 / APPROVED</span><em>{revised ? '人工已更新 / Revised' : '保持确认 / Approved'}</em></div><h3>{intent.title}<small>{intent.titleEn}</small></h3><p>{intent.statement}</p>{revised && <aside>人工更新 / Human revision</aside>}<button onClick={onOpenImpact}>查看关联判断 / View reasoning <ChevronRight /></button></article>; })}</div><div className="export-guardrail"><CircleHelp /><div><strong>下游 AI 约束 / Downstream AI guardrail</strong><p>不得从未解决的复核项直接形成建筑、消防、结构、机电、造价或施工结论；必须交由对应专业人员判断。</p></div></div></section>;
}
