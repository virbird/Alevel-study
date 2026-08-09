// UT：口语训练（SpeakingService 台账 + 三类机器块解析 + stripMachineBlocks 扩展）
import { section, check, eq, FakeVault } from '../harness';
import { SpeakingService, SPEAKING_LEDGER_PATH, parseSpeakingScores, parseSpeakingExpressions, parseSpeakingWrongs, fmtBand } from '../../src/services/SpeakingService';
import { stripMachineBlocks } from '../../src/ui/MainView';

const LEDGER = `# 口语记录

| 日期 | 模式 | FC | LR | GRA | P | 总分 | 最大问题 |
|------|------|----|----|-----|---|------|----------|
`;

export async function run(): Promise<void> {
  section('UT: parseSpeakingScores');
  const reply = 'Well done.\n```json\n{"ieltsSpeaking": {"part": "1", "fc": 6.5, "lr": 7.0, "gra": 6.0, "p": null, "overall_low": 6.5, "overall_high": 7.0, "biggest_issue": "answers too short"}}\n```\n后面还有。\n```json\n{"ieltsSpeaking": {"part": "final", "fc": 6.5, "lr": 7.0, "gra": 6.5, "p": null, "overall_low": 6.5, "overall_high": 7.0, "biggest_issue": "connectors"}}\n```';
  const scores = parseSpeakingScores(reply);
  eq('多条评分块全部解析', scores.length, 2);
  eq('part 字段', scores[1].part, 'final');
  eq('四维取值', [scores[0].fc, scores[0].lr, scores[0].gra], [6.5, 7.0, 6.0]);
  check('文字模式 P 为 null', scores[0].p === null);
  eq('总分区间', [scores[0].overallLow, scores[0].overallHigh], [6.5, 7.0]);
  eq('无评分块返回空', parseSpeakingScores('普通回复').length, 0);
  eq('总分区间格式化', SpeakingService.fmtOverall(scores[0]), '6.5–7.0');
  eq('单分格式化', SpeakingService.fmtOverall({ ...scores[0], overallHigh: 6.5 }), '6.5');
  eq('无分格式化', SpeakingService.fmtOverall({ ...scores[0], overallLow: null, overallHigh: null }), '-');
  eq('整数带位补小数', fmtBand(7), '7.0');
  eq('半带原样', fmtBand(6.5), '6.5');
  eq('无分为 -', fmtBand(null), '-');

  section('UT: parseSpeakingExpressions');
  const reply2 = '```json\n{"ieltsExpressions": {"items": [{"expr": "it depends on", "context": "回答视情况而定", "band": "7+"}, {"expr": "", "context": "空表达应跳过"}]}}\n```';
  const exprs = parseSpeakingExpressions(reply2);
  eq('表达条数（空条目被过滤）', exprs.length, 1);
  eq('表达文本', exprs[0].expr, 'it depends on');
  eq('类型带 Band 标注', exprs[0].type, '口语 Band 7+ 表达');
  eq('语境进 note', exprs[0].note, '回答视情况而定');

  section('UT: parseSpeakingWrongs');
  const reply3 = '```json\n{"wrongAnswers": {"items": [{"topic": "past tense", "myError": "went 说成 goed", "code": "gr"}, {"myError": "缺 topic 应跳过"}]}}\n```';
  const wrongs = parseSpeakingWrongs(reply3);
  eq('错题条数（缺 topic 被过滤）', wrongs.length, 1);
  eq('错因码大写归一', wrongs[0].code, 'GR');
  eq('缺 code 默认 GR', parseSpeakingWrongs('```json\n{"wrongAnswers": {"items": [{"topic": "x"}]}}\n```')[0].code, 'GR');

  section('UT: stripMachineBlocks 覆盖口语块');
  const mixed = '点评内容。\n```json\n{"ieltsSpeaking": {"part": "final"}}\n```\n```json\n{"ieltsExpressions": {"items": []}}\n```\n```json\n{"wrongAnswers": {"items": []}}\n```\n```json\n{"other": 1}\n```';
  const stripped = stripMachineBlocks(mixed);
  check('口语三块被剥离', !stripped.includes('ieltsSpeaking') && !stripped.includes('ieltsExpressions') && !stripped.includes('wrongAnswers'));
  check('无关 JSON 块保留', stripped.includes('"other"'));
  check('正文保留', stripped.startsWith('点评内容。'));

  section('UT: SpeakingService 台账');
  const v = new FakeVault({ seed: { [SPEAKING_LEDGER_PATH]: LEDGER } });
  const sp = new SpeakingService(v.asService());
  await sp.registerScore(scores[1], '模考');
  await sp.registerScore({ ...scores[1], part: 'final', biggestIssue: 'linking words' }, '陪练');
  const rows = await sp.loadScores();
  eq('台账行数', rows.length, 2);
  eq('模式列', [rows[0].mode, rows[1].mode], ['模考', '陪练']);
  eq('LR 列整数补小数（7 → 7.0）', rows[1].lr, '7.0');
  eq('P 列无语音为 -', rows[0].p, '-');
  eq('总分列区间格式', rows[0].overall, '6.5–7.0');
  check('最大问题列', rows[1].issue === 'linking words');
  // 表后空行不影响追加（表格感知）
  const v2 = new FakeVault({ seed: { [SPEAKING_LEDGER_PATH]: LEDGER + '| 2026-01-01 | 模考 | 6 | 6 | 6 | - | 6 | x |\n\n' } });
  const sp2 = new SpeakingService(v2.asService());
  await sp2.registerScore(scores[1], '讨论');
  const rows2 = await sp2.loadScores();
  eq('表后空行：新行仍入表', rows2.length, 2);
}
