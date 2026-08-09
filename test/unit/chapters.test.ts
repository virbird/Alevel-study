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

  section('UT: parseTerms 兼容新表头（红色关键词与原文定义）');
  const NEW = `# S2-C10 Price elasticity of demand

## 红色关键词与原文定义

| 关键词 (EN) | 原文定义（教材正文，OCR） | 中文对照 |
|-------------|--------------------------|----------|
| price elasticity of demand | Price elasticity of demand (PED) measures the extent to which the quantity demanded changes when the price changes. | 需求价格弹性（PED） |
| elastic demand | Perfectly elastic demand occurs when a change in price causes a complete change in quantity demanded. | 弹性需求 |

## 章末 Summary
- 列表项
`;
  const nt = ChapterProgressService.parseTerms(NEW);
  eq('新表头条数', nt.length, 2);
  eq('新表头术语', nt[0].term, 'price elasticity of demand');
  eq('新表头定义', nt[0].def, 'Price elasticity of demand (PED) measures the extent to which the quantity demanded changes when the price changes.');
  eq('新表头中文', nt[0].cn, '需求价格弹性（PED）');

  section('UT: parseTerms 兼容化学表头（关键词与原文定义）');
  const CHEM = `# Ch01 · States of matter（物质的状态）

## 关键词与原文定义

| 关键词 (EN) | 原文定义（依据教材整理） | 中文对照 |
|-------------|--------------------------|----------|
| matter | The word is used to cover all the substances and materials of which the universe is composed. Samples of all of these materials have two properties in common: they each occupy space (they have volume) and they have mass. | 物质 |
| sublimation | A change of state in which a solid turns directly into gas (or gas to solid), the liquid phase being bypassed. | 升华 |
| kinetic particle theory | The kinetic particle theory of matter describes the three different states, and the changes between them, in terms of the movement of particles. | 微粒运动理论 |

## 章末 Summary（原文要点）
- 列表项
`;
  const ct = ChapterProgressService.parseTerms(CHEM);
  eq('化学表头条数', ct.length, 3);
  eq('化学表头术语', ct[0].term, 'matter');
  eq('化学表头定义', ct[1].def, 'A change of state in which a solid turns directly into gas (or gas to solid), the liquid phase being bypassed.');
  eq('化学表头中文', ct[2].cn, '微粒运动理论');
  eq('化学定义含括号不受影响', ct[0].def.includes('(they have volume)'), true);

  section('UT: parseTerms 兼容物理表头（关键词与原文定义（KEY WORDS）括号后缀）');
  const PHYS = `# Ch16 · Magnetism（磁学）

## 学习目标（Learning intentions 原文，中文辅助）
- describe magnetic forces between magnets（描述磁体之间的磁力）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| magnetic field | A region of space around a magnet or electric current in which a magnetic pole experiences (feels) a force. | 磁场 |
| induced magnetism | When a magnetic material is only magnetised when placed in a magnetic field. | 感应磁化 |

## 章末 Summary（原文要点，中文辅助）
- 列表项
`;
  const pt = ChapterProgressService.parseTerms(PHYS);
  eq('物理表头条数', pt.length, 2);
  eq('物理表头术语', pt[0].term, 'magnetic field');
  eq('物理表头定义', pt[0].def, 'A region of space around a magnet or electric current in which a magnetic pole experiences (feels) a force.');
  eq('物理表头中文', pt[1].cn, '感应磁化');
  eq('物理学习目标段不误提取', pt.some(t => t.term.startsWith('describe')), false);

  section('UT: 台账按科目折叠格式（<details> 分块）读写兼容');
  const FOLDED = `# 章节进度

> 台账按科目分块折叠。

## 📘 Economics 经济（2 章）

<details>
<summary>展开/折叠 📘 Economics 经济（2 章）</summary>

| 科目 | 章节 | 内容文件 | 状态 | 解锁日期 |
|------|------|----------|------|----------|
| Economics | Ch1 The basic economic problem | StudyCoach/记录/经济/Ch1.md | 锁定 |  |
| Economics | Ch2 The allocation of resources | StudyCoach/记录/经济/Ch2.md | 锁定 |  |

</details>

## 🧪 Chemistry 化学（2 章）

<details>
<summary>展开/折叠 🧪 Chemistry 化学（2 章）</summary>

| 科目 | 章节 | 内容文件 | 状态 | 解锁日期 |
|------|------|----------|------|----------|
| Chemistry | Ch01-States of matter | StudyCoach/记录/化学/章节/Ch01-States of matter.md | 锁定 |  |
| Chemistry | Ch02-Atomic structure | StudyCoach/记录/化学/章节/Ch02-Atomic structure.md | 锁定 |  |

</details>
`;
  const fv = new FakeVault({ seed: { [CHAPTER_PROGRESS_PATH]: FOLDED } });
  const fcp = new ChapterProgressService(fv.asService());
  eq('折叠格式全量读取', (await fcp.load()).length, 4);
  eq('折叠格式按科目过滤', (await fcp.unlocked('Chemistry')).length, 0);
  check('折叠格式内解锁成功', await fcp.updateStatus('Chemistry', 'Ch01-States of matter', '解锁') === true);
  eq('折叠格式解锁后可取', (await fcp.unlocked('Chemistry')).length, 1);
  const fContent = (await fv.asService().read(CHAPTER_PROGRESS_PATH)) ?? '';
  check('折叠块结构保持（details 标签仍在）', fContent.includes('<details>') && fContent.includes('</details>'));
  check('折叠块结构保持（经济块未被化学解锁破坏）', fContent.includes('| Economics | Ch1 The basic economic problem | StudyCoach/记录/经济/Ch1.md | 锁定 |  |'));

  section('UT: parseSyllabusOnly / parseSkillsFocus（考纲独有考点与技能重点注入）');
  const RICH = `# Ch05 · Test chapter

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义 | 中文对照 |
|-------------|----------|----------|
| market | Any arrangement that allows goods and services to be traded | 市场 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 1.1 Converting denary to binary（十进制与二进制互转）
- **内容 Content**: Binary number size is determined by bits.
- **要点 Key points**: 位权从右向左递增（中文要点）

### 1.2 Another skill
- **内容 Content**: other content
- **要点 Key points**: 要点二（中文要点）

## ⚠️ 考纲独有考点（教材未覆盖 · 学习与复习重点）

> 以下为考纲明确要求、但教材未单列的内容。

- **microeconomics / macroeconomics（考纲 2.1）**：微观研究个体，宏观研究整体。

## 章末 Summary（原文要点，中文辅助）

- Summary 内容
`;
  const sy = ChapterProgressService.parseSyllabusOnly(RICH);
  check('考纲独有提取非空', sy.length > 0);
  check('考纲独有含考点行', sy.includes('microeconomics'));
  check('考纲独有不混入后续小节', !sy.includes('Summary 内容'));

  const sk = ChapterProgressService.parseSkillsFocus(RICH);
  check('技能重点非空', sk.length > 0);
  check('技能重点含要点一', sk.includes('位权从右向左递增'));
  check('技能重点含要点二', sk.includes('要点二'));
  check('技能重点不含内容行', !sk.includes('Binary number size'));
  check('技能重点带小节标题', sk.includes('SKILLS FOCUS 1.1'));

  const PLAIN = '# Ch\n\n## 关键词与原文定义\n\n| 关键词 (EN) | 定义 | 中文 |\n|---|---|---|\n| a | b | c |\n';
  eq('无考纲独有小节返回空', ChapterProgressService.parseSyllabusOnly(PLAIN).length, 0);
  eq('无技能重点小节返回空', ChapterProgressService.parseSkillsFocus(PLAIN).length, 0);
}
