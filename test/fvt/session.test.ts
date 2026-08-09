// FVT-1：完整求助闭环（新会话注入 → 结题 → 打标+入库 → 复发 → 存档续聊）
import { section, check, eq, FakeVault } from '../harness';
import { PromptAssembler } from '../../src/services/PromptAssembler';
import { ProfileService } from '../../src/services/ProfileService';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { ProgressService, WeakImpressionService, PracticeFocusService, QuestionLogService } from '../../src/services/QuestionLogService';
import { StatsService } from '../../src/services/StatsService';
import { InsightEngine } from '../../src/services/InsightEngine';
import { extractJson } from '../../src/llm/LlmClient';
import { parseSessionMessages, thinkAnnotation } from '../../src/ui/MainView';
import { seedLog } from '../unit/errorlog.test';
import { todayStr } from '../../src/utils/date';
import type { SessionTag } from '../../src/types';

export async function run(): Promise<void> {
  section('FVT: 完整求助闭环');
  const v = new FakeVault({ seed: {
    'StudyCoach/prompts/prompt-physics.md': '物理教练模板',
    'StudyCoach/档案.md': '---\nstage: "G10"\nsubjects:\n  Physics: "IG+AS / IG主导 / 目标A*"\n---\n',
    'StudyCoach/记录/error-log.md': seedLog([]),
    'StudyCoach/记录/提问记录.md': '# 提问记录\n\n| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |\n|------|------|---------|---------|---------|\n',
    'StudyCoach/记录/统计分析.md': '# 统计分析\n',
    'StudyCoach/记录/弱点印象.md': '# 弱点印象\n\n| 日期 | 科目 | 描述 | 证据数 | 状态 |\n|------|------|------|--------|------|\n',
    'StudyCoach/记录/练习侧重.md': '# 练习侧重\n\n| 日期 | 科目 | 描述 | 状态 |\n|------|------|------|------|\n',
  } });
  const vs = v.asService();
  const errorLog = new ErrorLogService(vs);
  const questionLog = new QuestionLogService(vs);
  const assembler = new PromptAssembler(
    vs, new ProfileService(vs), errorLog, new ProgressService(vs),
    new WeakImpressionService(vs), new PracticeFocusService(vs),
    new StatsService(vs, new InsightEngine(vs)),
  );

  // 1. 新会话：System Prompt 组装成功
  const built = await assembler.buildSystemPrompt('Physics');
  check('会话可开始（模板+注入就绪）', built !== null && built!.prompt.includes('物理教练模板'));

  // 2. 模拟 AI 结题回复（知识卡片 + log 行 + 会话标签）
  const aiReply = [
    '知识卡片：Topic Moments……',
    '| ??? | ??? | Physics | AS | Moments | 力矩计算 | D | 方向判断反了 | 右手定则确认方向 | clockwise | 1 | 未消除 | ??? |',
    '```json',
    '{ "sessionTag": { "subject": "Physics", "topic": "Moments", "confusion": "卡在某步", "depth": "需要完整引导" } }',
    '```',
  ].join('\n');

  // 3. 副作用一：会话打标 → 提问记录（同一会话只记一次）
  const parsed = extractJson<{ sessionTag?: Partial<SessionTag> }>(aiReply);
  check('会话标签可从回复提取', !!parsed?.sessionTag?.topic);
  await questionLog.appendTag({
    date: todayStr(),
    subject: parsed!.sessionTag!.subject!,
    topic: parsed!.sessionTag!.topic!,
    confusion: parsed!.sessionTag!.confusion!,
    depth: parsed!.sessionTag!.depth!,
  });
  check('提问记录已落盘', v.files['StudyCoach/记录/提问记录.md'].includes('Moments'));

  // 4. 副作用二：log 行一键入库
  const rows = errorLog.parseAiRows(aiReply);
  eq('结题 log 行解析成功', rows.length, 1);
  const res = await errorLog.addEntry(rows[0]);
  eq('首次入库为新行', res?.action, 'new');
  eq('入库后主表 1 条', (await errorLog.load()).length, 1);

  // 5. 第二次会话同考点再犯 → 复发
  const res2 = await errorLog.addEntry(rows[0]);
  eq('同考点再犯触发复发', res2?.action, 'recurrence');
  const entry = (await errorLog.load())[0];
  eq('复发次数累计', entry.recurrence, 2);
  eq('状态回到未消除', entry.status, '未消除');

  // 6. 未消除行注入下一次会话
  const built2 = await assembler.buildSystemPrompt('Physics');
  check('下次会话开场自动带上该失分点', built2!.prompt.includes('Moments'));

  // 7. 存档 → 解析 → 续聊
  const archived = [
    '---', 'mode: Physics', '---', '', '# 教练会话', '',
    '## 学生', '', '这道力矩题怎么做？', '',
    '## 教练', '', '先找支点。', '',
    '## 学生', '', '做出来了。', '',
  ].join('\n');
  v.files['StudyCoach/会话/2026-08-04-150000-Physics.md'] = archived;
  const restored = parseSessionMessages(archived);
  eq('存档解析消息数', restored.length, 3);
  eq('续聊角色顺序', restored.map(m => m.role), ['user', 'assistant', 'user']);

  // 8. 增量存档不重复：savedCount 语义（模拟）
  const before = (v.files['StudyCoach/会话/2026-08-04-150000-Physics.md'].match(/## 学生/g) ?? []).length;
  eq('存档学生消息数', before, 2);

  // 9. 独立思考凭证：计时跑满后的消息标注（供教练按思维题模式验证）
  const ann = thinkAnnotation(15);
  check('凭证含时长与门槛语义', ann.includes('15 分钟') && ann.includes('门槛'));
  check('凭证以插件注开头，与正文分隔', ann.startsWith('\n\n[插件注'));
  eq('凭证时长可变', thinkAnnotation(20).includes('20 分钟'), true);
}
