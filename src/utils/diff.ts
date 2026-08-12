// 词级 diff（LCS）：英文复盘 before/after 对照，纯本地计算

export interface DiffOp { type: 'same' | 'del' | 'add'; text: string }

const tokenize = (s: string): string[] => s.split(/\s+/).filter(w => w.length > 0);

/** 词级 diff：del = before 有 after 无；add = after 有 before 无；相邻同类合并 */
export function wordDiff(before: string, after: string): DiffOp[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { raw.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { raw.push({ type: 'del', text: a[i] }); i++; }
    else { raw.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < n) raw.push({ type: 'del', text: a[i++] });
  while (j < m) raw.push({ type: 'add', text: b[j++] });
  const merged: DiffOp[] = [];
  for (const op of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) last.text += ' ' + op.text;
    else merged.push({ ...op });
  }
  return merged;
}
