// FVT-2：冷启动分流 / 复习流转 / 分析循环（统计→候选→卡片→Dashboard 数据）
import { section, check, eq, FakeVault } from '../harness';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { ProgressService, WeakImpressionService, PracticeFocusService } from '../../src/services/QuestionLogService';
import { TermListService } from '../../src/services/TermService';
import { InsightEngine } from '../../src/services/InsightEngine';
import { StatsService } from '../../src/services/StatsService';
import { SuggestionService } from '../../src/services/SuggestionService';
import { seedLog } from '../unit/errorlog.test';
import { todayStr, addDays } from '../../src/utils/date';
import type { OnboardResult } from '../../src/types';

export async function run(): Promise<void> {
  section('FVT: 冷启动三层分流');
  // 模拟 LLM 提取结果（OnboardModal 的输入）
  const extracted: OnboardResult = {
    progress: [
      { subject: 'Maths', text: 'AS 学到 differentiation' },
      { subject: 'Physics', text: '刚学完 electric fields' },
    ],
    errors: [
      { subject: 'Physics', topic: 'Resolving forces', code: 'U', desc: '上周考试分量漏了单位', fix: '每行写单位', specificity: 'specific' },
      { subject: 'Physics', desc: '实验题成功率不高', specificity: 'practice' },
      { subject: 'Econ', desc: '问答题容易口语化', specificity: 'practice' },
      { subject: 'Maths', desc: '统计和几何比较薄弱', specificity: 'impression' },
    ],
  };
  const v = new FakeVault({ seed: {
    'StudyCoach/记录/error-log.md': seedLog([]),
    'StudyCoach/记录/弱点印象.md': '# 弱点印象\n\n| 日期 | 科目 | 描述 | 证据数 | 状态 |\n|------|------|------|--------|------|\n',
    'StudyCoach/记录/练习侧重.md': '# 练习侧重\n\n| 日期 | 科目 | 描述 | 状态 |\n|------|------|------|------|\n',
    'StudyCoach/记录/提问记录.md': '# 提问记录\n\n| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |\n|------|------|---------|---------|---------|\n',
    'StudyCoach/记录/统计分析.md': '# 统计分析\n',
  } });
  const vs = v.asService();
  const errorLog = new ErrorLogService(vs);
  const progress = new ProgressService(vs);
  const wis = new WeakImpressionService(vs);
  const pfs = new PracticeFocusService(vs);

  // 复刻 OnboardModal 的分流写入逻辑
  for (const p of extracted.progress) await progress.append(p.subject, p.text, todayStr());
  for (const e of extracted.errors) {
    if (e.specificity === 'practice') await pfs.append(e.subject ?? '', e.desc || e.topic || '');
    else if (e.specificity === 'impression') await wis.append(e.subject ?? '', e.desc ?? '');
    else if (e.topic || e.desc) await errorLog.addEntry({ subject: e.subject, topic: e.topic ?? '(待补充)', code: e.code || 'K', desc: e.desc, fix: e.fix });
  }
  eq('具体失分只进主表 1 条', (await errorLog.load()).length, 1);
  eq('主表条目字段完整', (await errorLog.load())[0].topic, 'Resolving forces');
  eq('习惯倾向进练习侧重 2 条', (await pfs.load()).length, 2);
  eq('模糊印象进弱点印象 1 条', (await wis.load()).length, 1);
  eq('进展基线按科目落盘', Object.keys(v.files).filter(f => f.startsWith('StudyCoach/记录/进展/')).length, 2);
  check('模糊描述未污染主表', !JSON.stringify(await errorLog.load()).includes('统计和几何'));
  check('模糊印象进入物理会话注入源', (await wis.pendingForInjection('Maths')).length === 1);

  section('FVT: 复习流转（到期→变式复查→状态流转）');
  const past = addDays(todayStr(), -8);
  const v2 = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([
    `| 001 | ${past} | Physics | AS | Moments | 力矩 | D | 方向反了 | 右手定则 | expr | 1 | 未消除 | ${past} |`,
  ]) } });
  const el2 = new ErrorLogService(v2.asService());
  eq('8 天后到期可查', (await el2.dueEntries()).map(e => e.id), ['001']);
  await el2.updateEntry('001', { status: '观察中', reviewDate: addDays(todayStr(), 7) });
  eq('复查通过一次 → 观察中', (await el2.load())[0].status, '观察中');
  eq('通过后暂离到期队列', (await el2.dueEntries()).length, 0);
  await el2.updateEntry('001', { status: '已消除', reviewDate: addDays(todayStr(), 7) });
  eq('连续两次通过 → 已消除', (await el2.load())[0].status, '已消除');
  // 再犯：复发机制接管
  await el2.addEntry({ subject: 'Physics', topic: 'Moments', code: 'D' });
  const afterFail = (await el2.load())[0];
  eq('再犯：复发 +1 且回到未消除', [afterFail.recurrence, afterFail.status], [2, '未消除']);
  eq('再犯：复查顺延 3 天', afterFail.reviewDate, addDays(todayStr(), 3));
  check('再犯进入到期视野（3 天后）', (await el2.load()).every(e => e.reviewDate <= addDays(todayStr(), 3)));

  section('FVT: 分析循环（统计 → 候选 → 卡片 → 反馈）');
  const v3 = new FakeVault({ seed: {
    'StudyCoach/记录/error-log.md': seedLog([
      `| 001 | ${todayStr()} | Physics | AS | Moments | 力矩 | D | 方向反了 | 右手定则 | expr | 3 | 未消除 | ${addDays(todayStr(), 3)} |`,
      `| 002 | ${todayStr()} | Physics | AS | Moments | 力矩 | U | 漏单位 | 写单位 | expr | 1 | 未消除 | ${addDays(todayStr(), 7)} |`,
      `| 003 | ${todayStr()} | Physics | AS | Work done | 定义 | DV | 漏成分 | 数成分 | expr | 1 | 未消除 | ${addDays(todayStr(), 7)} |`,
    ]),
    'StudyCoach/记录/提问记录.md': '# 提问记录\n\n| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |\n|------|------|---------|---------|---------|\n' +
      Array.from({ length: 3 }, () => `| ${todayStr()} | Physics | Moments | 卡在某步 | 需要完整引导 |`).join('\n') + '\n',
    'StudyCoach/记录/术语清单.md': '# 术语清单\n\n| Term (EN) | 科目 | 教材原文定义 | 必要成分拆解 | 我漏掉过的成分 | 我用错的口语词 | 状态 |\n|-----------|------|-------------|-------------|--------------|--------------|------|\n',
    'StudyCoach/记录/统计分析.md': '# 统计分析\n',
  } });
  const vs3 = v3.asService();
  const engine = new InsightEngine(vs3);
  const stats = new StatsService(vs3, engine);
  const sugg = new SuggestionService(vs3);
  const terms = new TermListService(vs3);

  // 模拟 runAnalysisCycle：统计 → 候选 → 卡片
  const entries = await new ErrorLogService(vs3).load();
  await stats.runQuestionWeekly();
  await stats.runHotspotBiweekly(entries);
  const candidates = await engine.generateCandidates(entries, await terms.load());
  check('循环产出候选（提问热点+复发热点）', candidates.some(c => c.kind === '提问热点') && candidates.some(c => c.kind === '复发热点'));
  const created = await sugg.syncCandidates(candidates);
  check('卡片落盘', created >= 2);
  const pendingCards = await sugg.pending();
  check('Dashboard 可见待处理卡片', pendingCards.length >= 2);
  check('统计分析含本期专项', v3.files['StudyCoach/记录/统计分析.md'].includes('## 本期专项'));

  // 学生反馈「不准确」→ 记录反馈；其余同意处理
  const wrong = pendingCards[0];
  await sugg.setStatus(wrong.file, '不准确', '这个考点上周已经解决了');
  check('反馈写入卡片文件', v3.files[wrong.file].includes('这个考点上周已经解决了'));
  const ok = pendingCards[1];
  await sugg.setStatus(ok.file, '已处理');
  eq('处理后 pending 减少', (await sugg.pending()).length, pendingCards.length - 2);

  // 幂等：下一轮循环不重复出同样的卡片（除不准确那条允许重来）
  const created2 = await sugg.syncCandidates(candidates);
  eq('下轮循环只补回被标记不准确的候选', created2, 1);

  // Dashboard 雷达数据就绪
  const radar = await engine.radar(entries, 14);
  eq('雷达：提问热点首位 Moments', radar.topicHeat[0]?.topic, 'Moments');
  check('雷达：失分码统计非空', radar.codeCounts.length > 0);
  eq('雷达：未消除计数', radar.unresolvedCount, 3);
}
