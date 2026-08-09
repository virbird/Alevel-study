import type { LlmClient } from '../llm/LlmClient';
import type { ChatMessage } from '../types';
import { estimateTokens } from '../utils/tokens';

const SUMMARY_SYSTEM =
  '你是对话压缩器。把对话压缩为简洁摘要，保留：讨论过的主题、题目与考点、关键结论与决定、' +
  '后续提问需要的上下文（如作文内容要点、已达成的批改意见）。用与对话相同的语言输出，简洁但完整。';

const SUMMARY_PROMPT =
  '请总结以上对话。聚焦：1) 讨论的主题与题目 2) 关键结论与决定 3) 后续提问需要的重要上下文。' +
  '输出结构化 markdown 摘要。';

export interface CompressResult {
  messages: ChatMessage[];
  summaryTokens: number;
}

/** 历史消息数少于此值不压缩（保留最近 keepRecent 条） */
const MIN_MESSAGES_TO_COMPRESS = 6;
const KEEP_RECENT = 4;

/**
 * 上下文压缩：把较早的消息交给 LLM 总结为一条摘要消息，保留最近几轮。
 * 摘要以 user 消息注入（带标注），后续对话照常进行。
 */
export class ContextCompressor {
  static shouldCompress(messages: ChatMessage[]): boolean {
    return messages.length >= MIN_MESSAGES_TO_COMPRESS;
  }

  static async compress(messages: ChatMessage[], llm: LlmClient): Promise<CompressResult> {
    if (!this.shouldCompress(messages)) {
      return { messages, summaryTokens: 0 };
    }
    const toCompress = messages.slice(0, messages.length - KEEP_RECENT);
    const kept = messages.slice(messages.length - KEEP_RECENT);

    const history = toCompress
      .filter(m => m.content.trim())
      .map(m => `${m.role === 'user' ? '学生' : '教练'}：${m.content}`)
      .join('\n\n');

    const summary = await llm.chat({
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: history + '\n\n' + SUMMARY_PROMPT }],
      maxTokens: 1024,
      temperature: 0.2,
    });

    const summaryMsg: ChatMessage = {
      role: 'user',
      content: `[插件：以下是较早对话的压缩摘要，供你保持上下文；摘要内容不显示给学生]\n${summary.trim()}`,
    };
    return { messages: [summaryMsg, ...kept], summaryTokens: estimateTokens(summary) };
  }
}
