// UT：pickTop3 本周三件事选取规则
import { section, eq } from '../harness';
import { pickTop3 } from '../../src/utils/top3';
import type { ErrorLogEntry } from '../../src/services/ErrorLogService';
import type { WrongAnswerEntry } from '../../src/services/WrongAnswerService';

const mkLog = (id: string, recurrence: number): ErrorLogEntry => ({
  id, date: '2026-08-01', subject: 'Chem', level: 'IG', topic: `T${id}`, qtype: '', code: 'DV',
  desc: '', fix: '', stdExpr: '', recurrence, status: '未消除', reviewDate: '2026-08-10',
});
const mkWrong = (id: string, date: string): WrongAnswerEntry => ({
  id, date, subject: 'Maths', topic: `W${id}`, myError: '', code: '', answerSource: '', status: '未订正', session: '',
});

export async function run(): Promise<void> {
  section('UT: pickTop3 本周三件事');
  const due = [mkLog('001', 3), mkLog('002', 1), mkLog('003', 1)];
  const wrongs = [mkWrong('W1', '2026-08-05'), mkWrong('W0', '2026-08-01')];
  const p = pickTop3(due, wrongs, '2026-08-13');
  eq('2+1 组成', p.map(x => x.kind), ['log', 'log', 'wrong']);
  eq('错题取最旧', p[2].wrong!.id, 'W0');
  eq('log 逾期天数', p[0].days, 3);
  eq('wrong 登记天数', p[2].days, 12);

  eq('不足补齐', pickTop3([mkLog('001', 1)], [], '2026-08-13').map(x => x.kind), ['log']);
  eq('全空不渲染', pickTop3([], [], '2026-08-13').length, 0);
  eq('无到期时错题补齐', pickTop3([], wrongs, '2026-08-13').map(x => x.kind), ['wrong', 'wrong']);
  const many = pickTop3(due, wrongs, '2026-08-13');
  eq('最多 3 条', many.length, 3);
}
