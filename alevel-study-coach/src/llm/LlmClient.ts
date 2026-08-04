import { requestUrl } from 'obsidian';
import type { ChatMessage, LlmSettings } from '../types';

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * 统一 LLM 客户端（简化 fork 自 AI Study Buddy 的 provider 层）。
 * Phase 1 只需要非流式调用；支持 OpenAI 兼容端点与 Anthropic 原生端点。
 * 使用 obsidian 的 requestUrl 以绕开桌面端 CORS 限制（iPad 同样可用）。
 */
export class LlmClient {
  constructor(private settings: LlmSettings) {}

  get configured(): boolean {
    return !!this.settings.apiKey && !!this.settings.model;
  }

  async chat(opts: ChatOptions): Promise<string> {
    if (this.settings.provider === 'anthropic') return this.chatAnthropic(opts);
    return this.chatOpenAICompat(opts);
  }

  private async chatOpenAICompat(opts: ChatOptions): Promise<string> {
    const url = this.settings.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const res = await requestUrl({
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
    });

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
    const res = await requestUrl({
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
        messages: opts.messages.map(m => ({ role: m.role, content: m.content })),
      }),
      throw: false,
    });

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
