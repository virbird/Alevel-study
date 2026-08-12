// UT：svgChart 本地 SVG 生成器
import { section, check } from '../harness';
import { sparkline, bars } from '../../src/utils/svgChart';

export async function run(): Promise<void> {
  section('UT: svgChart 折线/条形');
  check('空折线返回空串', sparkline([]) === '');
  const sp = sparkline([6, 6.5, 7]);
  check('折线为合法 SVG', sp.startsWith('<svg') && sp.endsWith('</svg>') && sp.includes('<polyline'));
  check('单值补成水平线', sparkline([5]).includes('<polyline'));
  check('非数值被过滤', sparkline([Number.NaN, 6, 7]).includes('<polyline'));
  check('空条形返回空串', bars([]) === '');
  const b = bars([['DV', 3], ['E', 5]]);
  check('条形含 rect 与标签数值', b.includes('<rect') && b.includes('DV') && b.includes('>5<'));
  check('条形标签转义', bars([['<x>', 1]]).includes('&lt;x&gt;'));
  check('主题变量着色', b.includes('var(--interactive-accent)'));
}
