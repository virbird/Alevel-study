/** 极简 frontmatter 工具（Phase 1 只支持单层嵌套，避免引入解析库） */

export function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: content };
  return { data: parseYamlLite(m[1]), body: content.slice(m[0].length) };
}

export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  return `---\n${stringifyYamlLite(data, 0)}---\n${body}`;
}

/** 解析：顶层 `key: value` 与一层缩进的嵌套 map。值保留字符串。 */
function parseYamlLite(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  let currentKey = '';
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const nested = line.match(/^\s{2,}(\w[\w-]*):\s*(.*)$/);
    if (nested && currentKey) {
      const obj = result[currentKey];
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        (obj as Record<string, unknown>)[nested[1]] = unquote(nested[2]) as string;
      }
      continue;
    }
    const top = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (top) {
      const [, key, raw] = top;
      if (raw === '' || raw === '{}') {
        result[key] = {};
        currentKey = key;
      } else {
        result[key] = unquote(raw);
        currentKey = '';
      }
    }
  }
  return result;
}

function stringifyYamlLite(data: Record<string, unknown>, _indent: number): string {
  let out = '';
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out += `${key}:\n`;
      for (const [k2, v2] of Object.entries(value as Record<string, unknown>)) {
        out += `  ${k2}: ${formatScalar(v2)}\n`;
      }
    } else {
      out += `${key}: ${formatScalar(value)}\n`;
    }
  }
  return out;
}

function formatScalar(v: unknown): string {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

function unquote(s: string): string | number | boolean {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/** 解析 Markdown 表格（| a | b |），跳过表头与分隔行，返回单元格数组 */
export function parseTable(content: string): string[][] {
  const rows: string[][] = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // 分隔行
    rows.push(cells);
  }
  return rows;
}

export function renderRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/** 解析建议卡片等文件的简单 frontmatter（支持 status 等字段更新后重写） */
export interface SimpleFrontmatter {
  data: Record<string, string>;
  body: string;
}

export function parseSimpleFrontmatter(content: string): SimpleFrontmatter {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: content };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: content.slice(m[0].length) };
}

export function stringifySimpleFrontmatter(data: Record<string, string>, body: string): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
