// UT：token 估算与上下文压缩
import { section, check, eq } from '../harness';
import { estimateTokens, formatTokens } from '../../src/utils/tokens';
import { ContextCompressor } from '../../src/services/ContextCompressor';
import type { ChatMessage } from '../../src/types';
import type { LlmClient } from '../../src/llm/LlmClient';

export async function run(): Promise<void> {
  section('UT: token 估算');
  eq('空文本 0 token', estimateTokens(''), 0);
  check('中文约 1 字/token', Math.abs(estimateTokens('这是一个中文测试句子') - 10) <= 1);
  check('英文约 4 字符/token', estimateTokens('a'.repeat(40)) === 10);
  eq('formatTokens 千位', formatTokens(1500), '1.5k');
  eq('formatTokens 万位取整', formatTokens(15000), '15k');
  eq('formatTokens 小数', formatTokens(800), '800');

  section('UT: ContextCompressor');
  const few: ChatMessage[] = [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好，今天练什么？' },
  ];
  check('短对话不压缩', ContextCompressor.shouldCompress(few) === false);

  const many: ChatMessage[] = [];
  for (let i = 0; i < 8; i++) {
    many.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `消息 ${i}：一些讨论内容，包含考点与结论。` });
  }
  check('长对话需要压缩', ContextCompressor.shouldCompress(many) === true);

  const fakeLlm = { chat: async () => '## 摘要\n- 讨论了 8 条消息\n- 结论：继续练习', configured: true } as unknown as LlmClient;
  const r = await ContextCompressor.compress(many, fakeLlm);
  eq('压缩后保留最近 4 条 + 1 条摘要', r.messages.length, 5);
  check('摘要消息在首位且带标注', r.messages[0].role === 'user' && r.messages[0].content.includes('压缩摘要'));
  eq('最近消息原样保留', r.messages[4].content, many[7].content);
  check('摘要 token 有统计', r.summaryTokens > 0);

  const rShort = await ContextCompressor.compress(few, fakeLlm);
  eq('短对话压缩直接返回原消息', [rShort.messages.length, rShort.summaryTokens], [2, 0]);
}
