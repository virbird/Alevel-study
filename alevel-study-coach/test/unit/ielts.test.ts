// UT：IeltsService（解析/笔记/趋势）与 ExpressionService（去重/调度/升降档）
import { section, check, eq, FakeVault } from '../harness';
import { IeltsService, parseIeltsResult, ESSAY_DIR, EXPR_LIB_PATH } from '../../src/services/IeltsService';
import { ExpressionService, INTERVALS } from '../../src/services/ExpressionService';
import { todayStr, addDays } from '../../src/utils/date';

const REPLY_OK = [
  '【1. 总分与分项评分】预测总分 6.5 ……',
  '【2. 逐段精批】……',
  '```json',
  '{"ieltsResult": {"task": 2, "overall": 6.5, "tr": 6.5, "cc": 6.0, "lr": 6.5, "gra": 6.0,',
  '  "expressions": [',
  '    {"expr": "a growing body of evidence", "type": "高分短语", "note": "引出证据"},',
  '    {"expr": "It is widely acknowledged that", "type": "高分句型", "note": "普遍观点开头"}',
  '  ]}}',
  '```',
].join('\n');

const EXPR_LIB_HEADER = '# 表达积累库\n\n| 表达 | 类型 | 来源 | 日期 | 间隔 | 下次 | 状态 |\n|------|------|------|------|------|------|------|\n';

export async function run(): Promise<void> {
  section('UT: parseIeltsResult');
  const ok = parseIeltsResult(REPLY_OK);
  eq('分数解析', ok.scores, { overall: 6.5, tr: 6.5, cc: 6.0, lr: 6.5, gra: 6.0 });
  eq('表达解析（2 条）', ok.expressions.map(e => e.expr), ['a growing body of evidence', 'It is widely acknowledged that']);
  check('正文剥离 JSON 块', !ok.reply.includes('ieltsResult') && ok.reply.includes('总分与分项评分'));
  const broken = parseIeltsResult('【1. 总分与分项评分】6.0……\n```json\n{坏的 JSON\n```');
  check('JSON 损坏：分数留空但正文保留', broken.scores.overall === null && broken.reply.includes('总分与分项评分'));
  const noJson = parseIeltsResult('只有正文没有 JSON');
  check('无 JSON：全文即正文', noJson.reply === '只有正文没有 JSON' && noJson.expressions.length === 0);

  section('UT: IeltsService 笔记与趋势');
  const v = new FakeVault();
  const svc = new IeltsService(v.asService());
  const path = await svc.createEssayNote(2, '教育类: Agree?');
  check('文件名清洗特殊字符', path.includes('task2') && !path.includes('?'));
  const note = v.files[path];
  check('模板含三小节骨架', note.includes('## 原文') && note.includes('## AI 批改') && note.includes('## 高分表达'));
  eq('原文提取（未粘贴时为空）', svc.extractEssay(note), '');
  const withEssay = note.replace('（在这里粘贴作文全文）', 'Some people believe that university education should be free for everyone. I partially agree with this view for the following reasons, which I will elaborate in this essay.');
  v.files[path] = withEssay;
  check('原文提取成功', svc.extractEssay(withEssay).startsWith('Some people believe'));
  eq('未批改时分数为空', (await svc.loadScores())[0].overall, null);
  // 手工写入分数模拟批改后
  v.files[path] = withEssay.replace('overall: ""', 'overall: 6.5').replace('lr: ""', 'lr: 5.5');
  const scores = await svc.loadScores();
  eq('趋势读取分数', [scores[0].overall, scores[0].lr], [6.5, 5.5]);
  eq('短板维度识别', svc.weakestDimension(scores[0]), 'LR');

  section('UT: ExpressionService 调度');
  const v2 = new FakeVault({ seed: { [EXPR_LIB_PATH]: EXPR_LIB_HEADER } });
  const es = new ExpressionService(v2.asService());
  const added = await es.appendAll([
    { expr: 'a growing body of evidence', type: '高分短语', note: '' },
    { expr: 'A Growing Body Of Evidence', type: '高分短语', note: '' }, // 大小写重复
    { expr: 'It is widely acknowledged that', type: '高分句型', note: '' },
  ], '2026-08-04-task2-教育类');
  eq('去重后入库 2 条', added, 2);
  eq('新表达间隔档 0、明天到期', (await es.load())[0].next, addDays(todayStr(), INTERVALS[0]));
  eq('新表达不在今日到期队列', (await es.due()).length, 0);
  // 手工制造一条今日到期（append 语义保证尾换行，直接拼接安全）
  await v2.append(EXPR_LIB_PATH, `| play a pivotal role | 高分短语 | 手工 | ${todayStr()} | 1 | ${todayStr()} | 学习中 |`);
  eq('到期表达入队', (await es.due()).map(r => r.expr), ['play a pivotal role']);
  // 通过 → 升档（1→2 档，下次 +7 天）
  const passed = await es.applyResult('play a pivotal role', true);
  eq('通过升档', passed?.interval, 2);
  eq('通过后下次 +7 天', passed?.next, addDays(todayStr(), INTERVALS[2]));
  // 不过 → 重置 1 天
  const failed = await es.applyResult('play a pivotal role', false);
  eq('不过重置到 1 天', [failed?.interval, failed?.next], [0, addDays(todayStr(), 1)]);
  // 封顶再通过 → 已掌握（[^\n] 限定单行，避免正则跨行吞行）
  v2.files[EXPR_LIB_PATH] = v2.files[EXPR_LIB_PATH].replace(/\| play a pivotal role \|[^\n]*/, `| play a pivotal role | 高分短语 | 手工 | ${todayStr()} | 5 | ${addDays(todayStr(), 60)} | 学习中 |`);
  const mastered = await es.applyResult('play a pivotal role', true);
  eq('间隔到顶再通过 → 已掌握', [mastered?.interval, mastered?.status], [5, '已掌握']);
  check('已掌握不再到期', (await es.due()).length === 0);
  check('不存在的表达返回 null', await es.applyResult('不存在', true) === null);
  check('抽查提示词含到期表达', es.buildDrillPrompt([{ expr: 'x', type: '高分词汇', source: '', date: '', interval: 0, next: '', status: '学习中' }]).includes('x'));
  void ESSAY_DIR;
}
