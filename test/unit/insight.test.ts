// UT：InsightEngine 阈值 / StatsService 区块 / SuggestionService 状态机 / PromptAssembler 注入
import { section, check, eq, FakeVault } from '../harness';
import { InsightEngine } from '../../src/services/InsightEngine';
import { StatsService } from '../../src/services/StatsService';
import { SuggestionService, SUGGESTION_DIR } from '../../src/services/SuggestionService';
import { PromptAssembler } from '../../src/services/PromptAssembler';
import { ProfileService } from '../../src/services/ProfileService';
import { ProfileL2Service } from '../../src/services/ProfileL2Service';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { ProgressService, WeakImpressionService, PracticeFocusService, QUESTION_LOG_PATH } from '../../src/services/QuestionLogService';
import { seedLog } from './errorlog.test';
import { todayStr, addDays } from '../../src/utils/date';
import type { ErrorLogEntry } from '../../src/types';

function mkEntry(patch: Partial<ErrorLogEntry>): ErrorLogEntry {
  return {
    id: '001', date: todayStr(), subject: 'Maths', level: 'AS', topic: 'Circle theorems',
    qtype: '几何证明', code: 'P', desc: '未引用定理', fix: '注明定理', stdExpr: '',
    recurrence: 1, status: '未消除', reviewDate: addDays(todayStr(), 7), ...patch,
  };
}

export async function run(): Promise<void> {
  section('UT: InsightEngine 统计与阈值');
  const v1 = new FakeVault({ seed: { [QUESTION_LOG_PATH]: [
    '# 提问记录', '',
    '| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |',
    '|------|------|---------|---------|---------|',
    `| ${todayStr()} | Physics | Moments | 卡在某步 | 需要完整引导 |`,
    `| ${todayStr()} | Physics | Moments | 概念不懂 | 需要完整引导 |`,
    `| ${todayStr()} | Physics | Moments | 卡在某步 | 问一句就懂 |`,
    `| ${addDays(todayStr(), -30)} | Physics | Old topic | 概念不懂 | 问一句就懂 |`,
  ].join('\n') + '\n' } });
  const engine = new InsightEngine(v1.asService());
  const heat = await engine.topicHeat(14);
  eq('热点聚合且窗口外不计', heat.map(h => `${h.topic}×${h.count}`), ['Moments×3']);
  eq('困惑类型去重收集', heat[0].confusions.sort(), ['卡在某步', '概念不懂']);
  const dist = await engine.confusionDist(14);
  eq('困惑分布排序', dist[0], { confusion: '卡在某步', count: 2 });

  const cand1 = await engine.generateCandidates([], []);
  check('提问热点 ≥3 出候选', cand1.some(c => c.kind === '提问热点' && c.title.includes('Moments')));
  const cand2 = await engine.generateCandidates([mkEntry({ recurrence: 3 })], []);
  check('复发 ≥3 出候选', cand2.some(c => c.kind === '复发热点'));
  check('复发 2 次不出候选（阈值）', !(await engine.generateCandidates([mkEntry({ recurrence: 2 })], [])).some(c => c.kind === '复发热点'));
  const exprEntries = ['DV', 'CL', 'LK', 'E', 'E'].map((code, i) => mkEntry({ id: String(i), topic: `T${i}`, code }));
  check('表达码合计 ≥5 出候选', (await engine.generateCandidates(exprEntries, [])).some(c => c.kind === '表达码趋势'));
  check('表达码 4 条不出候选', !(await engine.generateCandidates(exprEntries.slice(0, 4), [])).some(c => c.kind === '表达码趋势'));
  const overdue = Array.from({ length: 12 }, (_, i) => mkEntry({ id: String(i), topic: `T${i}`, reviewDate: addDays(todayStr(), -1) }));
  check('复查堆积 ≥12 出候选', (await engine.generateCandidates(overdue, [])).some(c => c.kind === '复查堆积'));
  const unstableTerms = Array.from({ length: 8 }, (_, i) => ({ term: `term${i}`, subject: '', bookDef: '', parts: '', missed: '', wrongWord: '', status: '未稳定' as const }));
  check('术语未稳定 ≥8 出候选', (await engine.generateCandidates([], unstableTerms)).some(c => c.kind === '术语未稳定'));

  section('UT: InsightEngine 自评校准旗标（Q2 分析）');
  const mkTag = (rating: string, topic = 'Elasticity', date = todayStr()): { date: string; subject: string; topic: string; confusion: string; depth: string; selfRating: string } =>
    ({ date, subject: 'Econ', topic, confusion: '其他', depth: '问一句就懂', selfRating: rating });
  const eOver = [mkEntry({ code: 'E', topic: 'Elasticity' }), mkEntry({ id: '002', code: 'E', topic: 'Elasticity' })];
  const overTags = [mkTag('5'), mkTag('4'), mkTag('4')];
  const fOver = engine.calibrationFlags(overTags, eOver);
  check('自评高+复发→过度自信', fOver.length === 1 && fOver[0].kind === 'over' && fOver[0].code === 'E');
  check('均值与证据日期', fOver[0].avg > 4 && fOver[0].evidence.length === 3 && fOver[0].subject === 'Econ');
  check('均值 <4 不触发', engine.calibrationFlags([mkTag('4'), mkTag('4'), mkTag('3')], eOver).length === 0);
  check('复发仅 1 次不触发', engine.calibrationFlags(overTags, eOver.slice(0, 1)).length === 0);
  check('样本 2 条不触发', engine.calibrationFlags(overTags.slice(0, 2), eOver).length === 0);
  check('考点名大小写不敏感关联', engine.calibrationFlags([mkTag('5', 'elasticity'), mkTag('4', 'ELASTICITY'), mkTag('4')], eOver).length === 1);
  const fUnder = engine.calibrationFlags([mkTag('2', 'Taxation'), mkTag('1', 'Taxation'), mkTag('2', 'Taxation')], [mkEntry({ code: 'X', topic: 'Taxation' })]);
  check('自评低+无复发→低估（仅展示）', fUnder.length === 1 && fUnder[0].kind === 'under');
  check('无效自评（空/越界）忽略', engine.calibrationFlags([mkTag(''), mkTag('9'), mkTag('abc')], eOver).length === 0);

  section('UT: StatsService 区块更新与本期专项');
  const v2 = new FakeVault({ seed: { 'StudyCoach/记录/统计分析.md': '# 统计分析\n\n## 手写区块\n\n学生自己写的内容\n' } });
  const stats = new StatsService(v2.asService(), engine);
  await stats.runQuestionWeekly();
  await stats.runHotspotBiweekly([mkEntry({ code: 'DV' }), mkEntry({ id: '2', topic: 'Other', code: 'DV' }), mkEntry({ id: '3', topic: 'Other', code: 'U' })]);
  const content = v2.files['StudyCoach/记录/统计分析.md'];
  check('写入提问热点区块', content.includes('## 提问热点'));
  check('写入复发热点区块（Top 代码）', content.includes('## 复发热点') && content.includes('DV'));
  check('保留其他区块（学生手改不丢）', content.includes('学生自己写的内容'));
  const focus = await stats.currentFocus();
  check('本期专项针对最高频码 DV', focus.includes('定义') || focus.includes('概念精练'));
  await stats.runQuestionWeekly();
  const content2 = v2.files['StudyCoach/记录/统计分析.md'];
  eq('重复运行不复制区块', content2.split('## 提问热点').length, 2);

  // Q2：周快照加「过度自信码数」列；旧 5 列表宽容迁移
  await stats.appendSnapshot({ unresolved: 3, unstable: 1, openWrongs: 2, dueExprs: 0, overconfident: 1 });
  const snap = v2.files['StudyCoach/记录/统计分析.md'];
  check('新建周快照为六列表', snap.includes('| 日期 | 未消除数 | 未稳定术语数 | 未订正错题数 | 到期表达数 | 过度自信码数 |'));
  check('快照行含过度自信码数', snap.includes(`| ${todayStr()} | 3 | 1 | 2 | 0 | 1 |`));
  const v6 = new FakeVault({ seed: { 'StudyCoach/记录/统计分析.md': '# 统计分析\n\n## 周快照\n\n| 日期 | 未消除数 | 未稳定术语数 | 未订正错题数 | 到期表达数 |\n|---|---|---|---|---|\n| 2026-08-01 | 2 | 1 | 1 | 0 |\n' } });
  const stats6 = new StatsService(v6.asService(), engine);
  await stats6.appendSnapshot({ unresolved: 1, unstable: 0, openWrongs: 0, dueExprs: 0, overconfident: 0 });
  const snap6 = v6.files['StudyCoach/记录/统计分析.md'];
  check('旧表升级六列表头', snap6.includes('过度自信码数'));
  check('旧数据行补 -', snap6.includes('| 2026-08-01 | 2 | 1 | 1 | 0 | - |'));

  section('UT: SuggestionService 状态机');
  const v3 = new FakeVault();
  const sugg = new SuggestionService(v3.asService());
  const candidates = [{ key: '提问热点|Physics|moments', kind: '提问热点', title: 'Physics 的 Moments 求助 3 次', evidence: ['证据一', '证据二'] }];
  eq('首次同步创建卡片', await sugg.syncCandidates(candidates), 1);
  eq('重复同步不重复创建（key 去重）', await sugg.syncCandidates(candidates), 0);
  let all = await sugg.loadAll();
  eq('卡片状态为待处理', all[0].status, '待处理');
  check('卡片正文含证据', all[0].body.includes('证据一'));
  eq('pending 过滤', (await sugg.pending()).length, 1);
  await sugg.setStatus(all[0].file, '不准确', '考点写错了');
  all = await sugg.loadAll();
  eq('标记不准确', all[0].status, '不准确');
  check('反馈写入文件', all[0].body.includes('考点写错了'));
  eq('不准确卡片允许重新生成', await sugg.syncCandidates(candidates), 1);
  const done = await sugg.loadAll();
  const pendingFile = done.find(s => s.status === '待处理');
  await sugg.setStatus(pendingFile!.file, '已处理');
  check('建议目录文件按日期命名', pendingFile!.file.startsWith(`${SUGGESTION_DIR}/${todayStr()}`));

  section('UT: PromptAssembler 注入组装');
  const v4 = new FakeVault({ seed: {
    'StudyCoach/prompts/prompt-maths.md': '数学教练模板正文',
    'StudyCoach/prompts/prompt-physics.md': '物理教练模板正文',
    'StudyCoach/prompts/ielts-writing.md': '雅思批改模板正文',
    'StudyCoach/prompts/prompt-ielts.md': '雅思写作教练模板正文',
    'StudyCoach/档案.md': '---\nstage: "G10"\nsubjects:\n  Maths: "IG+AS / AS主导 / 目标A*"\n---\n',
    'StudyCoach/记录/error-log.md': seedLog([
      `| 001 | ${todayStr()} | Maths | AS | Quadratic inequalities | 题 | D | 描述 | 做法 | expr | 1 | 未消除 | ${addDays(todayStr(), 7)} |`,
    ]),
    'StudyCoach/记录/弱点印象.md': '# 弱点印象\n\n| 日期 | 科目 | 描述 | 证据数 | 状态 |\n|------|------|------|--------|------|\n' +
      `| ${todayStr()} | Maths | 统计几何薄弱 | 0 | 待验证 |\n` +
      `| ${todayStr()} | Econ | 宏观模糊 | 0 | 待验证 |\n`,
    'StudyCoach/记录/练习侧重.md': '# 练习侧重\n\n| 日期 | 科目 | 描述 | 状态 |\n|------|------|------|------|\n' +
      `| ${todayStr()} | Maths | 证明跳步 | 生效中 |\n`,
    'StudyCoach/记录/进展/Maths.md': `# Maths 学习进展\n\n- ${todayStr()}：学到 differentiation\n`,
    'StudyCoach/记录/统计分析.md': '# 统计分析\n\n## 本期专项\n\n自今日起：练定义\n',
  } });
  const assembler = new PromptAssembler(
    v4.asService(),
    new ProfileService(v4.asService()),
    new ErrorLogService(v4.asService()),
    new ProgressService(v4.asService()),
    new WeakImpressionService(v4.asService()),
    new PracticeFocusService(v4.asService()),
    new StatsService(v4.asService(), engine),
    new ProfileL2Service(v4.asService(), engine),
  );
  const built = await assembler.buildSystemPrompt('Maths');
  check('模板缺失时返回 null', (await assembler.buildSystemPrompt('Chemistry')) === null);
  check('注入模板正文', built!.prompt.includes('数学教练模板正文'));
  check('注入学生档案', built!.prompt.includes('Student profile'));
  check('注入未消除失分行', built!.prompt.includes('Quadratic inequalities'));
  check('注入最近进展', built!.prompt.includes('学到 differentiation'));
  check('注入本期专项', built!.prompt.includes('练定义'));
  check('注入会话打标指令', built!.prompt.includes('sessionTag'));
  check('科目过滤：Maths 会话注入 Maths 印象', built!.prompt.includes('统计几何薄弱'));
  check('科目过滤：不注入 Econ 印象', !built!.prompt.includes('宏观模糊'));
  check('科目过滤：注入 Maths 练习侧重', built!.prompt.includes('证明跳步'));
  check('摘要含计数', built!.summary.includes('unresolved 1') && built!.summary.includes('with current special focus'));
  const physBuilt = await assembler.buildSystemPrompt('Physics');
  check('其他科目不注入 Maths 印象', !physBuilt!.prompt.includes('统计几何薄弱'));
  const ieltsBuilt = await assembler.buildSystemPrompt('ielts');
  check('雅思模式用教练模板', ieltsBuilt!.prompt.includes('雅思写作教练模板正文'));

  // P3：未消除 >10 且画像新鲜 → 注入压缩画像替代全表；≤10 → 全表
  const manyRows = Array.from({ length: 11 }, (_, i) =>
    `| 1${String(i).padStart(2, '0')} | ${todayStr()} | Maths | AS | Topic${i} | 几何 | D | 描述 | 做法 | expr | 1 | 未消除 | ${addDays(todayStr(), 7)} |`);
  const v5 = new FakeVault({ seed: {
    'StudyCoach/prompts/prompt-maths.md': '数学教练模板正文',
    'StudyCoach/档案.md': '---\nstage: "G10"\n---\n',
    'StudyCoach/记录/error-log.md': seedLog(manyRows),
  } });
  const p2v5 = new ProfileL2Service(v5.asService(), engine);
  await p2v5.generate(await new ErrorLogService(v5.asService()).load(), [], []);
  const asm5 = new PromptAssembler(
    v5.asService(), new ProfileService(v5.asService()), new ErrorLogService(v5.asService()),
    new ProgressService(v5.asService()), new WeakImpressionService(v5.asService()),
    new PracticeFocusService(v5.asService()), new StatsService(v5.asService(), engine), p2v5,
  );
  const built5 = await asm5.buildSystemPrompt('Maths');
  check('>10 且新鲜：注入弱点画像', built5!.prompt.includes('weakness profile'));
  check('>10 且新鲜：不注入全表', !built5!.prompt.includes('One-line description'));
  check('≤10：维持全表注入', built!.prompt.includes('One-line description'));
  const extra = await assembler.buildSystemPrompt('Maths', ['════ 参考文档「笔记」════\n文档内容']);
  check('引用文档注入', extra!.prompt.includes('文档内容'));
}
