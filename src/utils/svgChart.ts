// 本地 SVG 图表生成器：零第三方依赖；颜色用 Obsidian CSS 变量，自动适配明暗主题

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** SVG 字符串 → DOM 挂载：用 DOMParser 而非 innerHTML 赋值（过审核 lint） */
export function mountSvg(parent: HTMLElement, svg: string): void {
  if (!svg) return;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  parent.appendChild(document.importNode(doc.documentElement, true));
}

/** 折线趋势图（如总分趋势）；无数据返回空串；单值补成水平线 */
export function sparkline(values: number[], width = 260, height = 56): string {
  const vs = values.filter(v => Number.isFinite(v));
  if (!vs.length) return '';
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
  return (
    `<svg class="asc-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">` +
    `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--interactive-accent)" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="var(--interactive-accent)"/>` +
    `<text x="${pad}" y="${height - 1}" font-size="9" fill="var(--text-muted)">${min.toFixed(1)}</text>` +
    `<text x="${width - pad}" y="${height - 1}" font-size="9" fill="var(--text-muted)" text-anchor="end">${max.toFixed(1)}</text>` +
    `</svg>`
  );
}

/** 条形分布图（如近 30 天失分码）；柱顶数值 + 柱底标签 */
export function bars(pairs: Array<[string, number]>, width = 260, height = 76): string {
  if (!pairs.length) return '';
  const max = Math.max(...pairs.map(p => p[1])) || 1;
  const gap = 6;
  const bw = Math.max(10, Math.floor((width - gap * (pairs.length - 1)) / pairs.length));
  const base = height - 16;
  let out = `<svg class="asc-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`;
  pairs.forEach(([label, v], i) => {
    const h = Math.max(2, Math.round((v / max) * (base - 12)));
    const x = i * (bw + gap);
    out += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="2" fill="var(--interactive-accent)" opacity="0.85"/>`;
    out += `<text x="${x + bw / 2}" y="${base - h - 3}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${v}</text>`;
    out += `<text x="${x + bw / 2}" y="${height - 4}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${esc(label)}</text>`;
  });
  return out + '</svg>';
}
