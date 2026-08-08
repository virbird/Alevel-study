// UT：章节进度服务（台账读写/解锁流转/术语提取）
import { section, check, eq, FakeVault } from '../harness';
import { ChapterProgressService, CHAPTER_PROGRESS_PATH } from '../../src/services/ChapterProgressService';

const LEDGER = `# 章节进度

| 科目 | 章节 | 内容文件 | 状态 | 解锁日期 |
|------|------|----------|------|----------|
| Economics | Ch1 The basic economic problem | StudyCoach/记录/经济/Ch1.md | 锁定 |  |
| Economics | Ch2 The allocation of resources | StudyCoach/记录/经济/Ch2.md | 锁定 |  |
`;

const CHAPTER_FILE = `# Ch1 The basic economic problem

## 大纲目标
理解稀缺与选择。

## 术语
| Term (EN) | 定义 (EN) | 中文提示 |
|-----------|-----------|----------|
| scarcity | Unlimited wants vs limited resources | 稀缺 |
| opportunity cost | Next best alternative given up | 机会成本 |

## 计算
本章无计算。
`;

export async function run(): Promise<void> {
  section('UT: ChapterProgressService 台账');
  const v = new FakeVault({ seed: { [CHAPTER_PROGRESS_PATH]: LEDGER } });
  const cp = new ChapterProgressService(v.asService());

  eq('加载条数', (await cp.load()).length, 2);
  eq('初始无解锁', (await cp.unlocked('Economics')).length, 0);

  check('解锁成功', await cp.updateStatus('Economics', 'Ch1 The basic economic problem', '解锁') === true);
  eq('解锁后 unlocked 含 1 章', (await cp.unlocked('Economics')).length, 1);
  const e = (await cp.load()).find(x => x.chapter.startsWith('Ch1'));
  check('解锁自动记日期', Boolean(e?.unlocked));

  check('标记已掌握', await cp.updateStatus('Economics', 'Ch1 The basic economic problem', '已掌握') === true);
  eq('已掌握仍算 unlocked（复习聚焦）', (await cp.unlocked('Economics')).length, 1);
  eq('状态已更新', (await cp.load()).find(x => x.chapter.startsWith('Ch1'))?.status, '已掌握');

  check('重复同状态返回 false', (await cp.updateStatus('Economics', 'Ch1 The basic economic problem', '已掌握')) === false);
  check('不存在的章节返回 false', (await cp.updateStatus('Economics', 'Ch9', '解锁')) === false);
  check('锁定回流', await cp.updateStatus('Economics', 'Ch1 The basic economic problem', '锁定') === true);
  eq('锁定后 unlocked 归零', (await cp.unlocked('Economics')).length, 0);

  section('UT: ChapterProgressService.parseTerms');
  const terms = ChapterProgressService.parseTerms(CHAPTER_FILE);
  eq('术语条数', terms.length, 2);
  eq('术语名', terms[0].term, 'scarcity');
  eq('定义', terms[1].def, 'Next best alternative given up');
  eq('中文提示列', terms[0].cn, '稀缺');
  eq('无术语小节返回空', ChapterProgressService.parseTerms('# 只有标题\n正文').length, 0);
}
