// 本地 SVG 图表生成器：零第三方依赖；颜色用 Obsidian CSS 变量，自动适配明暗主题
// 单一数据源：spec（节点描述）→ 字符串（UT 断言）/ DOM（createElementNS 挂载，命名空间可靠）

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Spec { tag: string; attrs: Record<string, string>; text?: string }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function specToSvg(specs: Spec[]): string {
  if (!specs.length) return '';
  const [root, ...children] = specs;
  const attrs = Object.entries(root.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const inner = children.map(s => {
    const a = Object.entries(s.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    return s.text !== undefined ? `<${s.tag}${a}>${esc(s.text)}</${s.tag}>` : `<${s.tag}${a}/>`;
  }).join('');
  return `<${root.tag}${attrs}>${inner}</${root.tag}>`;
}

/** spec → DOM：createElementNS 保证 SVG 命名空间（innerHTML/DOMParser 导入均不可靠） */
function mount(parent: HTMLElement, specs: Spec[]): void {
  if (!specs.length) return;
  let root: SVGElement | null = null;
  for (const s of specs) {
    const el = document.createElementNS(SVG_NS, s.tag);
    for (const [k, v] of Object.entries(s.attrs)) el.setAttribute(k, v);
    if (s.text !== undefined) el.textContent = s.text;
    if (!root) { root = el; parent.appendChild(el); } else root.appendChild(el);
  }
}

function sparkSpec(values: number[], width: number, height: number): Spec[] {
  const vs = values.filter(v => Number.isFinite(v));
  if (!vs.length) return [];
  if (vs.length === 1) vs.push(vs[0]);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const pad = 6;
  const pts = vs.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / (vs.length - 1);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const last = pts[pts.length - 1];
  return [
    { tag: 'svg', attrs: { class: 'asc-chart', viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), role: 'img' } },
    { tag: 'polyline', attrs: { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: 'var(--interactive-accent)', 'stroke-width': '2', 'stroke-linecap': 'round' } },
    { tag: 'circle', attrs: { cx: String(last[0]), cy: String(last[1]), r: '3', fill: 'var(--interactive-accent)' } },
    { tag: 'text', attrs: { x: String(pad), y: String(height - 1), 'font-size': '9', fill: 'var(--text-muted)' }, text: min.toFixed(1) },
    { tag: 'text', attrs: { x: String(width - pad), y: String(height - 1), 'font-size': '9', fill: 'var(--text-muted)', 'text-anchor': 'end' }, text: max.toFixed(1) },
  ];
}

function barSpec(pairs: Array<[string, number]>, width: number, height: number): Spec[] {
  if (!pairs.length) return [];
  const max = Math.max(...pairs.map(p => p[1])) || 1;
  const gap = 6;
  const bw = Math.max(10, Math.floor((width - gap * (pairs.length - 1)) / pairs.length));
  const base = height - 16;
  const specs: Spec[] = [
    { tag: 'svg', attrs: { class: 'asc-chart', viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), role: 'img' } },
  ];
  pairs.forEach(([label, v], i) => {
    const h = Math.max(2, Math.round((v / max) * (base - 12)));
    const x = i * (bw + gap);
    specs.push({ tag: 'rect', attrs: { x: String(x), y: String(base - h), width: String(bw), height: String(h), rx: '2', fill: 'var(--interactive-accent)', opacity: '0.85' } });
    specs.push({ tag: 'text', attrs: { x: String(x + bw / 2), y: String(base - h - 3), 'font-size': '9', fill: 'var(--text-muted)', 'text-anchor': 'middle' }, text: String(v) });
    specs.push({ tag: 'text', attrs: { x: String(x + bw / 2), y: String(height - 4), 'font-size': '9', fill: 'var(--text-muted)', 'text-anchor': 'middle' }, text: label });
  });
  return specs;
}

/** 折线趋势图字符串（UT 用） */
export function sparkline(values: number[], width = 260, height = 56): string {
  return specToSvg(sparkSpec(values, width, height));
}

/** 条形分布图字符串（UT 用） */
export function bars(pairs: Array<[string, number]>, width = 260, height = 76): string {
  return specToSvg(barSpec(pairs, width, height));
}

/** 折线图挂载到容器（无数据不挂载） */
export function mountSparkline(parent: HTMLElement, values: number[], width = 260, height = 56): void {
  mount(parent, sparkSpec(values, width, height));
}

/** 条形图挂载到容器（无数据不挂载） */
export function mountBars(parent: HTMLElement, pairs: Array<[string, number]>, width = 260, height = 76): void {
  mount(parent, barSpec(pairs, width, height));
}
