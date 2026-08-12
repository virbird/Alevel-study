// UT：ReviewSheetService —— 复习单编译/指纹漂移检测/空队列省略
import { section, check, eq, FakeVault } from '../harness';
import { ReviewSheetService, REVIEW_SHEET_PATH } from '../../src/services/ReviewSheetService';
import type { SheetSources } from '../../src/services/ReviewSheetService';

const SRC: SheetSources = {
  terms: [{ term: 'moment', subject: 'Physics', status: '未稳定' }],
  points: [{ id: '001', subject: 'Physics', topic: 'Moments', code: 'LK', recurrence: 2 }],
  wrongs: [{ id: 'W1', topic: 'lever', myError: '忘乘力臂', session: '20260812-101500-Physics' }],
  exprs: [{ expr: 'in contrast to', type: '对比' }],
};

export async function run(): Promise<void> {
  section('UT: ReviewSheetService 复习单');
  const v = new FakeVault();
  const rs = new ReviewSheetService(v.asService());

  eq('指纹稳定', ReviewSheetService.fingerprint(SRC), ReviewSheetService.fingerprint(SRC));
  check('源变化指纹变化', ReviewSheetService.fingerprint({ ...SRC, terms: [] }) !== ReviewSheetService.fingerprint(SRC));

  const content = await rs.generate(SRC);
  check('术语闪卡节', content.includes('## ① 术语闪卡') && content.includes('> [!question]- moment'));
  check('错题重做节含台账 ID 与会话回链', content.includes('台账 001') && content.includes('会话/20260812-101500-Physics.md'));
  check('表达造句节', content.includes('## ③ 表达造句') && content.includes('in contrast to'));
  eq('写盘指纹可读', await rs.readFingerprint(), ReviewSheetService.fingerprint(SRC));

  const empty = await rs.generate({ terms: [], points: [], wrongs: [], exprs: [] });
  check('空队列省略各节', empty.includes('（当前无到期复习项）') && !empty.includes('## ①'));

  check('文件路径约定', REVIEW_SHEET_PATH.endsWith('记录/review-sheet.md'));
}
