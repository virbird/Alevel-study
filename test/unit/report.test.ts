// UT：InsightEngine 环比窗口 / isoWeekKey / ReportService 周报统计 / 进阶指引
import { section, check, eq, FakeVault } from '../harness';
import { InsightEngine } from '../../src/services/InsightEngine';
import { ReportService, oxbridgeGuidance } from '../../src/services/ReportService';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { TermListService } from '../../src/services/TermService';
import { IeltsService, EXPR_LIB_PATH } from '../../src/services/IeltsService';
import { SuggestionService } from '../../src/services/SuggestionService';
import { isoWeekKey, todayStr, addDays } from '../../src/utils/date';
import { seedLog } from './errorlog.test';

export async function run(): Promise<void> {
  section('UT: isoWeekKey 与环比窗口');
  check('isoWeekKey 格式', /^\d{4}-W\d{2}$/.test(isoWeekKey()));
  check('isoWeekKey 可按日期算', /^\d{4}-W\d{2}$/.test(isoWeekKey('2026-01-01')));

  const today = todayStr();
  const v = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([
    `| 001 | ${today} | Maths | AS | TopicNow | 题 | DV | 本期 | | | 1 | 未消除 | ${addDays(today, 7)} |`,
    `| 002 | ${addDays(today, -10)} | Maths | AS | TopicNow2 | 题 | CL | 本期边界 | | | 1 | 未消除 | ${addDays(today, -3)} |`,
    `| 003 | ${addDays(today, -20)} | Maths | AS | TopicPrev | 题 | DV | 上期 | | | 1 | 未消除 | ${addDays(today, -13)} |`,
    `| 004 | ${addDays(today, -40)} | Maths | AS | TopicOld | 题 | LK | 窗外 | | | 1 | 未消除 | ${addDays(today, -33)} |`,
  ]) } });
  const engine = new InsightEngine(v.asService());
  const entries = await new ErrorLogService(v.asService()).load();
  const cur = engine.codeCountsRange(entries, -1, 14);
  const prev = engine.codeCountsRange(entries, 14, 28);
  eq('本期窗口（0~14 天）计数', cur, [{ code: 'DV', count: 1 }, { code: 'CL', count: 1 }]);
  eq('上期窗口（15~28 天）计数', prev, [{ code: 'DV', count: 1 }]);
  check('40 天前不计入两窗口', !cur.some(c => c.code === 'LK') && !prev.some(c => c.code === 'LK'));
  const compat = await engine.codeCounts(entries, 14);
  eq('codeCounts 与 range(-1,14) 等价', compat, cur);

  section('UT: ReportService 周报统计');
  const v2 = new FakeVault({ seed: {
    'StudyCoach/记录/error-log.md': seedLog([
      `| 001 | ${today} | Physics | AS | Moments | 力矩 | DV | 漏成分 | 数成分 | expr | 2 | 未消除 | ${addDays(today, 3)} |`,
      `| 002 | ${addDays(today, -20)} | Maths | AS | Old | 题 | CL | 上期 | | | 1 | 已消除 | ${addDays(today, -13)} |`,
    ]),
    'StudyCoach/记录/提问记录.md': '# 提问记录\n\n| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |\n|------|------|---------|---------|---------|\n' +
      `| ${today} | Physics | Moments | 卡在某步 | 需要完整引导 |\n` +
      `| ${today} | Physics | Moments | 概念不懂 | 需要完整引导 |\n` +
      `| ${today} | Maths | Quadratic | 会但不熟 | 问一句就懂 |\n`,
    'StudyCoach/记录/术语清单.md': '# 术语清单\n\n| Term (EN) | 科目 | 教材原文定义 | 必要成分拆解 | 我漏掉过的成分 | 我用错的口语词 | 状态 |\n|-----------|------|-------------|-------------|--------------|--------------|------|\n' +
      `| Work done | Physics | 原文 | ①②③ | 漏③ | / | 观察中 |\n`,
    'StudyCoach/雅思/作文/2026-01-01-task2-x.md': `---\ntask: "2"\ndate: "${today}"\noverall: 6.5\ntr: 7\ncc: 6\nlr: 6.5\ngra: 6.5\n---\n\n# x\n`,
    [EXPR_LIB_PATH]: '# 表达积累库\n\n| 表达 | 类型 | 来源 | 日期 | 间隔 | 下次 | 状态 |\n|------|------|------|------|------|------|------|\n',
    'StudyCoach/建议/2026-01-01-test.md': `---\ntitle: 测试卡片\nkind: 提问热点\nkey: k1\nstatus: 待处理\ncreated: ${today}\n---\n\n# 测试卡片\n`,
  } });
  const vs2 = v2.asService();
  const reports = new ReportService(
    vs2,
    new ErrorLogService(vs2),
    new InsightEngine(vs2),
    new TermListService(vs2),
    new IeltsService(vs2),
    new SuggestionService(vs2),
  );
  const md = await reports.buildWeekly();
  check('周报含求助统计', md.includes('本周共求助 3 次') && md.includes('Physics ×2'));
  check('周报含提问热点', md.includes('Moments ×2'));
  check('周报含新增失分计数', md.includes('本周新增失分记录 1 条'));
  check('周报含表达码环比', md.includes('表达码（DV/CL/LK）'));
  check('周报含复发热点', md.includes('Moments') && md.includes('复发 2'));
  check('周报含复习统计', md.includes('当前待复查'));
  check('周报含术语统计', md.includes('观察中 1'));
  check('周报含雅思统计与短板', md.includes('本周批改 1 篇') && md.includes('短板维度：CC'));
  check('周报含建议卡片统计', md.includes('本周新增 1 张'));
  check('周报带 frontmatter', md.startsWith('---') && md.includes('week:'));
  const path = await reports.exportWeekly();
  check('周报落盘路径含周标识', path.includes(isoWeekKey()));
  eq('落盘内容与构建一致', v2.files[path], md);

  section('UT: 进阶角阶段指引');
  check('G10 指引含 UKMT 且禁 STEP', oxbridgeGuidance('G10', '待定').includes('UKMT') && oxbridgeGuidance('G10', '待定').includes('不碰 STEP'));
  check('G11 指引含 MAT/STEP', oxbridgeGuidance('G11', '数学').includes('MAT') && oxbridgeGuidance('G11', '数学').includes('数学'));
  check('G12 指引含冲刺与官方核对提醒', oxbridgeGuidance('G12', '工程').includes('冲刺') && oxbridgeGuidance('G12', '工程').includes('官方'));
}
