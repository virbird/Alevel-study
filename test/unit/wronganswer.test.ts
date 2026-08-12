// UT：错题本服务（订正台账）+ wrongAnswer JSON 提取与展示剥离
import { section, check, eq, FakeVault } from '../harness';
import { WrongAnswerService, WRONG_ANSWER_PATH } from '../../src/services/WrongAnswerService';
import { stripMachineBlocks } from '../../src/ui/MainView';
import { extractJson } from '../../src/llm/LlmClient';
import { progressBadge, setLang } from '../../src/i18n';

const LEDGER = `# 错题本

| ID | 日期 | 科目 | 考点(EN) | 我的错误 | 错因代码 | 答案来源 | 状态 |
|---|---|---|---|---|---|---|---|
| W0 | 2026-01-01 | Maths | legacy | 旧行无会话列 | LK | 官方答案 | 未订正 |
`;

export async function run(): Promise<void> {
  section('UT: WrongAnswerService');
  const v = new FakeVault({ seed: { [WRONG_ANSWER_PATH]: LEDGER } });
  const wa = new WrongAnswerService(v.asService());

  const legacy = await wa.load();
  eq('旧 8 列行可解析', legacy.length, 1);
  eq('旧行 session 为空', legacy[0].session, '');

  const e1 = await wa.addEntry({ subject: 'Physics', topic: 'moments', myError: '忘记乘力臂', code: 'LK', answerSource: '模型解答（已确认）', status: '已订正', session: '20260812-101500-Physics' });
  eq('入库 ID 递增', e1?.id, 'W2');
  const list = await wa.load();
  eq('表格解析行数', list.length, 2);
  eq('状态解析', list.find(x => x.id === 'W2')?.status, '已订正');
  eq('错误描述保留', list.find(x => x.id === 'W2')?.myError, '忘记乘力臂');
  eq('session 回链往返', list.find(x => x.id === 'W2')?.session, '20260812-101500-Physics');

  const dup = await wa.addEntry({ subject: 'Physics', topic: 'moments' });
  check('同日同考点去重', dup === null);

  const e3 = await wa.addEntry({ subject: 'Maths', topic: 'differentiation', status: '未订正' });
  eq('默认答案来源=模型解答（待确认）', e3?.answerSource, '模型解答（待确认）');
  const open = await wa.open();
  eq('open 只返回未订正（legacy+新）', open.length, 2);
  check('open 条目正确', open.some(x => x.topic === 'differentiation'));

  check('无 topic 拒绝入库', (await wa.addEntry({ subject: 'Maths' })) === null);

  // 逐条手工反馈：updateStatus 整行替换
  const upd = await wa.updateStatus('W2', '已订正');
  check('updateStatus 成功（同状态前已是已订正→应 false）', upd === false);
  const updLegacy = await wa.updateStatus('W0', '已订正');
  check('旧 8 列行 updateStatus 成功（顺带迁移 9 列）', updLegacy === true);
  const after = await wa.load();
  eq('状态已更新', after.find(x => x.id === 'W0')?.status, '已订正');
  eq('其他字段不变', after.find(x => x.id === 'W3')?.topic, 'differentiation');
  eq('迁移后 session 仍为空', after.find(x => x.id === 'W0')?.session, '');
  eq('9 列行 session 保留', after.find(x => x.id === 'W2')?.session, '20260812-101500-Physics');
  check('重复更新同状态返回 false', (await wa.updateStatus('W0', '已订正')) === false);
  check('不存在的 ID 返回 false', (await wa.updateStatus('W99', '已订正')) === false);

  section('UT: 掌握度进度徽章');
  eq('术语观察中', progressBadge('term', '观察中').length > 0, true);
  eq('术语未稳定', progressBadge('term', '未稳定').length > 0, true);
  eq('术语已稳定无徽章', progressBadge('term', '已稳定'), '');
  eq('失分观察中', progressBadge('log', '观察中').length > 0, true);
  eq('错题未订正', progressBadge('wrong', '未订正').length > 0, true);
  eq('错题已订正无徽章', progressBadge('wrong', '已订正'), '');
  setLang('zh');
  check('中文徽章', progressBadge('term', '观察中').includes('抽查'));
  setLang('en');
  check('英文徽章', progressBadge('term', '观察中').includes('spot-check'));

  section('UT: wrongAnswer JSON 提取与展示剥离');
  const reply = '订正完成，重写一遍很好。\n```json\n{"wrongAnswer": {"subject": "Physics", "topic": "moments", "status": "已订正"}}\n```';
  const parsed = extractJson<{ wrongAnswer?: { topic: string; status: string } }>(reply);
  eq('提取 topic', parsed?.wrongAnswer?.topic, 'moments');
  eq('提取 status', parsed?.wrongAnswer?.status, '已订正');
  check('展示剥离 wrongAnswer 块', !stripMachineBlocks(reply).includes('wrongAnswer'));
  check('正文保留', stripMachineBlocks(reply).includes('订正完成'));
}
