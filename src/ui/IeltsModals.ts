import { App, MarkdownRenderer, Modal, Notice } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import type { ExpressionRow } from '../services/ExpressionService';
import type { ChatMessage } from '../types';
import { extractJson } from '../llm/LlmClient';
import { createRenderScope } from './RenderScope';

/** 批改前确认目标文件：路径可编辑（vault 文件联想快速指定），显示预览，避免误批改 */
export class GradeConfirmModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private path: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '确认批改目标' });
    contentEl.createDiv( { text: '将批改以下笔记（题目与作文可同篇，图片会发给视觉模型）。可输入或从列表选择 vault 中的文件：', cls: 'asc-muted' });

    const input = contentEl.createEl('input', { type: 'text', value: this.path });
    input.addClass('asc-confirm-input');
    const listEl = contentEl.createDiv({ cls: 'asc-picker-list' });
    const info = contentEl.createDiv({ cls: 'asc-muted' });
    info.setText('正在预览……');

    const bar = contentEl.createDiv({ cls: 'asc-row' });
    const goBtn = bar.createEl('button', { text: '开始批改', cls: 'asc-btn asc-btn-cta' });
    goBtn.addEventListener('click', () => {
      const path = input.value.trim();
      if (!path) return;
      this.close();
      void this.plugin.gradeFilePath(path);
    });
    bar.createEl('button', { text: '取消', cls: 'asc-btn' }).addEventListener('click', () => this.close());

    /** 联想列表：按输入过滤 vault 内 Markdown（精确/开头优先） */
    const renderSuggestions = () => {
      listEl.empty();
      const kw = input.value.trim().toLowerCase();
      const paths = this.app.vault.getMarkdownFiles().map(f => f.path);
      const matched = paths
        .filter(p => !kw || p.toLowerCase().includes(kw))
        .sort((a, b) => {
          const rank = (p: string) => (kw && p.toLowerCase() === kw ? 0 : kw && p.toLowerCase().startsWith(kw) ? 1 : 2);
          return rank(a) - rank(b) || a.localeCompare(b);
        })
        .slice(0, 8);
      for (const p of matched) {
        const item = listEl.createDiv({ cls: 'asc-picker-item', text: p });
        item.addEventListener('click', () => {
          input.value = p;
          listEl.empty();
          void preview();
        });
      }
    };

    /** 预览目标：字数/图片/跳过原因；异常时禁用开始按钮 */
    const preview = async () => {
      const path = input.value.trim();
      if (!path) {
        info.setText('请输入或选择笔记路径');
        goBtn.disabled = true;
        return;
      }
      info.setText('正在预览……');
      try {
        const content = await this.plugin.vaultService.read(path);
        if (!content) {
          info.setText(`笔记不存在：${path}`);
          goBtn.disabled = true;
          return;
        }
        const { text, images, skipped } = await this.plugin.ielts.extractNoteImages(path, content);
        const textLen = text.replace(/\[图片[^\]]*\]/g, '').trim().length;
        const parts = [`正文约 ${textLen} 字`, `图片 ${images.length} 张`];
        if (skipped.length) parts.push(`跳过 ${skipped.length} 张（${skipped.join('、')}）`);
        if (textLen < 40 && images.length === 0) {
          info.setText(parts.join(' · ') + ' —— 未找到作文内容：请写入题目与作文（文字或图片引用均可）');
          goBtn.disabled = true;
        } else if (textLen < 40 && images.length > 0) {
          info.setText(parts.join(' · ') + ' —— 内容主要在图片中，将由视觉模型直接识别批改');
          goBtn.disabled = false;
        } else {
          info.setText(parts.join(' · '));
          goBtn.disabled = false;
        }
      } catch (e) {
        info.setText(`预览失败：${e instanceof Error ? e.message : String(e)}`);
        goBtn.disabled = true;
      }
    };

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        listEl.empty();
        void preview();
      }
    });
    renderSuggestions();
    void preview();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

const EXPR_DRILL_CLOSE = '抽查结束。请汇总所有表达的结果，输出 exprResults JSON 代码块。';

/** 表达造句抽查：到期表达逐个造句，AI 判定，结束自动更新间隔档位 */
export class ExpressionDrillModal extends Modal {
  private system = '';
  private messages: ChatMessage[] = [];
  private busy = false;
  private finished = false;
  private renderScope = createRenderScope();

  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private rows: ExpressionRow[]) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal', 'asc-drill');
    contentEl.createEl('h2', { text: `表达造句抽查 · 到期 ${this.rows.length} 条` });
    contentEl.createEl('p', {
      text: `本次抽查：${this.rows.map(r => r.expr).join('、')}。每个表达造一个雅思写作场景的句子，AI 判定后自动更新间隔。`,
      cls: 'asc-muted',
    });

    this.system = this.plugin.expressions.buildDrillPrompt(this.rows);
    this.chatEl = contentEl.createDiv({ cls: 'asc-chat asc-drill-chat' });
    const inputBar = contentEl.createDiv({ cls: 'asc-input-bar' });
    this.inputEl = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: '写下你的英文句子……' } });
    this.sendBtn = inputBar.createEl('button', { text: '发送', cls: 'asc-btn asc-btn-cta' });
    this.sendBtn.addEventListener('click', () => this.doSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.doSend(); }
    });
    inputBar.createEl('button', { text: '抽查结束', cls: 'asc-btn' }).addEventListener('click', () => {
      if (!this.finished) void this.send(EXPR_DRILL_CLOSE);
    });

    void this.send('抽查开始，请给出第一个表达。');
  }

  private chatEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  private doSend(): void {
    const text = this.inputEl.value.trim();
    if (!text || this.busy || this.finished) return;
    this.inputEl.value = '';
    void this.send(text);
  }

  private async send(text: string): Promise<void> {
    if (this.busy) return;
    this.messages.push({ role: 'user', content: text });
    this.busy = true;
    this.renderMessages();
    try {
      const reply = await this.plugin.llm.chat({ system: this.system, messages: this.messages, maxTokens: 2000 });
      this.messages.push({ role: 'assistant', content: reply });
      this.renderMessages();
      if (text === EXPR_DRILL_CLOSE) {
        this.finished = true;
        await this.applyResults(reply);
      }
    } catch (e) {
      new Notice(`请求失败：${e instanceof Error ? e.message : String(e)}`, 8000);
      this.messages.pop();
    } finally {
      this.busy = false;
      this.renderMessages();
    }
  }

  private renderMessages(): void {
    this.chatEl.empty();
    this.renderScope.reset();
    for (const m of this.messages) {
      const bubble = this.chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      void MarkdownRenderer.render(this.app, m.content, bubble, '', this.renderScope);
    }
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    this.sendBtn.setText(this.busy ? '回复中…' : '发送');
    this.sendBtn.disabled = this.busy || this.finished;
  }

  private async applyResults(reply: string): Promise<void> {
    const parsed = extractJson<{ exprResults?: { expr: string; pass: boolean }[] }>(reply);
    const results = parsed?.exprResults ?? [];
    if (!results.length) {
      new Notice('未解析到抽查结果，请手动在表达积累库更新');
      return;
    }
    const summary: string[] = [];
    for (const r of results) {
      const next = await this.plugin.expressions.applyResult(r.expr, r.pass);
      if (next) summary.push(`${r.expr}：${r.pass ? '通过' : '未通过'} → ${next.status === '已掌握' ? '已掌握' : `下次 ${next.next}`}`);
    }
    const el = this.contentEl.createDiv({ cls: 'asc-drill-summary' });
    el.createDiv( { text: '抽查结果已更新间隔调度：', cls: 'asc-strong' });
    for (const s of summary) el.createDiv( { text: s, cls: 'asc-row' });
    new Notice('表达抽查完成');
  }

  onClose(): void {
    this.renderScope.dispose();
    this.contentEl.empty();
  }
}
