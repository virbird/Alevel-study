import { requestUrl } from 'obsidian';
import type { LlmSettings, ImagePart, ChatMessage } from '../types';
import { streamRequest } from '../utils/streamRequest';
import { parseOpenAISSE, parseClaudeSSE } from './sseParser';
import type { ChatStreamEvent } from './sseParser';

export type { ImagePart, ChatMessage };

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** 支持取消/超时（AbortController） */
  signal?: AbortSignal;
}

/** OpenAI 兼容格式的多模态 user content（导出供测试） */
export function toOpenAIUserContent(text: string, images?: ImagePart[]): unknown {
  if (!images?.length) return text;
  return [
    { type: 'text', text },
    ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } })),
  ];
}

/** Anthropic 格式的多模态 user content（导出供测试） */
export function toAnthropicUserContent(text: string, images?: ImagePart[]): unknown {
  if (!images?.length) return text;
  return [
    { type: 'text', text },
    ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } })),
  ];
}

/**
 * 统一 LLM 客户端（简化 fork 自 AI Study Buddy 的 provider 层）。
 * Phase 1 只需要非流式调用；支持 OpenAI 兼容端点与 Anthropic 原生端点。
 * 使用 obsidian 的 requestUrl 以绕开桌面端 CORS 限制（iPad 同样可用）。
 */
/**
 * 取消/超时语义：obsidian 1.5.7 的 requestUrl 不支持 signal，
 * 在客户端层用 abort 事件中断等待（导出供测试）。
 */
export function withSignal<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new Error('aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      v => { signal.removeEventListener('abort', onAbort); resolve(v); },
      e => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

export class LlmClient {
  constructor(private settings: LlmSettings) {}

  get configured(): boolean {
    return !!this.settings.apiKey && !!this.settings.model;
  }

  async chat(opts: ChatOptions): Promise<string> {
    if (this.settings.provider === 'anthropic') return this.chatAnthropic(opts);
    return this.chatOpenAICompat(opts);
  }

  /** 流式对话：逐块产出 text_delta；教练会话用，其他长任务仍用 chat() */
  async *chatStream(opts: ChatOptions): AsyncGenerator<ChatStreamEvent> {
    if (this.settings.provider === 'anthropic') yield* this.streamAnthropic(opts);
    else yield* this.streamOpenAICompat(opts);
  }

  private async *streamOpenAICompat(opts: ChatOptions): AsyncGenerator<ChatStreamEvent> {
    const url = this.settings.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const messages: { role: string; content: unknown }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    for (const m of opts.messages) messages.push({ role: m.role, content: toOpenAIUserContent(m.content, m.images) });
    yield* this.runSSE(
      {
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.apiKey}` },
        body: JSON.stringify({
          model: this.settings.model,
          messages,
          max_tokens: opts.maxTokens ?? 4096,
          temperature: opts.temperature ?? 0.7,
          stream: true,
        }),
        signal: opts.signal,
      },
      parseOpenAISSE,
    );
  }

  private async *streamAnthropic(opts: ChatOptions): AsyncGenerator<ChatStreamEvent> {
    const url = this.settings.baseUrl.replace(/\/+$/, '') + '/v1/messages';
    yield* this.runSSE(
      {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.settings.model,
          max_tokens: opts.maxTokens ?? 4096,
          temperature: opts.temperature ?? 0.7,
          system: opts.system,
          messages: opts.messages.map(m => ({ role: m.role, content: toAnthropicUserContent(m.content, m.images) })),
          stream: true,
        }),
        signal: opts.signal,
      },
      parseClaudeSSE,
    );
  }

  /** SSE 通用消费：块到达 → 解析 → 按序产出；处理半行缓冲与流错误 */
  private async *runSSE(
    req: { url: string; method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
    parse: (buffer: string) => { events: ChatStreamEvent[]; remaining: string },
  ): AsyncGenerator<ChatStreamEvent> {
    let buffer = '';
    const queue: ChatStreamEvent[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    // 用对象持有错误，避免闭包赋值被 TS 控制流分析窄化为 never
    const state: { error: Error | null } = { error: null };

    streamRequest(req, chunk => {
      buffer += chunk;
      const r = parse(buffer);
      buffer = r.remaining;
      queue.push(...r.events);
      if (notify) { notify(); notify = null; }
    })
      .then(() => {
        if (buffer.trim()) {
          const r = parse(buffer + '\n');
          queue.push(...r.events);
        }
        finished = true;
        if (notify) { notify(); notify = null; }
      })
      .catch((e: unknown) => {
        state.error = e instanceof Error ? e : new Error(String(e));
        finished = true;
        if (notify) { notify(); notify = null; }
      });

    let i = 0;
    while (!finished || i < queue.length) {
      if (i < queue.length) {
        yield queue[i++];
      } else {
        await new Promise<void>(resolve => { notify = resolve; });
      }
    }
    if (state.error) yield { type: 'error', message: state.error.message };
  }

  private async chatOpenAICompat(opts: ChatOptions): Promise<string> {
    const url = this.settings.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const messages: { role: string; content: unknown }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    for (const m of opts.messages) messages.push({ role: m.role, content: toOpenAIUserContent(m.content, m.images) });

    const res = await withSignal(requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
      }),
      throw: false,
    }), opts.signal);

    if (res.status >= 400) {
      throw new Error(`LLM 请求失败 (${res.status})：${extractError(res.text)}`);
    }
    const data = res.json;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('LLM 返回格式异常，未找到回复内容');
    return content;
  }

  private async chatAnthropic(opts: ChatOptions): Promise<string> {
    const url = this.settings.baseUrl.replace(/\/+$/, '') + '/v1/messages';
    const res = await withSignal(requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.settings.model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        system: opts.system,
        messages: opts.messages.map(m => ({ role: m.role, content: toAnthropicUserContent(m.content, m.images) })),
      }),
      throw: false,
    }), opts.signal);

    if (res.status >= 400) {
      throw new Error(`LLM 请求失败 (${res.status})：${extractError(res.text)}`);
    }
    const data = res.json;
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('')
      : '';
    if (!text) throw new Error('LLM 返回格式异常，未找到回复内容');
    return text;
  }
}

function extractError(body: string): string {
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

/**
 * 从 AI 回复中尽力提取一个 JSON 对象。
 * 依次尝试：```json 代码块 → 首个 { 到最后一个 } 的子串。
 */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim()) as T;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}
