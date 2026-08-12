import type { LlmClient } from '../llm/LlmClient';
import type { ChatMessage } from '../types';
import { estimateTokens } from '../utils/tokens';
import { t } from '../i18n';

const SUMMARY_SYSTEM =
  'You are a conversation compressor. Compress the conversation into a concise summary, keeping: the topics discussed, questions and exam topics, key conclusions and decisions, ' +
  'and the context needed for later questions (e.g. essay content points, grading opinions already agreed). Output in the same language as the conversation, concise but complete.';

const SUMMARY_PROMPT =
  'Summarize the conversation above. Focus on: 1) topics and questions discussed 2) key conclusions and decisions 3) important context needed for later questions. ' +
  'Output a structured markdown summary.';

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
      .map(m => `${m.role === 'user' ? t('role.student') : t('role.coach')}：${m.content}`)
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
