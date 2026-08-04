// FVT-3：雅思批改闭环（新建笔记 → 粘贴 → 批改回填 → 分数入库 → 表达进积累库 → 趋势可见）
import { section, check, eq, FakeVault } from '../harness';
import { IeltsService, EXPR_LIB_PATH, ESSAY_DIR } from '../../src/services/IeltsService';
import { ExpressionService } from '../../src/services/ExpressionService';
import { todayStr, addDays } from '../../src/utils/date';
import type { LlmClient } from '../../src/llm/LlmClient';

const GRADE_REPLY = [
  '【1. 总分与分项评分】',
  '- 预测总分：6.5',
  '- Task Response: 6.5 …',
  '【2. 逐段精批】……',
  '【5. 可直接背诵的高分表达】……',
  '```json',
  '{"ieltsResult": {"task": 2, "overall": 6.5, "tr": 7.0, "cc": 6.0, "lr": 6.5, "gra": 6.5,',
  '  "expressions": [',
  '    {"expr": "merit careful consideration", "type": "高分短语", "note": "值得仔细考虑"},',
  '    {"expr": "stem from", "type": "高分词汇", "note": "源于"}',
  '  ]}}',
  '```',
].join('\n');

function fakeLlm(reply: string): LlmClient {
  return { chat: async () => reply, configured: true } as unknown as LlmClient;
}

const ESSAY = 'Some people believe that university education should be free for everyone, while others argue that students should pay for their higher education. In my opinion, a balanced approach combining public funding and individual contribution would be the most sustainable solution for society as a whole.';

export async function run(): Promise<void> {
  section('FVT: 雅思批改闭环');
  const v = new FakeVault({ seed: {
    'StudyCoach/prompts/ielts-writing.md': '你是一位资深雅思写作考官……（ys.md 模板）',
    [EXPR_LIB_PATH]: '# 表达积累库\n\n| 表达 | 类型 | 来源 | 日期 | 间隔 | 下次 | 状态 |\n|------|------|------|------|------|------|------|\n',
  } });
  const vs = v.asService();
  const ielts = new IeltsService(vs);
  const exprs = new ExpressionService(vs);

  // 1. 新建笔记并粘贴作文
  const path = await ielts.createEssayNote(2, '教育类讨论');
  check('笔记创建于 雅思/作文/', path.startsWith(ESSAY_DIR));
  v.files[path] = v.files[path].replace('（在这里粘贴作文全文）', ESSAY);

  // 2. 空原文保护
  const emptyPath = await ielts.createEssayNote(1, '图表');
  let threw = false;
  try { await ielts.gradeEssay(emptyPath, fakeLlm(GRADE_REPLY)); } catch { threw = true; }
  check('未粘贴作文时批改被拦截', threw);

  // 3. 批改：六段回填 + 分数入库 + 表达进库
  const result = await ielts.gradeEssay(path, fakeLlm(GRADE_REPLY));
  eq('分数解析（总分 6.5）', result.scores.overall, 6.5);
  const note = v.files[path];
  check('AI 批改小节已回填', note.includes('预测总分：6.5'));
  check('JSON 块未混入笔记正文', !note.includes('ieltsResult'));
  check('高分表达小节回填', note.includes('merit careful consideration'));
  const scores = await ielts.loadScores();
  eq('分数进 frontmatter（趋势可读）', [scores[0].overall, scores[0].cc], [6.5, 6.0]);
  const added = await exprs.appendAll(result.expressions, '教育类讨论');
  eq('表达进积累库 2 条', added, 2);
  eq('表达初始明天到期', (await exprs.load())[0].next, addDays(todayStr(), 1));

  // 4. 第二篇作文（更低分）→ 趋势排序与短板（此时共 3 篇笔记：教育/图表/环境）
  const path2 = await ielts.createEssayNote(2, '环境类');
  v.files[path2] = v.files[path2].replace('（在这里粘贴作文全文）', ESSAY);
  const reply2 = GRADE_REPLY.replace('"overall": 6.5', '"overall": 6.0').replace('"cc": 6.0', '"cc": 5.5');
  await ielts.gradeEssay(path2, fakeLlm(reply2));
  const trend = await ielts.loadScores();
  eq('全部笔记计入趋势', trend.length, 3);
  const env = trend.find(s => s.title.includes('环境类'))!;
  eq('低分篇分数入库', [env.overall, env.cc], [6.0, 5.5]);
  eq('短板维度为 CC', ielts.weakestDimension(env), 'CC');

  // 5. 表达去重：批改第三次不重复入库
  const path3 = await ielts.createEssayNote(2, '科技类');
  v.files[path3] = v.files[path3].replace('（在这里粘贴作文全文）', ESSAY);
  const r3 = await ielts.gradeEssay(path3, fakeLlm(GRADE_REPLY));
  eq('重复表达不再入库', await exprs.appendAll(r3.expressions, '科技类'), 0);
  eq('积累库仍为 2 条', (await exprs.load()).length, 2);
}
