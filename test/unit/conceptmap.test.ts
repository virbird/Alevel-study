// UT：概念地图服务（模式 F 章节级概念登记）+ conceptMap JSON 解析
import { section, check, eq, FakeVault } from '../harness';
import { ConceptMapService, CONCEPT_MAP_PATH } from '../../src/services/ConceptMapService';
import { parseConceptMap, stripMachineBlocks } from '../../src/ui/MainView';

const LEDGER = `# 概念地图

| 章节 | 概念 | 科目 | 状态 | 更新日期 |
|---|---|---|---|---|
`;

export async function run(): Promise<void> {
  section('UT: ConceptMapService');
  const v = new FakeVault({ seed: { [CONCEPT_MAP_PATH]: LEDGER } });
  const cm = new ConceptMapService(v.asService());

  await cm.upsert({ chapter: 'Ch2 Demand & Supply', concept: 'demand curve', status: '已学', subject: 'Economics' });
  await cm.upsert({ chapter: 'Ch2 Demand & Supply', concept: 'elasticity', status: '预习', subject: 'Economics' });
  eq('登记条数', (await cm.load()).length, 2);
  eq('pendingDetail 只含未掌握', (await cm.pendingDetail()).map(e => e.concept), ['elasticity']);

  // 同章节同概念更新状态（学到后改为已学），不新增行
  await cm.upsert({ chapter: 'Ch2 Demand & Supply', concept: 'Elasticity', status: '已学', subject: 'Economics' });
  eq('更新后仍 2 条', (await cm.load()).length, 2);
  eq('状态已更新为已学', (await cm.load()).find(e => e.concept === 'elasticity')?.status, '已学');
  eq('全部掌握后 pending 为空', (await cm.pendingDetail()).length, 0);

  section('UT: parseConceptMap');
  const reply = '图已画好。\n```json\n{"conceptMap": {"chapter": "Ch2", "subject": "Economics", "concepts": [{"name": "demand curve", "status": "已学"}, {"name": "elasticity", "status": "预习"}, {"name": "subsidy", "status": "待详学"}]}}\n```';
  const parsed = parseConceptMap(reply);
  eq('章节', parsed?.chapter, 'Ch2');
  eq('概念数', parsed?.concepts.length, 3);
  eq('状态解析', parsed?.concepts.map(c => c.status), ['已学', '预习', '待详学']);
  check('展示剥离 conceptMap 块', !stripMachineBlocks(reply).includes('conceptMap'));
  check('无 JSON 返回 null', parseConceptMap('普通文本') === null);
  check('空概念数组返回 null', parseConceptMap('```json\n{"conceptMap": {"chapter": "x", "concepts": []}}\n```') === null);
}
