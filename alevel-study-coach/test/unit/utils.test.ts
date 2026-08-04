// UT：utils/date、utils/markdown、llm/extractJson
import { section, check, eq } from '../harness';
import { todayStr, addDays, parseDate, isDue, daysBetween } from '../../src/utils/date';
import {
  parseFrontmatter, stringifyFrontmatter, parseTable, renderRow,
  parseSimpleFrontmatter, stringifySimpleFrontmatter,
} from '../../src/utils/markdown';
import { extractJson } from '../../src/llm/LlmClient';

export async function run(): Promise<void> {
  section('UT: utils/date');
  check('todayStr 格式 YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()));
  eq('addDays 常规 +7', addDays('2026-08-04', 7), '2026-08-11');
  eq('addDays 跨月', addDays('2026-08-30', 3), '2026-09-02');
  eq('addDays 负数', addDays('2026-08-04', -5), '2026-07-30');
  check('parseDate 宽松单位数月日', parseDate('2026-8-4') !== null);
  check('parseDate 非法返回 null', parseDate('不是日期') === null);
  check('isDue：过去日期已到期', isDue('2026-08-01'));
  check('isDue：未来日期未到期', !isDue('2099-01-01'));
  eq('daysBetween 计算', daysBetween('2026-08-01', '2026-08-11'), 10);
  eq('daysBetween 非法输入为 0', daysBetween('x', 'y'), 0);

  section('UT: utils/markdown');
  const fmSrc = '---\nstage: "G10"\nielts_target: 7.5\nsubjects:\n  Maths: "IG+AS / AS主导 / 目标A*"\n---\n\n# 正文\n内容\n';
  const fm = parseFrontmatter(fmSrc);
  eq('frontmatter 顶层字符串', fm.data.stage, 'G10');
  eq('frontmatter 数字保留', fm.data.ielts_target, 7.5);
  eq('frontmatter 一层嵌套', (fm.data.subjects as Record<string, unknown>).Maths, 'IG+AS / AS主导 / 目标A*');
  check('frontmatter body 保留', fm.body.includes('# 正文'));
  const roundtrip = parseFrontmatter(stringifyFrontmatter(fm.data, fm.body));
  eq('frontmatter 序列化往返一致', roundtrip.data, fm.data);
  check('无 frontmatter 时 body 为全文', parseFrontmatter('# 只有正文').body === '# 只有正文');

  const table = parseTable('| a | b |\n|----|----|\n| 1 | 2 |\n\n不是表格\n| 3 | 4 |\n');
  eq('parseTable 跳过表头/分隔/非表格行', table, [['a', 'b'], ['1', '2'], ['3', '4']]);
  eq('renderRow', renderRow(['x', 'y']), '| x | y |');

  const sf = parseSimpleFrontmatter('---\ntitle: 标题\nstatus: 待处理\n---\n正文');
  eq('simple frontmatter 解析', sf.data, { title: '标题', status: '待处理' });
  const sf2 = parseSimpleFrontmatter(stringifySimpleFrontmatter({ ...sf.data, status: '已处理' }, sf.body));
  eq('simple frontmatter 更新往返', sf2.data.status, '已处理');
  check('simple frontmatter body 不变', sf2.body === '正文');

  section('UT: llm/extractJson');
  const fenced = '前面的话\n```json\n{"a": 1}\n```\n后面的话';
  eq('extractJson 围栏代码块', extractJson<{ a: number }>(fenced), { a: 1 });
  eq('extractJson 裸 JSON', extractJson<{ b: string }>('xx {"b": "y"} yy'), { b: 'y' });
  check('extractJson 无 JSON 返回 null', extractJson('没有任何花括号') === null);
  check('extractJson 损坏 JSON 返回 null', extractJson('{broken') === null);
  const nested = '```json\n{"sessionTag": {"topic": "Moments"}}\n```';
  eq('extractJson 嵌套对象', extractJson<{ sessionTag: { topic: string } }>(nested)?.sessionTag.topic, 'Moments');
}
