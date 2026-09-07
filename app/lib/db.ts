import { env } from 'cloudflare:workers';

export type SourceRow = {
  id: string; seq: number; date: string; title: string; titleEn: string; body: string; role: string;
  assetName?: string | null; assetType?: string | null; assetUrl?: string | null;
};
export type IntentRow = {
  id: string; title: string; titleEn: string; statement: string; originalStatement: string; status: string;
};
export type AssumptionRow = { id: string; statement: string };
export type DecisionRow = { id: string; statement: string };
export type ReviewRow = {
  id: string; sourceId: string; level: string; title: string; titleEn: string;
  summary: string; summaryEn: string; path: string; labels: string; excerpt: string;
  action: string | null; rationale: string | null; updatedStatement: string | null; savedAt: string | null;
};

function getDb(): D1Database {
  if (!env?.DB) throw new Error('D1 数据库未绑定。请确认 .openai/hosting.json 的 d1 字段已配置。');
  return env.DB;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, seq INTEGER NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL,
  title_en TEXT NOT NULL, body TEXT NOT NULL, role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_assets (
  source_id TEXT PRIMARY KEY, name TEXT NOT NULL, mime_type TEXT NOT NULL, asset_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, title_en TEXT NOT NULL,
  statement TEXT NOT NULL, original_statement TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY, statement TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, statement TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL, level TEXT NOT NULL,
  title TEXT NOT NULL, title_en TEXT NOT NULL, summary TEXT NOT NULL, summary_en TEXT NOT NULL,
  path TEXT NOT NULL, labels TEXT NOT NULL, excerpt TEXT NOT NULL,
  action TEXT, rationale TEXT, updated_statement TEXT, saved_at TEXT
);
CREATE TABLE IF NOT EXISTS case_versions (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL, updated_at TEXT NOT NULL
);
`;

export async function ensureSchema() {
  const db = getDb();
  await db.batch(SCHEMA.split(';').filter((s) => s.trim()).map((s) => db.prepare(s)));
  return db;
}


export async function seedIfEmpty() {
  const db = getDb();
  const currentVersion = await db.prepare("SELECT version FROM case_versions WHERE id = 'harbourside-cultural-centre'").first<{ version: number }>();
  if ((currentVersion?.version ?? 0) >= 4) return;

  const sources: SourceRow[] = [
    { id: 'HC-S001', seq: 1, date: '01.12', title: '项目简报 / Project brief', titleEn: 'Project brief', body: '临港文化中心是一座虚构的滨水市民文化建筑，包含展览、演艺和公共阅读功能。项目希望把滨水公共空间、灵活的展览大空间和连续的公共动线组织在一起，为市民提供可自由穿行、可举办多种活动的公共文化场所。具体结构体系、疏散方案、立面材料和运营边界仍需专业团队确认。', role: '建立项目目标与初始边界 / Project goals and initial boundaries' },
    { id: 'HC-S002', seq: 2, date: '01.19', title: '利益相关方访谈 / Stakeholder interviews', titleEn: 'Stakeholder interviews', body: '策展方："展览内容会变化，我们希望大空间能适应不同的布展方式。" 运营方："公共区域要能分时段独立开放，同时保持整体可达。" 结构工程师："滨水地基条件和风荷载会决定大跨度和屋面能怎么做。" 可持续顾问："临水立面要同时满足耐久、节能和维护。" 以上是专业人员观点，尚未自动成为已确认事实或设计要求。', role: '多方诉求与专业观点 / Stakeholder views and discipline perspectives' },
    { id: 'HC-S003', seq: 3, date: '02.02', title: '设计意图与决定基线 / Intent & decision baseline', titleEn: 'Design intent & decision baseline', body: '已确认设计意图：HC-I001 连续的公共动线——光井与中庭引导公众自然穿行；HC-I002 灵活的大空间——大跨度空间适应未来功能变化；HC-I003 滨水公共可达——不同标高与滨水公共空间连接。工作假设：HC-A001 当前疏散与消防方案支持连续开放的中庭与光井；HC-A002 当前结构体系支持大跨度且可适应屋面荷载变化；HC-A003 滨水立面材料满足耐久、节能与维护要求。早期决定：HC-D001 采用连续开放中庭与光井序列；HC-D002 采用大跨度结构体系；HC-D003 采用特定滨水幕墙系统。', role: '已确认意图、工作假设与早期决定 / Approved context' },
    { id: 'HC-S004', seq: 4, date: '02.18', title: '客户对中庭使用的新理解 / New client understanding', titleEn: 'New client understanding of the atrium', body: '客户对中庭与光井的使用场景有了新的理解：希望未来承办更多公共活动、容纳更大规模的人群聚集。这个新理解需要团队重新确认当前的疏散与消防方案能否覆盖更高的人流密度，同时不牺牲连续开放的公共动线体验。记录没有给出最终的人流规模或活动清单，仍需专业团队共同核实。', role: '测试客户新诉求对既有假设的影响 / Tests impact of a new client ambition' },
    { id: 'HC-S005', seq: 5, date: '03.04', title: '工程团队的结构边界更新 / Structural boundary update', titleEn: 'Updated structural boundary conditions', body: '工程团队基于滨水地基条件和风荷载分析，更新了大跨度屋面的结构接口条件。新的技术边界要求团队重新确认当前结构体系能否覆盖屋面荷载变化，同时保留灵活大空间的意图。记录没有给出最终结构方案，需要结构、机电和造价专业共同核实。', role: '测试工程新边界对结构假设的影响 / Tests impact of a new engineering boundary' },
    { id: 'HC-S006', seq: 6, date: '03.20', title: '滨水建筑新规范要求 / New waterfront regulation', titleEn: 'New waterfront regulation', body: '当地出台了滨水建筑耐久与节能的新规范，对临水立面的材料、隔热和维护提出新的要求。团队需要重新确认当前幕墙系统是否满足新规范，同时保留滨水公共可达与通透的体验。记录没有给出具体的材料替代方案，需要立面、可持续和造价专业共同核实。', role: '测试规范新要求对立面假设的影响 / Tests impact of a new regulation' },
    { id: 'HC-S007', seq: 7, date: '03.23', title: '活动家具到货时间调整 / Furniture delivery note', titleEn: 'Furniture delivery note', body: '一批活动家具的预计到货时间从周二调整到周四，收货联系人不变。这条行政信息与当前设计意图、结构体系和立面决定无直接关系，不应触发专业复核。', role: '无关信息误报测试 / False-alert control' },
    { id: 'HC-S008', seq: 8, date: '03.27', title: '模糊的空间弹性意见 / Ambiguous flexibility comment', titleEn: 'Ambiguous flexibility comment', body: '一位负责人表示："这个空间要更有弹性。"记录没有说明希望改变的活动类型、空间范围、性能要求或判断标准。系统应请求澄清，不能据此修改任何设计意图或决定。', role: '不确定性与澄清测试 / Ambiguity test' },
  ];

  const intents: IntentRow[] = [
    { id: 'HC-I001', title: '连续的公共动线', titleEn: 'Continuous public circulation', statement: '通过光井与中庭引导公众自然穿行，形成清晰、连续的公共动线。', originalStatement: '通过光井与中庭引导公众自然穿行，形成清晰、连续的公共动线。', status: 'approved' },
    { id: 'HC-I002', title: '灵活的大空间', titleEn: 'Flexible long-span space', statement: '以大跨度空间适应未来功能变化，支持多种展览与活动布展方式。', originalStatement: '以大跨度空间适应未来功能变化，支持多种展览与活动布展方式。', status: 'approved' },
    { id: 'HC-I003', title: '滨水公共可达', titleEn: 'Waterfront public access', statement: '在不同标高与滨水公共空间建立连接，保持公众对滨水的可达与通透体验。', originalStatement: '在不同标高与滨水公共空间建立连接，保持公众对滨水的可达与通透体验。', status: 'approved' },
  ];

  const assumptions: AssumptionRow[] = [
    { id: 'HC-A001', statement: '当前疏散与消防方案支持连续开放的中庭与光井' },
    { id: 'HC-A002', statement: '当前结构体系支持大跨度且可适应屋面荷载变化' },
    { id: 'HC-A003', statement: '滨水立面材料满足耐久、节能与维护要求' },
  ];

  const decisions: DecisionRow[] = [
    { id: 'HC-D001', statement: '采用连续开放中庭与光井序列' },
    { id: 'HC-D002', statement: '采用大跨度结构体系' },
    { id: 'HC-D003', statement: '采用特定滨水幕墙系统' },
  ];

  const reviews: ReviewRow[] = [
    { id: 'CR-101', sourceId: 'HC-S004', level: 'review_recommended', title: '客户对中庭的新理解需要重新确认疏散方案', titleEn: 'A new client understanding reopens the atrium strategy', summary: '客户希望中庭承担更多公共活动与更大人群，这可能改变疏散与消防假设；连续公共动线的意图仍可保留。', summaryEn: 'A new client ambition for the atrium may change the evacuation assumption while the public-circulation intent can remain.', path: JSON.stringify(['HC-S004', 'HC-A001', 'HC-I001', 'HC-D001']), labels: JSON.stringify(['客户新理解 / Evidence', '疏散工作假设 / Assumption', '公共动线意图 / Intent', '中庭决定 / Decision']), excerpt: '客户希望中庭承办更多公共活动、容纳更大规模的人群聚集。', action: null, rationale: null, updatedStatement: null, savedAt: null },
    { id: 'CR-102', sourceId: 'HC-S005', level: 'review_recommended', title: '结构边界条件更新影响大跨度空间假设', titleEn: 'Updated structural boundary conditions affect the long-span assumption', summary: '工程团队更新了滨水地基与屋面荷载的接口条件，这可能改变大跨度结构假设；灵活大空间的意图仍可保留。', summaryEn: 'Updated foundation and roof-load conditions may change the long-span assumption while the flexible-space intent can remain.', path: JSON.stringify(['HC-S005', 'HC-A002', 'HC-I002', 'HC-D002']), labels: JSON.stringify(['工程新边界 / Evidence', '结构工作假设 / Assumption', '灵活空间意图 / Intent', '大跨度决定 / Decision']), excerpt: '工程团队基于滨水地基与风荷载更新了大跨度屋面的结构接口条件。', action: null, rationale: null, updatedStatement: null, savedAt: null },
    { id: 'CR-103', sourceId: 'HC-S006', level: 'review_recommended', title: '滨水新规范对幕墙系统提出新要求', titleEn: 'New waterfront regulations raise facade requirements', summary: '当地耐久与节能新规范对临水立面提出新要求，这可能改变幕墙假设；滨水公共可达的意图仍可保留。', summaryEn: 'New durability and energy regulations may change the facade assumption while the waterfront-access intent can remain.', path: JSON.stringify(['HC-S006', 'HC-A003', 'HC-I003', 'HC-D003']), labels: JSON.stringify(['规范新要求 / Evidence', '幕墙工作假设 / Assumption', '滨水可达意图 / Intent', '幕墙决定 / Decision']), excerpt: '当地新规范对临水立面的材料、隔热和维护提出新的要求。', action: null, rationale: null, updatedStatement: null, savedAt: null },
  ];

  const assets = [
    { sourceId: 'HC-S004', name: 'atrium-circulation-section.svg', mimeType: 'image/svg+xml', assetUrl: '/case-assets/atrium-circulation-section.svg' },
    { sourceId: 'HC-S005', name: 'long-span-structure-section.svg', mimeType: 'image/svg+xml', assetUrl: '/case-assets/long-span-structure-section.svg' },
    { sourceId: 'HC-S006', name: 'waterfront-facade-elevation.svg', mimeType: 'image/svg+xml', assetUrl: '/case-assets/waterfront-facade-elevation.svg' },
  ];

  const batch: D1PreparedStatement[] = [];
  for (const s of sources) batch.push(db.prepare('INSERT INTO sources (id, seq, date, title, title_en, body, role) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET seq=excluded.seq, date=excluded.date, title=excluded.title, title_en=excluded.title_en, body=excluded.body, role=excluded.role').bind(s.id, s.seq, s.date, s.title, s.titleEn, s.body, s.role));
  for (const i of intents) batch.push(db.prepare('INSERT INTO intents (id, title, title_en, statement, original_statement, status) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, title_en=excluded.title_en, original_statement=excluded.original_statement, status=excluded.status, statement=CASE WHEN intents.statement=intents.original_statement THEN excluded.statement ELSE intents.statement END').bind(i.id, i.title, i.titleEn, i.statement, i.originalStatement, i.status));
  for (const a of assumptions) batch.push(db.prepare('INSERT INTO assumptions (id, statement) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET statement=excluded.statement').bind(a.id, a.statement));
  for (const d of decisions) batch.push(db.prepare('INSERT INTO decisions (id, statement) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET statement=excluded.statement').bind(d.id, d.statement));
  for (const r of reviews) batch.push(db.prepare('INSERT INTO reviews (id, source_id, level, title, title_en, summary, summary_en, path, labels, excerpt, action, rationale, updated_statement, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, level=excluded.level, title=excluded.title, title_en=excluded.title_en, summary=excluded.summary, summary_en=excluded.summary_en, path=excluded.path, labels=excluded.labels, excerpt=excluded.excerpt').bind(r.id, r.sourceId, r.level, r.title, r.titleEn, r.summary, r.summaryEn, r.path, r.labels, r.excerpt, r.action, r.rationale, r.updatedStatement, r.savedAt));
  for (const a of assets) batch.push(db.prepare('INSERT INTO source_assets (source_id, name, mime_type, asset_url) VALUES (?, ?, ?, ?) ON CONFLICT(source_id) DO UPDATE SET name=excluded.name, mime_type=excluded.mime_type, asset_url=excluded.asset_url').bind(a.sourceId, a.name, a.mimeType, a.assetUrl));
  // 清理旧案例数据（生命科学 LS-* 与多哈 MX-*）
  batch.push(db.prepare("DELETE FROM reviews WHERE source_id LIKE 'LS-S%' OR source_id LIKE 'MX-S%'"));
  batch.push(db.prepare("DELETE FROM source_assets WHERE source_id LIKE 'LS-S%' OR source_id LIKE 'MX-S%'"));
  batch.push(db.prepare("DELETE FROM sources WHERE id LIKE 'LS-S%' OR id LIKE 'MX-S%'"));
  batch.push(db.prepare("DELETE FROM intents WHERE id LIKE 'LS-I%' OR id LIKE 'MX-I%'"));
  batch.push(db.prepare("DELETE FROM assumptions WHERE id LIKE 'LS-A%' OR id LIKE 'MX-A%'"));
  batch.push(db.prepare("DELETE FROM decisions WHERE id LIKE 'LS-D%' OR id LIKE 'MX-D%'"));
  batch.push(db.prepare("INSERT INTO case_versions (id, version, updated_at) VALUES ('harbourside-cultural-centre', 4, datetime('now')) ON CONFLICT(id) DO UPDATE SET version=excluded.version, updated_at=excluded.updated_at"));
  await db.batch(batch);
}

export async function loadContext() {
  const db = getDb();
  const sources = await db.prepare("SELECT s.id, s.seq, s.date, s.title, s.title_en AS titleEn, s.body, s.role, a.name AS assetName, a.mime_type AS assetType, a.asset_url AS assetUrl FROM sources s LEFT JOIN source_assets a ON a.source_id = s.id WHERE s.id LIKE 'HC-S%' ORDER BY s.seq ASC").all<SourceRow>();
  const intents = await db.prepare("SELECT id, title, title_en AS titleEn, statement, original_statement AS originalStatement, status FROM intents WHERE id LIKE 'HC-I%' ORDER BY id ASC").all<IntentRow>();
  const assumptions = await db.prepare("SELECT id, statement FROM assumptions WHERE id LIKE 'HC-A%' ORDER BY id ASC").all<AssumptionRow>();
  const decisions = await db.prepare("SELECT id, statement FROM decisions WHERE id LIKE 'HC-D%' ORDER BY id ASC").all<DecisionRow>();
  const reviews = await db.prepare("SELECT id, source_id AS sourceId, level, title, title_en AS titleEn, summary, summary_en AS summaryEn, path, labels, excerpt, action, rationale, updated_statement AS updatedStatement, saved_at AS savedAt FROM reviews WHERE source_id LIKE 'HC-S%' ORDER BY id ASC").all<ReviewRow>();
  return { sources: sources.results, intents: intents.results, assumptions: assumptions.results, decisions: decisions.results, reviews: reviews.results };
}

export async function buildProjectContextText() {
  const { intents, assumptions, decisions, reviews } = await loadContext();
  const lines: string[] = [];
  lines.push('当前案例是一个虚构的滨水文化中心（临港文化中心），用于测试 AI 能否发现变化对既有判断的影响。所有项目材料都是明确标注的模拟材料，不代表真实客户或真实项目。');
  lines.push('已确认意图：');
  for (const i of intents) lines.push(`- ${i.id} ${i.title}：${i.statement}`);
  lines.push('工作假设：');
  for (const a of assumptions) lines.push(`- ${a.id} ${a.statement}`);
  lines.push('已有决定：');
  for (const d of decisions) lines.push(`- ${d.id} ${d.statement}`);
  const humanReviews = reviews.filter((review) => review.action && review.rationale);
  if (humanReviews.length) {
    lines.push('已记录的人工判断（后续分析不得覆盖、忽略或通过更换对象绕开）：');
    for (const review of humanReviews) {
      const path = JSON.parse(review.path) as string[];
      const binding = review.action === 'reject' ? '该候选影响路径已被人工否决；仅重复原触发理由时不得重新提出，也不得把关联意图改写成受到挑战的假设。' : '';
      lines.push(`- ${review.id}；动作：${review.action}；候选路径：${path.join(' → ')}；理由：${review.rationale}${review.updatedStatement ? `；人工更新：${review.updatedStatement}` : ''}${binding ? `；约束：${binding}` : ''}`);
    }
  }
  return lines.join('\n');
}

export async function insertSource(row: Omit<SourceRow, 'seq'> & { seq?: number }) {
  const db = getDb();
  const existing = await db.prepare('SELECT MAX(seq) AS m FROM sources').first<{ m: number }>();
  const seq = row.seq ?? (existing?.m ?? 0) + 1;
  const batch = [
    db.prepare('INSERT INTO sources (id, seq, date, title, title_en, body, role) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, seq, row.date, row.title, row.titleEn, row.body, row.role),
  ];
  if (row.assetUrl && row.assetName && row.assetType) {
    batch.push(db.prepare('INSERT INTO source_assets (source_id, name, mime_type, asset_url) VALUES (?, ?, ?, ?)').bind(row.id, row.assetName, row.assetType, row.assetUrl));
  }
  await db.batch(batch);
  return { ...row, seq };
}

export async function updateIntentStatement(id: string, statement: string) {
  const db = getDb();
  await db.prepare('UPDATE intents SET statement = ? WHERE id = ?').bind(statement, id).run();
}

export async function upsertReview(row: ReviewRow) {
  const db = getDb();
  await db.prepare('INSERT INTO reviews (id, source_id, level, title, title_en, summary, summary_en, path, labels, excerpt, action, rationale, updated_statement, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET action = excluded.action, rationale = excluded.rationale, updated_statement = excluded.updated_statement, saved_at = excluded.saved_at').bind(row.id, row.sourceId, row.level, row.title, row.titleEn, row.summary, row.summaryEn, row.path, row.labels, row.excerpt, row.action ?? null, row.rationale ?? null, row.updatedStatement ?? null, row.savedAt ?? null).run();
}

export async function deleteReview(reviewId: string) {
  const db = getDb();
  const review = await db.prepare('SELECT source_id AS sourceId FROM reviews WHERE id = ?').bind(reviewId).first<{ sourceId: string }>();
  if (!review) return;
  const isSeedSource = /^HC-S00[1-8]$/.test(review.sourceId);
  await db.prepare('DELETE FROM reviews WHERE id = ?').bind(reviewId).run();
  if (!isSeedSource) {
    await db.prepare('DELETE FROM source_assets WHERE source_id = ?').bind(review.sourceId).run();
    await db.prepare('DELETE FROM sources WHERE id = ?').bind(review.sourceId).run();
  }
}
