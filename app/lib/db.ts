import { env } from 'cloudflare:workers';

export type SourceRow = {
  id: string; seq: number; date: string; title: string; titleEn: string; body: string; role: string;
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
`;

export async function ensureSchema() {
  const db = getDb();
  await db.batch(SCHEMA.split(';').filter((s) => s.trim()).map((s) => db.prepare(s)));
  return db;
}

async function count(db: D1Database, table: string): Promise<number> {
  const result = await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).first<{ c: number }>();
  return result?.c ?? 0;
}

export async function seedIfEmpty() {
  const db = getDb();
  if ((await count(db, 'sources')) > 0) return;

  const sources: SourceRow[] = [
    { id: 'LS-S001', seq: 1, date: '01.12', title: '初始研究简报 / Initial research brief', titleEn: 'Initial research brief', body: 'HelixNova 希望新的转化研发中心缩短样本从接收到分析的交接过程，使实验科学家、计算研究人员和外部合作伙伴围绕同一研究问题协作。项目提出三项价值目标：保持样本与数据可追溯；支持研究方案变化；让跨学科团队更早发现实验与分析之间的问题。具体实验分区、安全要求、设备接口和数据展示边界仍需专业负责人确认。', role: '建立研究目标和初始边界 / Research goals and initial boundaries' },
    { id: 'LS-S002', seq: 2, date: '01.19', title: '跨专业访谈 / Discipline interviews', titleEn: 'Discipline interviews', body: '研究负责人："研究方向会变化，我们不希望每次更换流程都重建整套空间。" 实验运营负责人："共享设备可以提高利用率，但样本身份、清洁步骤和交接责任必须清楚。" 工程负责人："设备负荷、散热、振动、维护空间和服务接口会决定什么能够真正调整。" 数据治理负责人："看见研究进展很重要，但原始数据、样本编号和合作伙伴资料有不同访问边界。"', role: '研究、运营、工程与数据治理观点 / Four discipline perspectives' },
    { id: 'LS-S003', seq: 3, date: '02.02', title: '设计意图与决定记录 / Intent record', titleEn: 'Design intent & decision record', body: '已确认设计意图：LS-I001 可追溯的样本流程；LS-I002 可调整的研究平台；LS-I003 受治理的跨专业可见性。工作假设：LS-A001 多个研究项目可以共用样本前处理流程和空间；LS-A002 标准化实验模块和预留接口可以覆盖预期设备变化；LS-A003 经过筛选的研究信息可以在不同团队区域持续展示。早期决定：LS-D001 设置共享样本准备中心；LS-D002 采用标准化模块与服务分区；LS-D003 设置研究进展可视化界面。', role: '已确认意图、工作假设和早期决定 / Approved context' },
    { id: 'LS-S004', seq: 4, date: '02.18', title: '新实验流程要求 / Protocol change', titleEn: 'Protocol change', body: '一个新增研究流程要求样本从接收、特定前处理到分析之间保持单向流转，并与常规共享前处理活动区分。记录没有说明该要求是否适用于所有研究项目，也没有给出最终安全分区结论。', role: '挑战共享前处理假设 / Challenges shared preparation' },
    { id: 'LS-S005', seq: 5, date: '03.04', title: '新设备协调条件 / Equipment update', titleEn: 'Equipment coordination update', body: '候选分析设备的最新资料增加了散热、振动控制、维护净空和连续运行条件，其中部分条件超出早期通用设备模块采用的设计输入。这些信息需要设备供应商、实验室规划师、结构与机电工程师共同核实。', role: '触发设备与工程接口复核 / Triggers coordination review' },
    { id: 'LS-S006', seq: 6, date: '03.20', title: '数据治理评审 / Governance review', titleEn: 'Data governance review', body: '治理评审将研究信息分为三类：可广泛展示的项目状态、仅限内部团队的分析内容，以及受合作协议限制的原始数据与样本标识。当前"持续展示研究进展"的假设没有区分这些访问边界。评审仍支持跨学科可见性的设计意图，但要求重新检查展示内容、管理责任和更新方式。', role: '重新界定研究信息的展示边界 / Refines visibility boundaries' },
    { id: 'LS-S007', seq: 7, date: '03.23', title: '耗材送货通知 / Delivery note', titleEn: 'Delivery note', body: '一批常规耗材的送货时间由周二上午调整为周三下午，收货联系人已更新。这条行政信息不应触发设计意图或设计决定的复核。', role: '无关信息误报测试 / False-alert control' },
    { id: 'LS-S008', seq: 8, date: '03.27', title: '模糊评审意见 / Ambiguous comment', titleEn: 'Ambiguous comment', body: '一位负责人表示："下一版实验室需要更灵活。"记录没有说明需要改变的研究活动、设备范围、验证要求或成功标准。', role: '不确定性与澄清测试 / Ambiguity test' },
  ];

  const intents: IntentRow[] = [
    { id: 'LS-I001', title: '可追溯的样本流程', titleEn: 'Traceable sample journey', statement: '让样本、数据和交接责任在研究流程中保持清晰。', originalStatement: '让样本、数据和交接责任在研究流程中保持清晰。', status: 'approved' },
    { id: 'LS-I002', title: '可调整的研究平台', titleEn: 'Adaptable research platform', statement: '支持研究方案和设备组合变化，并明确重新验证边界。', originalStatement: '支持研究方案和设备组合变化，并明确重新验证边界。', status: 'approved' },
    { id: 'LS-I003', title: '受治理的跨专业可见性', titleEn: 'Governed interdisciplinary visibility', statement: '促进研究协作，同时遵守数据与合作信息边界。', originalStatement: '促进研究协作，同时遵守数据与合作信息边界。', status: 'approved' },
  ];

  const assumptions: AssumptionRow[] = [
    { id: 'LS-A001', statement: '多个研究项目可以共用样本前处理流程和空间' },
    { id: 'LS-A002', statement: '标准化实验模块和预留接口可以覆盖预期设备变化' },
    { id: 'LS-A003', statement: '经过筛选的研究信息可以在不同团队区域持续展示' },
  ];

  const decisions: DecisionRow[] = [
    { id: 'LS-D001', statement: '设置共享样本准备中心' },
    { id: 'LS-D002', statement: '采用标准化模块与服务分区' },
    { id: 'LS-D003', statement: '设置研究进展可视化界面' },
  ];

  const reviews: ReviewRow[] = [
    { id: 'CR-014', sourceId: 'LS-S004', level: 'review_required', title: '单向样本流程可能影响共享前处理决定', titleEn: 'A unidirectional protocol may affect the shared preparation decision', summary: '新增研究流程可能挑战"所有项目可以共用前处理流程"的假设，适用范围仍需专业人员确认。', summaryEn: 'A new protocol may challenge the shared-preparation assumption; its scope still needs professional judgment.', path: JSON.stringify(['LS-S004', 'LS-A001', 'LS-I001', 'LS-D001']), labels: JSON.stringify(['新要求 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision']), excerpt: '新增研究流程要求样本在接收、特定前处理和分析之间保持单向流转，并与常规共享活动区分。', action: null, rationale: null, updatedStatement: null, savedAt: null },
    { id: 'CR-015', sourceId: 'LS-S005', level: 'review_required', title: '设备条件超出早期通用模块的设计输入', titleEn: 'Equipment conditions exceed the early generic module inputs', summary: '新增散热、振动和维护条件可能影响模块化服务策略，需要设备、实验室规划和工程专业共同核实。', summaryEn: 'New heat, vibration and maintenance conditions may affect the modular service strategy and require multidisciplinary review.', path: JSON.stringify(['LS-S005', 'LS-A002', 'LS-I002', 'LS-D002']), labels: JSON.stringify(['新条件 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision']), excerpt: '候选设备增加了散热、振动控制、维护净空和连续运行条件，部分超出早期设计输入。', action: null, rationale: null, updatedStatement: null, savedAt: null },
    { id: 'CR-016', sourceId: 'LS-S006', level: 'review_recommended', title: '研究信息展示需要区分访问边界', titleEn: 'Research visibility needs differentiated access boundaries', summary: '新治理规则挑战了"研究信息可以持续跨区域展示"的假设，但仍支持跨专业可见性的总体意图。', summaryEn: 'New governance rules challenge continuous cross-zone display while still supporting the broader intent of interdisciplinary visibility.', path: JSON.stringify(['LS-S006', 'LS-A003', 'LS-I003', 'LS-D003']), labels: JSON.stringify(['新规则 / Evidence', '工作假设 / Assumption', '设计意图 / Intent', '已有决定 / Decision']), excerpt: '原始数据、样本标识和合作伙伴资料具有不同访问边界。', action: null, rationale: null, updatedStatement: null, savedAt: null },
  ];

  const batch: D1PreparedStatement[] = [];
  for (const s of sources) batch.push(db.prepare('INSERT INTO sources (id, seq, date, title, title_en, body, role) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(s.id, s.seq, s.date, s.title, s.titleEn, s.body, s.role));
  for (const i of intents) batch.push(db.prepare('INSERT INTO intents (id, title, title_en, statement, original_statement, status) VALUES (?, ?, ?, ?, ?, ?)').bind(i.id, i.title, i.titleEn, i.statement, i.originalStatement, i.status));
  for (const a of assumptions) batch.push(db.prepare('INSERT INTO assumptions (id, statement) VALUES (?, ?)').bind(a.id, a.statement));
  for (const d of decisions) batch.push(db.prepare('INSERT INTO decisions (id, statement) VALUES (?, ?)').bind(d.id, d.statement));
  for (const r of reviews) batch.push(db.prepare('INSERT INTO reviews (id, source_id, level, title, title_en, summary, summary_en, path, labels, excerpt, action, rationale, updated_statement, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(r.id, r.sourceId, r.level, r.title, r.titleEn, r.summary, r.summaryEn, r.path, r.labels, r.excerpt, r.action, r.rationale, r.updatedStatement, r.savedAt));
  await db.batch(batch);
}

export async function loadContext() {
  const db = getDb();
  const sources = await db.prepare('SELECT id, seq, date, title, title_en AS titleEn, body, role FROM sources ORDER BY seq ASC').all<SourceRow>();
  const intents = await db.prepare('SELECT id, title, title_en AS titleEn, statement, original_statement AS originalStatement, status FROM intents ORDER BY id ASC').all<IntentRow>();
  const assumptions = await db.prepare('SELECT id, statement FROM assumptions ORDER BY id ASC').all<AssumptionRow>();
  const decisions = await db.prepare('SELECT id, statement FROM decisions ORDER BY id ASC').all<DecisionRow>();
  const reviews = await db.prepare('SELECT id, source_id AS sourceId, level, title, title_en AS titleEn, summary, summary_en AS summaryEn, path, labels, excerpt, action, rationale, updated_statement AS updatedStatement, saved_at AS savedAt FROM reviews ORDER BY id ASC').all<ReviewRow>();
  return { sources: sources.results, intents: intents.results, assumptions: assumptions.results, decisions: decisions.results, reviews: reviews.results };
}

export async function buildProjectContextText() {
  const { intents, assumptions, decisions } = await loadContext();
  const lines: string[] = [];
  lines.push('当前项目为虚构的 HelixNova 生命科学转化研发中心。');
  lines.push('已确认意图：');
  for (const i of intents) lines.push(`- ${i.id} ${i.title}：${i.statement}`);
  lines.push('工作假设：');
  for (const a of assumptions) lines.push(`- ${a.id} ${a.statement}`);
  lines.push('已有决定：');
  for (const d of decisions) lines.push(`- ${d.id} ${d.statement}`);
  return lines.join('\n');
}

export async function insertSource(row: Omit<SourceRow, 'seq'> & { seq?: number }) {
  const db = getDb();
  const existing = await db.prepare('SELECT MAX(seq) AS m FROM sources').first<{ m: number }>();
  const seq = row.seq ?? (existing?.m ?? 0) + 1;
  await db.prepare('INSERT INTO sources (id, seq, date, title, title_en, body, role) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, seq, row.date, row.title, row.titleEn, row.body, row.role).run();
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
