// UT：ReviewSheetService —— 复习单编译/指纹漂移检测/空队列省略/Q4 交错编排
import { section, check, eq, FakeVault } from '../harness';
import { ReviewSheetService, REVIEW_SHEET_PATH, interleave } from '../../src/services/ReviewSheetService';
import type { SheetSources } from '../../src/services/ReviewSheetService';

const SRC: SheetSources = {
  terms: [{ term: 'moment', subject: 'Physics', status: '未稳定' }],
  points: [{ id: '001', subject: 'Physics', topic: 'Moments', code: 'LK', recurrence: 2 }],
  wrongs: [{ id: 'W1', subject: 'Maths', topic: 'lever', myError: '忘乘力臂', session: '20260812-101500-Physics' }],
  exprs: [{ expr: 'in contrast to', type: '对比' }],
};

export async function run(): Promise<void> {
  section('UT: ReviewSheetService 复习单');
  const v = new FakeVault();
  const rs = new ReviewSheetService(v.asService());

  eq('指纹稳定', ReviewSheetService.fingerprint(SRC), ReviewSheetService.fingerprint(SRC));
  check('源变化指纹变化', ReviewSheetService.fingerprint({ ...SRC, terms: [] }) !== ReviewSheetService.fingerprint(SRC));
  check('指纹顺序无关（同集合乱序入参同指纹）', ReviewSheetService.fingerprint({ ...SRC, points: [...SRC.points, ...SRC.points.map(p => ({ ...p, id: '002' }))].reverse(), wrongs: [...SRC.wrongs].reverse() }) === ReviewSheetService.fingerprint({ ...SRC, points: [...SRC.points, ...SRC.points.map(p => ({ ...p, id: '002' }))], wrongs: SRC.wrongs }));

  const content = await rs.generate(SRC);
  check('术语闪卡节', content.includes('## ① 术语闪卡') && content.includes('> [!question]- moment'));
  check('错题重做节含台账 ID 与会话回链', content.includes('台账 001') && content.includes('会话/20260812-101500-Physics.md'));
  check('表达造句节', content.includes('## ③ 表达造句') && content.includes('in contrast to'));
  eq('写盘指纹可读', await rs.readFingerprint(), ReviewSheetService.fingerprint(SRC));

  const empty = await rs.generate({ terms: [], points: [], wrongs: [], exprs: [] });
  check('空队列省略各节', empty.includes('（当前无到期复习项）') && !empty.includes('## ①'));

  check('文件路径约定', REVIEW_SHEET_PATH.endsWith('记录/review-sheet.md'));

  section('UT: Q4 交错编排 interleave');
  const item = (s: string, i: number) => ({ subject: s, id: `${s}${i}` });
  // 3 科不均衡桶（A×3 B×2 C×1）：轮转取尽，桶内保序
  eq('轮转序正确', interleave([item('A', 1), item('A', 2), item('A', 3), item('B', 1), item('B', 2), item('C', 1)]).map(x => x.id),
    ['A1', 'B1', 'C1', 'A2', 'B2', 'A3']);
  eq('单科保持原序', interleave([item('A', 1), item('A', 2)]).map(x => x.id), ['A1', 'A2']);

  // ②节交错触发：≥6 条且跨 ≥2 科
  const big: SheetSources = {
    terms: [],
    points: [
      { id: '001', subject: 'Maths', topic: 'T1', code: 'D', recurrence: 2 },
      { id: '002', subject: 'Maths', topic: 'T2', code: 'D', recurrence: 2 },
      { id: '003', subject: 'Maths', topic: 'T3', code: 'D', recurrence: 2 },
      { id: '004', subject: 'Chem', topic: 'T4', code: 'DV', recurrence: 2 },
    ],
    wrongs: [
      { id: 'W1', subject: 'Chem', topic: 'T5', myError: '', session: '' },
      { id: 'W2', subject: 'Chem', topic: 'T6', myError: '', session: '' },
    ],
    exprs: [],
  };
  const bigSheet = await rs.generate(big);
  check('达阈交错：标题标注且科目轮转', bigSheet.includes('（交错编排）') && bigSheet.indexOf('T1') < bigSheet.indexOf('T4') && bigSheet.indexOf('T4') < bigSheet.indexOf('T2'));
  const small = await rs.generate({ ...big, wrongs: big.wrongs.slice(0, 1) });
  check('5 条不交错（小样本=噪音）', !small.includes('（交错编排）') && small.indexOf('T3') < small.indexOf('T4'));
}
