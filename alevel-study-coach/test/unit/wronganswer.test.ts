// UT：错题本服务（订正台账）+ wrongAnswer JSON 提取与展示剥离
import { section, check, eq, FakeVault } from '../harness';
import { WrongAnswerService, WRONG_ANSWER_PATH } from '../../src/services/WrongAnswerService';
import { stripMachineBlocks } from '../../src/ui/MainView';
import { extractJson } from '../../src/llm/LlmClient';

const LEDGER = `# 错题本

| ID | 日期 | 科目 | 考点(EN) | 我的错误 | 错因代码 | 答案来源 | 状态 |
|---|---|---|---|---|---|---|---|
`;

export async function run(): Promise<void> {
  section('UT: WrongAnswerService');
  const v = new FakeVault({ seed: { [WRONG_ANSWER_PATH]: LEDGER } });
  const wa = new WrongAnswerService(v.asService());

  const e1 = await wa.addEntry({ subject: 'Physics', topic: 'moments', myError: '忘记乘力臂', code: 'LK', answerSource: '模型解答（已确认）', status: '已订正' });
  eq('入库 ID 递增', e1?.id, 'W1');
  const list = await wa.load();
  eq('表格解析行数', list.length, 1);
  eq('状态解析', list[0].status, '已订正');
  eq('错误描述保留', list[0].myError, '忘记乘力臂');

  const dup = await wa.addEntry({ subject: 'Physics', topic: 'moments' });
  check('同日同考点去重', dup === null);

  const e3 = await wa.addEntry({ subject: 'Maths', topic: 'differentiation', status: '未订正' });
  eq('默认答案来源=模型解答（待确认）', e3?.answerSource, '模型解答（待确认）');
  const open = await wa.open();
  eq('open 只返回未订正', open.length, 1);
  eq('open 条目正确', open[0].topic, 'differentiation');

  check('无 topic 拒绝入库', (await wa.addEntry({ subject: 'Maths' })) === null);

  section('UT: wrongAnswer JSON 提取与展示剥离');
  const reply = '订正完成，重写一遍很好。\n```json\n{"wrongAnswer": {"subject": "Physics", "topic": "moments", "status": "已订正"}}\n```';
  const parsed = extractJson<{ wrongAnswer?: { topic: string; status: string } }>(reply);
  eq('提取 topic', parsed?.wrongAnswer?.topic, 'moments');
  eq('提取 status', parsed?.wrongAnswer?.status, '已订正');
  check('展示剥离 wrongAnswer 块', !stripMachineBlocks(reply).includes('wrongAnswer'));
  check('正文保留', stripMachineBlocks(reply).includes('订正完成'));
}
