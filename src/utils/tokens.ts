/** token 估算：CJK 字符约 1 字/token，ASCII 约 4 字符/token（粗略，用于上下文展示与压缩阈值判断） */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x2e80) cjk++;
  }
  const asciiLen = text.length - cjk;
  return Math.ceil(cjk + asciiLen / 4);
}

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
