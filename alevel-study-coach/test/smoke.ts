// 冒烟测试：ErrorLogService 规则引擎（用假 vault 隔离 obsidian 依赖）
import { ErrorLogService } from '../src/services/ErrorLogService';
import type { VaultService } from '../src/services/VaultService';
import { parseSessionMessages } from '../src/ui/MainView';
import { WeakImpressionService, PracticeFocusService, QUESTION_LOG_PATH, TERM_LIST_PATH } from '../src/services/QuestionLogService';
import { InsightEngine } from '../src/services/InsightEngine';
import { StatsService } from '../src/services/StatsService';
import { TermListService } from '../src/services/TermService';
import { todayStr } from '../src/utils/date';
import type { ErrorLogEntry } from '../src/types';

const SEED = `# Error Log

## 主表

| ID | 日期 | 科目 | 层级 | 考点(EN) | 题型 | 代码 | 一句话描述 | 正确做法 | 英文标准表述 | 复发 | 状态 | 复查日期 |
|----|------|------|------|---------|------|------|-----------|---------|-------------|------|------|---------|
| 001 | 2026-07-25 | Maths | AS | Quadratic inequalities | 解不等式 | D | 临界点未检验开闭 | 代回原式 | for all x such that | 1 | 未消除 | 2026-08-01 |
| 002 | 2026-08-01 | Physics | AS | Work done | 定义题 | CL | 口语化表达 | 用 a force acts on | the force acts | 1 | 观察中 | 2026-09-01 |
`;

const files: Record<string, string> = { 'StudyCoach/记录/error-log.md': SEED };
const fakeVault = {
  read: async (p: string) => files[p] ?? null,
  write: async (p: string, c: string) => { files[p] = c; },
  append: async (p: string, c: string) => {
    const existing = files[p];
    files[p] = existing === undefined ? c : existing.endsWith('\n') ? existing + c : existing + '\n' + c;
  },
  hasConflict: async () => false,
} as unknown as VaultService;

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

async function main(): Promise<void> {
  const svc = new ErrorLogService(fakeVault);

  // 1. 解析现有条目
  const entries = await svc.load();
  check('解析主表得到 2 条', entries.length === 2);
  check('字段映射正确', entries[0].topic === 'Quadratic inequalities' && entries[0].code === 'D' && entries[0].recurrence === 1);

  // 2. 到期队列：001 复查 2026-08-01 已到期，002 未到期
  const due = await svc.dueEntries();
  check('到期队列只含 001', due.length === 1 && due[0].id === '001');

  // 3. 新条目入库：自动 ID=003、复查默认 7 天后
  const added = await svc.addEntry({ subject: 'Econ', topic: 'Opportunity cost', code: 'DV', desc: '漏 next best' });
  check('新条目 ID 递增', added?.entry.id === '003');
  check('新条目复查日期 = 今天+7', !!added && added.entry.reviewDate > new Date().toISOString().slice(0, 10));

  // 4. 复发：同 考点+代码+科目 不新增行
  const again = await svc.addEntry({ subject: 'Econ', topic: 'Opportunity cost', code: 'DV', desc: '又漏了' });
  const after = await svc.load();
  check('复发不新增行', after.length === 3);
  check('复发次数 +1', again?.entry.recurrence === 2);
  check('复发状态回到未消除', again?.entry.status === '未消除');

  // 5. AI 行解析（含 ??? 占位符与 12 列漏复发列两种形态）
  const aiText = [
    '知识卡片略……',
    '| ??? | ??? | Maths | AS | Circle theorems | 几何证明 | P | 未引用定理 | 注明定理名 | Angles in same segment | 1 | 未消除 | ??? |',
    '| ??? | ??? | Chem | IG | Reactivity series | 置换 | F | 未配平 | 逐元素数 | balanced equation | 未消除 | 2026-08-11 |',
  ].join('\n');
  const rows = svc.parseAiRows(aiText);
  check('AI 行解析出 2 行', rows.length === 2);
  check('12 列行自动补复发列', rows[1].recurrence === 1 && rows[1].status === '未消除');

  // 6. 重建表格后其他内容保持
  const final = files['StudyCoach/记录/error-log.md'];
  check('表头仍在', final.includes('| ID | 日期 | 科目 |'));
  check('标题仍在', final.startsWith('# Error Log'));

  // 7. 会话存档解析（含 frontmatter 与增量追加形态）
  const sessionFile = [
    '---',
    'mode: Maths',
    'started: "2026-08-04 150000"',
    '---',
    '',
    '# 教练会话 2026-08-04 · 数学 Maths',
    '',
    '## 学生',
    '',
    '这道不等式怎么做？',
    '',
    '## 教练',
    '',
    '先移项。',
    '',
    '## 学生',
    '',
    '做出来了。',
    '',
  ].join('\n');
  const msgs = parseSessionMessages(sessionFile);
  check('会话解析出 3 条消息', msgs.length === 3);
  check('会话角色与内容正确', msgs[0].role === 'user' && msgs[1].role === 'assistant' && msgs[2].content === '做出来了。');

  // 8. 弱点印象：模糊自述不进主表，独立存储与注入
  files['StudyCoach/记录/弱点印象.md'] = [
    '# 弱点印象', '',
    '| 日期 | 科目 | 描述 | 证据数 | 状态 |',
    '|------|------|------|--------|------|',
  ].join('\n') + '\n';
  const wis = new WeakImpressionService(fakeVault);
  await wis.append('Physics', '力学整体偏弱');
  await wis.append('Econ', '宏观部分感觉模糊');
  const loaded = await wis.load();
  check('弱点印象追加并可解析', loaded.length === 2 && loaded[0].desc === '力学整体偏弱' && loaded[0].status === '待验证');
  const pending = await wis.pendingForInjection();
  check('无科目参数时全量注入（精练/雅思模式）', pending.length === 2);
  const pendingPhy = await wis.pendingForInjection('Physics');
  check('按科目过滤：Physics 会话只注入物理印象', pendingPhy.length === 1 && pendingPhy[0].subject === 'Physics');
  check('弱点印象未进入主表', (await svc.load()).every(e => !e.desc.includes('力学整体')));
  
  // 9. 练习侧重：题型/习惯倾向独立存储与注入
  files['StudyCoach/记录/练习侧重.md'] = [
    '# 练习侧重', '',
    '| 日期 | 科目 | 描述 | 状态 |',
    '|------|------|------|------|',
  ].join('\n') + '\n';
  const pfs = new PracticeFocusService(fakeVault);
  await pfs.append('Econ', '问答题习惯用日常词替代术语，导致丢失分点');
  await pfs.append('Physics', '实验题目成功率不高');
  await pfs.append('通用', '解释题习惯省略因果连接词');
  const loadedFocus = await pfs.load();
  check('练习侧重追加并可解析', loadedFocus.length === 3 && loadedFocus[0].status === '生效中');
  const active = await pfs.activeForInjection();
  check('无科目参数时全量注入', active.length === 3);
  const activePhy = await pfs.activeForInjection('Physics');
  check('按科目过滤：Physics 注入物理 + 通用，不含 Econ', activePhy.length === 2 && activePhy.every(f => f.subject === 'Physics' || f.subject === '通用'));
  const activeEcon = await pfs.activeForInjection('Econ');
  check('按科目过滤：Econ 注入 Econ + 通用', activeEcon.length === 2);
  check('练习侧重未进入主表', (await svc.load()).every(e => !e.desc.includes('日常词替代')));

  // 10. InsightEngine：提问热点聚合与候选生成（阈值）
  const today = todayStr();
  files[QUESTION_LOG_PATH] = [
    '# 提问记录', '',
    '| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |',
    '|------|------|---------|---------|---------|',
    `| ${today} | Physics | Moments | 卡在某步 | 需要完整引导 |`,
    `| ${today} | Physics | Moments | 概念不懂 | 需要完整引导 |`,
    `| ${today} | Physics | Moments | 卡在某步 | 问一句就懂 |`,
    `| ${today} | Maths | Quadratic inequalities | 会但不熟 | 问一句就懂 |`,
  ].join('\n') + '\n';
  const engine = new InsightEngine(fakeVault);
  const heat = await engine.topicHeat(14);
  check('提问热点聚合：Moments ×3 排首位', heat.length > 0 && heat[0].topic === 'Moments' && heat[0].count === 3);

  const candHeat = await engine.generateCandidates([], []);
  check('提问热点 ≥3 次生成候选', candHeat.some(c => c.kind === '提问热点' && c.title.includes('Moments')));

  const recEntry: ErrorLogEntry = {
    id: '099', date: today, subject: 'Maths', level: 'AS', topic: 'Circle theorems', qtype: '几何证明',
    code: 'P', desc: '未引用定理', fix: '', stdExpr: '', recurrence: 3, status: '未消除', reviewDate: today,
  };
  const candRec = await engine.generateCandidates([recEntry], []);
  check('复发 ≥3 次生成候选', candRec.some(c => c.kind === '复发热点'));
  const candFew = await engine.generateCandidates([{ ...recEntry, recurrence: 1 }], []);
  check('样本不足不出复发候选（宁可不说）', !candFew.some(c => c.kind === '复发热点'));

  // 11. StatsService：区块更新与本期专项
  files['StudyCoach/记录/统计分析.md'] = '# 统计分析\n';
  const stats = new StatsService(fakeVault, engine);
  await stats.runQuestionWeekly();
  await stats.runHotspotBiweekly([{ ...recEntry, recurrence: 1 }]);
  const statsContent = files['StudyCoach/记录/统计分析.md'];
  check('统计分析写入提问热点与复发热点区块', statsContent.includes('## 提问热点') && statsContent.includes('## 复发热点'));
  const focus = await stats.currentFocus();
  check('本期专项可读取', focus.includes('自') && focus.length > 10);

  // 12. TermService：模式 E 状态流转
  files[TERM_LIST_PATH] = [
    '# 术语清单', '',
    '| Term (EN) | 科目 | 教材原文定义 | 必要成分拆解 | 我漏掉过的成分 | 我用错的口语词 | 状态 |',
    '|-----------|------|-------------|-------------|--------------|--------------|------|',
    '| Opportunity cost | Econ | （拄课本原文） | ①next best ②forgone | 漏 next best | / | 未稳定 |',
    '| Work done | Physics | （拄课本原文） | ①force ②distance ③方向 | 漏③ | / | 观察中 |',
  ].join('\n') + '\n';
  const tls = new TermListService(fakeVault);
  check('抽查题源不含已稳定', (await tls.drillPool()).length === 2);
  check('未稳定通过一次 → 观察中', await tls.applyDrillResult('Opportunity cost', true) === '观察中');
  check('观察中再通过 → 已稳定', await tls.applyDrillResult('Opportunity cost', true) === '已稳定');
  check('已稳定回抽不过 → 未稳定', await tls.applyDrillResult('Opportunity cost', false) === '未稳定');
  check('观察中不过 → 未稳定', await tls.applyDrillResult('Work done', false) === '未稳定');

  console.log(failed === 0 ? '\n全部通过 ✔' : `\n${failed} 项失败 ✘`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
