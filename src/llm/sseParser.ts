// SSE 解析（简化 fork 自 AI Study Buddy）：只产出 text_delta / done / error 三类事件

export type ChatStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** OpenAI 兼容 SSE：data: {choices:[{delta:{content}}]} … data: [DONE] */
export function parseOpenAISSE(buffer: string): { events: ChatStreamEvent[]; remaining: string } {
  const events: ChatStreamEvent[] = [];
  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      events.push({ type: 'done' });
      return { events, remaining: '' };
    }
    try {
      const data = JSON.parse(payload) as Record<string, unknown>;
      const sseError = data.error as Record<string, unknown> | undefined;
      if (sseError) {
        events.push({ type: 'error', message: (sseError.message as string) ?? JSON.stringify(sseError) });
        continue;
      }
      const choice = (data.choices as Array<Record<string, unknown>> | undefined)?.[0];
      if (!choice) continue;
      const delta = (choice.delta ?? {}) as Record<string, unknown>;
      if (typeof delta.content === 'string' && delta.content) {
        events.push({ type: 'text_delta', text: delta.content });
      }
      if (choice.finish_reason) events.push({ type: 'done' });
    } catch {
      // 跳过损坏的行
    }
  }
  return { events, remaining };
}

/** Anthropic SSE：content_block_delta / message_delta / error */
export function parseClaudeSSE(buffer: string): { events: ChatStreamEvent[]; remaining: string } {
  const events: ChatStreamEvent[] = [];
  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) continue;
    try {
      const data = JSON.parse(jsonStr) as Record<string, unknown>;
      switch (data.type as string) {
        case 'content_block_delta': {
          const delta = data.delta as Record<string, unknown>;
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            events.push({ type: 'text_delta', text: delta.text });
          }
          break;
        }
        case 'message_delta':
        case 'message_stop':
          events.push({ type: 'done' });
          break;
        case 'error':
          events.push({ type: 'error', message: (data.message as string) ?? 'Unknown error' });
          break;
      }
    } catch {
      // 跳过损坏的行
    }
  }
  return { events, remaining };
}
