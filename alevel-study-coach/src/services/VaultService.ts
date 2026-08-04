import { App, Notice, TFile, TFolder } from 'obsidian';

export const ROOT = 'StudyCoach';

/** 插件模板资源（templates/ 目录在构建时拷入插件文件夹） */
const PROMPT_FILES = [
  'prompt-maths.md',
  'prompt-physics.md',
  'prompt-chemistry.md',
  'prompt-cs.md',
  'prompt-economics.md',
  'prompt-drill.md',
  'ielts-writing.md',
];

export const PROFILE_TEMPLATE = `---
stage: "G10"
ielts_target: 7.5
ielts_focus: "Writing"
oxbridge_enabled: true
oxbridge_direction: "待定"
independent_minutes: 15
subjects:
  Maths: "IG+AS / AS主导 / 目标A*"
  Physics: "IG+AS / IG主导 / 目标A*"
  CS: "IG+AS / IG主导 / 目标A* / Python"
  Chemistry: "IG / 纯 IG / 目标A*"
  Economics: "IG / 纯 IG / 目标A*"
---

# 学习档案

> 上面的 frontmatter 会被插件读取并注入教练 prompt，可在插件设置页编辑。
> 「待确认事项」确认一项删一项，确认后请同步更新 subjects 字段。

## 待确认事项（来自提示词体系 README）

- [ ] Further Maths 从哪一年开始上（影响 STEP 启动时间）
- [ ] 物理 AS 部分是否已在 G10 开设（影响一题两解）
- [ ] 数学 / 工程 / 计算机方向（G11 结束前决定即可）
- [ ] CS 是 0478 还是已进入 AS 9618，编程语言确认
- [ ] 化学与经济从 G11 起是否开设 AS
- [ ] A-Level 最终保留哪几门
`;

const ERROR_LOG_HEADER = `# Error Log（失分记录本）

> 一个失分点一行，不要合并。复发不新增行：复发 +1、状态改回「未消除」、复查日期顺延。
> 状态：未消除 → 观察中（复查一次通过）→ 已消除（连续两次未再犯）。
> 复查日期：默认 7 天后；复发过的条目 3 天。AI 结题生成的 log 行由插件解析后一键入库。

## 失分类型代码表

### 基础码（全科通用）

| 代码 | 类型 | 含义 |
|----|----|----|
| M | 过程分缺失 | 结论对但没写关键式子/步骤 |
| A | 精度 | 有效数字、exact form、四舍五入时机 |
| U | 单位 | 单位缺失、错误、换算失误 |
| S | 符号与取舍 | 正负号、多解未筛 |
| D | 定义域与边界 | 适用条件、区间开闭、边界漏讨论 |
| P | 证明不严谨 | 倒推、跳步、分类不完备 |
| H | hence 未沿用 | 未使用上一小题结论或指定方法 |
| G | 图像与作图 | 轴、截距、渐近线、曲线方向 |
| T | 英文术语不精确 | 定义未逐字准确、术语误用 |
| E | 英文表述 | 中式表述、因果链断裂、连接词误用 |
| C | 代数计算错 | 化简、展开、移项、通分出错 |
| R | 读题遗漏 | 漏条件、误解题意、答非所问 |
| K | 知识点不会 | 该考点本身没掌握 |
| X | 方法低效 | 会做但绕远路 |
| Z | 放弃太早 | 未到时间门槛就求助 |
| DV | 定义漏成分 | 概念解释漏掉必要成分（重点码，单独统计） |
| CL | 口语化表达 | 用日常词代替学科术语（重点码，单独统计） |
| LK | 逻辑链断层 | 推导跳步，步与步之间缺连接理由（重点码，单独统计） |

### 学科扩展码

| 科目 | 代码 |
|----|----|
| CS | L 逻辑错 / V 变量问题 / N 伪代码规范 / B 测试不完整 / Q 要点不足 / O 效率扩展性 |
| Chem | F 方程式 / W 条件缺失 / J 现象结论混淆 / Y 摩尔计算链 / I 机理与电子 |
| Econ | CR 因果链断层 / EV evaluation 不足 / DG 图示问题 / CX 未情境化 / DF 定义缺失 / CF 概念混淆 |

## 主表

| ID | 日期 | 科目 | 层级 | 考点(EN) | 题型 | 代码 | 一句话描述 | 正确做法 | 英文标准表述 | 复发 | 状态 | 复查日期 |
|----|------|------|------|---------|------|------|-----------|---------|-------------|------|------|---------|
`;

const TERM_LIST_TEMPLATE = `# 术语清单

> 教材原文必须自己抄（AI 没有课本，不能代填）。
> 状态：未稳定 → 观察中（抽查通过一次）→ 已稳定（连续两次抽查完整无口语词）。
> 本清单是每周模式 E 随机抽查的题源。

| Term (EN) | 科目 | 教材原文定义 | 必要成分拆解 | 我漏掉过的成分 | 我用错的口语词 | 状态 |
|-----------|------|-------------|-------------|--------------|--------------|------|
`;

const QUESTION_LOG_TEMPLATE = `# 提问记录

> 每次教练会话结束时由插件自动追加（行为日志，零操作成本）。
> 困惑类型：概念不懂 / 会但不熟 / 卡在某步 / 术语表达 / 作文批改 / 其他。

| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |
|------|------|---------|---------|---------|
`;

const ROADMAP_TEMPLATE = `# 三年路线图（参考文档）

> 这是建议生成时的背景约束，不是日常执行计划。按学期更新即可。

| 阶段 | 课内 | 进阶训练 | 独立卡住门槛 |
|---|---|---|---|
| G10 上 | IG 主导，AS 起步 | 证明意识 + 代数熟练度；UKMT SMC / BMO1 风格题 | 15 分钟 |
| G10 下 | AS 主导 | TMUA / MAT 入门题可以开始碰 | 20 分钟 |
| G11 | A2 + Further | MAT / TMUA 正式训练，STEP 起步 | 25–30 分钟 |
| G12 | Further A2 收尾 | STEP 2&3 冲刺 / PAT / ESAT + 申请 | 45 分钟 |

**守门规则**：G10 不要碰 STEP 真题（需要 A2 + Further 完整工具箱）。
各校进阶考试要求每年可能调整，正式报考前请核对官方招生页。
`;

const JOURNAL_TEMPLATE = `# 学习日志

> 随手记里无法归入进展/失分/术语的条目落在这里，按时间追加。
`;

const WEAK_IMPRESSIONS_TEMPLATE = `# 弱点印象

> 冷启动/随手记里的模糊自述（如「力学比较弱」），没有具体考点，不进 error log 主表、不进复查队列。
> 它们是待验证的先验：后续具体错题会给它们积累证据（Phase 2 自动关联）。
> 状态：待验证 → 已确认（证据足够）/ 已作废（长期无证据或学生否认）。

| 日期 | 科目 | 描述 | 证据数 | 状态 |
|------|------|------|--------|------|
`;

const PRACTICE_FOCUS_TEMPLATE = `# 练习侧重

> 题型/作答习惯层面的倾向（如「实验题成功率不高」「问答题容易口语化」）。
> 不进 error log 主表、不进复查队列——无法用变式题判定消除，靠长期作答质量观察缓解。
> 它们会注入教练 prompt：遇到对应题型时，教练会加强相应的审查与训练侧重。
> 状态：生效中 → 已缓解（连续多次作答未见该倾向后可手动改）。

| 日期 | 科目 | 描述 | 状态 |
|------|------|------|------|
`;

const STATS_TEMPLATE = `# 统计分析

> 由插件自动维护：提问热点（每周）与复发热点（每两周）统计、本期专项。
> 本期专项会注入教练 prompt；手动编辑下方区块同样生效。
`;

const EXPR_LIB_TEMPLATE = `# 表达积累库

> 雅思作文批改后自动提取的高分表达（也可手动添加）。
> 间隔调度（SM-2 简化）：1 → 3 → 7 → 14 → 30 → 60 天，到期用造句抽查验证，通过升档，不过重置。
> 间隔档位到顶且再次通过 → 已掌握。与学科 DV/CL 训练同根：练表达就是练雅思 LR/GRA。

| 表达 | 类型 | 来源 | 日期 | 间隔 | 下次 | 状态 |
|------|------|------|------|------|------|------|
`;

/**
 * 负责 StudyCoach/ 目录的创建与种子文件生成。
 * 所有数据文件一旦存在就不会覆盖——用户可自由手改。
 */
export class VaultService {
  constructor(private app: App, private pluginDir: string) {}

  /** 文件适配器（供需要列目录的服务使用） */
  get adapter() {
    return this.app.vault.adapter;
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) return;
    await this.app.vault.createFolder(path);
  }

  private async ensureFile(path: string, content: string): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(path)) return;
    await this.app.vault.create(path, content);
  }

  /** 首次使用时初始化 vault 结构 */
  async init(): Promise<void> {
    try {
      await this.ensureFolder(ROOT);
      await this.ensureFolder(`${ROOT}/记录`);
      await this.ensureFolder(`${ROOT}/记录/进展`);
      await this.ensureFolder(`${ROOT}/雅思`);
      await this.ensureFolder(`${ROOT}/雅思/作文`);
      await this.ensureFolder(`${ROOT}/建议`);
      await this.ensureFolder(`${ROOT}/会话`);
      await this.ensureFolder(`${ROOT}/prompts`);

      await this.ensureFile(`${ROOT}/档案.md`, PROFILE_TEMPLATE);
      await this.ensureFile(`${ROOT}/三年路线图.md`, ROADMAP_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/error-log.md`, ERROR_LOG_HEADER);
      await this.ensureFile(`${ROOT}/记录/术语清单.md`, TERM_LIST_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/提问记录.md`, QUESTION_LOG_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/学习日志.md`, JOURNAL_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/弱点印象.md`, WEAK_IMPRESSIONS_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/练习侧重.md`, PRACTICE_FOCUS_TEMPLATE);
      await this.ensureFile(`${ROOT}/记录/统计分析.md`, STATS_TEMPLATE);
      await this.ensureFile(`${ROOT}/雅思/表达积累库.md`, EXPR_LIB_TEMPLATE);

      await this.seedPrompts();
    } catch (e) {
      new Notice(`StudyCoach 初始化失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** 从插件 templates/ 目录拷贝提示词模板到 vault prompts/（已存在则跳过） */
  private async seedPrompts(): Promise<void> {
    const adapter = this.app.vault.adapter;
    for (const name of PROMPT_FILES) {
      const dest = `${ROOT}/prompts/${name}`;
      if (this.app.vault.getAbstractFileByPath(dest)) continue;
      const src = `${this.pluginDir}/templates/${name}`;
      try {
        if (await adapter.exists(src)) {
          const content = await adapter.read(src);
          await this.app.vault.create(dest, content);
        }
      } catch {
        // 单个模板失败不阻塞其他
      }
    }
  }

  async read(path: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    return this.app.vault.cachedRead(file);
  }

  async write(path: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }
  }

  async append(path: string, content: string): Promise<void> {
    const existing = await this.read(path);
    const base = existing ?? '';
    // 统一换行语义：始终保证行间分隔与文件尾换行，避免行粘连（编辑器/同步工具友好）
    const sep = base === '' || base.endsWith('\n') ? '' : '\n';
    const suffix = content.endsWith('\n') ? '' : '\n';
    await this.write(path, base + sep + content + suffix);
  }

  /** 检测同步冲突标记，提示用户而不是覆盖 */
  async hasConflict(path: string): Promise<boolean> {
    const content = await this.read(path);
    return content !== null && content.includes('<<<<<<<');
  }
}
