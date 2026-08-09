// UT：SSE 流式解析（OpenAI 兼容 / Anthropic）
import { section, check, eq } from '../harness';
import { parseOpenAISSE, parseClaudeSSE } from '../../src/llm/sseParser';
import { stripMachineBlocks } from '../../src/ui/MainView';

export async function run(): Promise<void> {
  section('UT: parseOpenAISSE');
  const chunk1 = [
    'data: {"choices":[{"delta":{"content":"你"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"好"}}]}',
    '',
  ].join('\n');
  const r1 = parseOpenAISSE(chunk1);
  eq('增量文本提取', r1.events, [
    { type: 'text_delta', text: '你' },
    { type: 'text_delta', text: '好' },
  ]);
  eq('完整行无残留', r1.remaining, '');

  // 半行缓冲：下一块到达前保留
  const half = 'data: {"choices":[{"delta":{"content":"半';
  const r2 = parseOpenAISSE(half);
  eq('半行留在 remaining', [r2.events.length, r2.remaining], [0, half]);
  const r2b = parseOpenAISSE(r2.remaining + '行"}}]}\n\n');
  eq('拼接后解析成功', r2b.events, [{ type: 'text_delta', text: '半行' }]);

  const done = parseOpenAISSE('data: [DONE]\n');
  eq('[DONE] → done 事件', done.events, [{ type: 'done' }]);

  const err = parseOpenAISSE('data: {"error":{"message":"model not found"}}\n');
  eq('流内错误事件', err.events, [{ type: 'error', message: 'model not found' }]);

  const finish = parseOpenAISSE('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n');
  eq('finish_reason → done', finish.events, [{ type: 'done' }]);

  const badLine = parseOpenAISSE('data: {坏的 JSON\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n');
  eq('损坏行跳过不阻塞后续', badLine.events, [{ type: 'text_delta', text: 'ok' }]);

  section('UT: parseClaudeSSE');
  const claude = [
    'data: {"type":"message_start"}',
    '',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
    '',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
    '',
  ].join('\n');
  const rc = parseClaudeSSE(claude);
  eq('Claude 文本增量与结束', rc.events, [
    { type: 'text_delta', text: 'Hello' },
    { type: 'done' },
  ]);
  const claudeErr = parseClaudeSSE('data: {"type":"error","message":"overloaded"}\n');
  eq('Claude 错误事件', claudeErr.events, [{ type: 'error', message: 'overloaded' }]);
  check('空缓冲无事件', parseClaudeSSE('').events.length === 0);

  section('UT: stripMachineBlocks 剥离机器用 JSON 块');
  const reply = [
    '【1. 总分与分项评分】预测总分 6.0……',
    '',
    '```json',
    '{"ieltsResult": {"overall": 6.0, "expressions": []}}',
    '```',
    '',
    '【6. 建议】多练习。',
    '',
    '```json',
    '{"sessionTag": {"topic": "Task 1"}}',
    '```',
  ].join('\n');
  const stripped = stripMachineBlocks(reply);
  check('机器块被剥离', !stripped.includes('ieltsResult') && !stripped.includes('sessionTag'));
  check('正文保留', stripped.includes('总分与分项评分') && stripped.includes('【6. 建议】多练习。'));
  const withOther = '正文\n```json\n{"other": 1}\n```\n结尾';
  check('非机器 JSON 块保留', stripMachineBlocks(withOther).includes('{"other": 1}'));
  check('多余空行收敛', !stripMachineBlocks(reply).includes('\n\n\n'));
}
