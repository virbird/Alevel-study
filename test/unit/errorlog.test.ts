// UT：ErrorLogService 规则引擎
import { section, check, eq, FakeVault } from '../harness';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { addDays, todayStr } from '../../src/utils/date';

const LOG_HEADER = `# Error Log

## 主表

| ID | 日期 | 科目 | 层级 | 考点(EN) | 题型 | 代码 | 一句话描述 | 正确做法 | 英文标准表述 | 复发 | 状态 | 复查日期 |
|----|------|------|------|---------|------|------|-----------|---------|-------------|------|------|---------|
`;

export function seedLog(rows: string[]): string {
  return LOG_HEADER + rows.join('\n') + '\n';
}

export async function run(): Promise<void> {
  section('UT: ErrorLogService 解析');
  const past = addDays(todayStr(), -10);
  const future = addDays(todayStr(), 10);
  const v1 = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([
    `| 001 | ${past} | Maths | AS | Quadratic inequalities | 解不等式 | D | 临界点未检验 | 代回原式 | expr | 1 | 未消除 | ${past} |`,
    `| 002 | ${past} | Physics | AS | Work done | 定义题 | CL | 口语化 | 用术语 | expr | 1 | 观察中 | ${future} |`,
  ]) } });
  const svc = new ErrorLogService(v1.asService());
  const entries = await svc.load();
  eq('解析主表条数', entries.length, 2);
  eq('字段映射', [entries[0].topic, entries[0].code, entries[0].recurrence, entries[0].status], ['Quadratic inequalities', 'D', 1, '未消除']);
  const due = await svc.dueEntries();
  eq('到期队列只含已过期条目', due.map(e => e.id), ['001']);
  eq('未消除过滤', (await svc.unresolved()).map(e => e.id), ['001']);

  section('UT: ErrorLogService 入库与复发');
  const added = await svc.addEntry({ subject: 'Econ', topic: 'Opportunity cost', code: 'DV', desc: '漏 next best' });
  eq('新条目 ID 递增', added?.entry.id, '003');
  eq('新条目默认复查 +7 天', added?.entry.reviewDate, addDays(todayStr(), 7));
  const again = await svc.addEntry({ subject: 'Econ', topic: 'opportunity cost', code: 'dv', desc: '又漏了' });
  eq('复发匹配忽略大小写', again?.action, 'recurrence');
  eq('复发次数 +1', again?.entry.recurrence, 2);
  eq('复发不新增行', (await svc.load()).length, 3);
  const third = await svc.addEntry({ subject: 'Econ', topic: 'Opportunity cost', code: 'DV' });
  eq('复发≥2 复查顺延 3 天', third?.entry.reviewDate, addDays(todayStr(), 3));
  check('复发条目仍在原行', (await svc.load()).filter(e => e.topic.toLowerCase() === 'opportunity cost').length === 1);

  section('UT: ErrorLogService AI 行解析');
  const aiText = [
    '知识卡片略……',
    '| ??? | ??? | Maths | AS | Circle theorems | 几何证明 | P | 未引用定理 | 注明定理名 | expr | 1 | 未消除 | ??? |',
    '| ??? | ??? | Chem | IG | Reactivity series | 置换 | F | 未配平 | 逐元素数 | expr | 未消除 | 2099-01-01 |',
    '|----|----|',
    '| ID | 日期 | 科目 | 层级 | 考点(EN) | 题型 | 代码 | 一句话描述 | 正确做法 | 英文标准表述 | 复发 | 状态 | 复查日期 |',
    '| 只有 | 三列 |',
  ].join('\n');
  const rows = svc.parseAiRows(aiText);
  eq('AI 行解析：跳过表头/分隔/短行', rows.length, 2);
  eq('??? 占位符清洗', rows[0].date, todayStr());
  eq('12 列自动补复发列', rows[1].recurrence, 1);

  section('UT: ErrorLogService 更新与冲突保护');
  await svc.updateEntry('001', { status: '观察中', reviewDate: future });
  eq('updateEntry 生效', (await svc.load()).find(e => e.id === '001')?.status, '观察中');
  const vConflict = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([]) }, conflict: true });
  const svc2 = new ErrorLogService(vConflict.asService());
  let threw = false;
  try {
    await svc2.addEntry({ subject: 'Maths', topic: 'X', code: 'K' });
  } catch {
    threw = true;
  }
  check('同步冲突时拒绝写入', threw);
  check('重建表格保留标题与代码表', v1.files['StudyCoach/记录/error-log.md'].startsWith('# Error Log') && v1.files['StudyCoach/记录/error-log.md'].includes('| ID | 日期 | 科目 |'));

  section('UT: ErrorLogService 到期排序（复发×逾期）');
  const v3 = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([
    `| 001 | ${past} | Maths | AS | TopicA | 题 | D | a | | | 1 | 未消除 | ${past} |`,
    `| 002 | ${past} | Maths | AS | TopicB | 题 | D | b | | | 4 | 未消除 | ${addDays(todayStr(), -5)} |`,
  ]) } });
  const svc3 = new ErrorLogService(v3.asService());
  const ordered = await svc3.dueEntries();
  eq('最痛的排最前', ordered.map(e => e.id), ['002', '001']);
}
