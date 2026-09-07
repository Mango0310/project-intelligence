# Project Intelligence

**Human–AI Design Intent & Decision Continuity**

Project Intelligence 是一个 Human–AI Practice 能力实验。它研究：新资料持续进入复杂项目时，AI 能否找到可能受影响的旧假设、设计意图和决定，并把最终判断与责任保留给专业人员。

The working principle is:

> AI surfaces → Human judges → System preserves reasoning

当前案例是虚构的滨水文化中心（临港文化中心）。项目材料全部为明确标注的模拟内容，用于测试 AI 能否发现变化对既有判断的影响。研究背景来自 M Moser 公开的 AI 实践。

## Frozen MVP scope

The MVP will support one continuous workflow:

1. Review versioned project sources.
2. Extract stakeholder views, evidence, constraints, assumptions, design intents, and decisions with source references.
3. Let a person confirm, revise, or reject extracted claims and relationships.
4. Add new project material.
5. Surface candidate impact paths without changing an approved design intent automatically.
6. Let the responsible professional decide whether to keep, revise, reject, or investigate.
7. Preserve the decision, author, rationale, and source versions.
8. Export the current Design Intent & Change Brief.

It is not a project management system, an architectural design generator, or an autonomous approval system.

## Repository structure

- `docs/product-definition.md` — stable product and human–AI boundary.
- `case-study-harbourside/manifest.md` — 虚构案例、研究背景与模拟条件的边界。
- `case-study-harbourside/materials/` — 项目简报与模拟变化事件。
- `evaluation/test-plan.md` — comparison and failure tests.

## Current stage

双语交互原型、模拟材料、参考影响图和评测计划已经完成。平台现已支持一条可运行的闭环：

1. 查看项目数据源；
2. 连接 OpenAI-compatible 模型并分析新材料；
3. 生成带来源的候选影响路径；
4. 人工维持、修改、否决或要求补证据；
5. “需要更多证据”保持为未完成事项；
6. 人工修改写回当前设计意图；
7. 全部判断保存在 Cloudflare D1 并可导出为结构化项目语境。

已使用 qwen-vl-max 完成五组真实模型评测，覆盖正确影响、无关信息、模糊表达、图文理解和人工否决记忆。原始失败、无效运行、修复过程与复测结果均保存在 `evaluation/results.md`；预置案例关系只作为裁判基准，不作为模型准确性证据。

## 如何打开 / How to run

- 双击项目根目录的 `启动平台.bat`。
- 浏览器打开 `http://localhost:3000/`。
- 在左下角填写兼容 OpenAI API 的接口地址、模型名称和密钥，点击“连接并识别模型”。本地 Ollama 常用地址是 `http://localhost:11434/v1`。
- 项目材料与人工判断保存在 Cloudflare D1。API 密钥只在当前页面内存中使用，不写入项目文件。
