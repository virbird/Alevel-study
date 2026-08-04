// 冒烟测试：ErrorLogService 规则引擎（用假 vault 隔离 obsidian 依赖）
import { ErrorLogService } from '../src/services/ErrorLogService';
import type { VaultService } from '../src/services/VaultService';
import { parseSessionMessages } from '../src/ui/MainView';

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

  console.log(failed === 0 ? '\n全部通过 ✔' : `\n${failed} 项失败 ✘`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
