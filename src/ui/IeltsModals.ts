import { App, MarkdownRenderer, Modal, Notice } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { t } from '../i18n';
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
    contentEl.createEl('h2', { text: t('ieltsModals.gradeTitle') });
    contentEl.createDiv( { text: t('ieltsModals.gradeDesc'), cls: 'asc-muted' });

    const input = contentEl.createEl('input', { type: 'text', value: this.path });
    input.addClass('asc-confirm-input');
    const listEl = contentEl.createDiv({ cls: 'asc-picker-list' });
    const info = contentEl.createDiv({ cls: 'asc-muted' });
    info.setText(t('ieltsModals.previewing'));

    const bar = contentEl.createDiv({ cls: 'asc-row' });
    const goBtn = bar.createEl('button', { text: t('ieltsModals.startGrade'), cls: 'asc-btn asc-btn-cta' });
    goBtn.addEventListener('click', () => {
      const path = input.value.trim();
      if (!path) return;
      this.close();
      void this.plugin.gradeFilePath(path);
    });
    bar.createEl('button', { text: t('common.cancel'), cls: 'asc-btn' }).addEventListener('click', () => this.close());

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
        info.setText(t('ieltsModals.inputPath'));
        goBtn.disabled = true;
        return;
      }
      info.setText(t('ieltsModals.previewing'));
      try {
        const content = await this.plugin.vaultService.read(path);
        if (!content) {
          info.setText(t('ieltsModals.notFound', { path }));
          goBtn.disabled = true;
          return;
        }
        const { text, images, skipped } = await this.plugin.ielts.extractNoteImages(path, content);
        const textLen = text.replace(/\[图片[^\]]*\]/g, '').trim().length;
        const parts = [t('ieltsModals.textLen', { n: textLen }), t('ieltsModals.images', { n: images.length })];
        if (skipped.length) parts.push(t('ieltsModals.skipped', { n: skipped.length, names: skipped.join('、') }));
        if (textLen < 40 && images.length === 0) {
          info.setText(parts.join(' · ') + t('ieltsModals.noEssay'));
          goBtn.disabled = true;
        } else if (textLen < 40 && images.length > 0) {
          info.setText(parts.join(' · ') + t('ieltsModals.inImages'));
          goBtn.disabled = false;
        } else {
          info.setText(parts.join(' · '));
          goBtn.disabled = false;
        }
      } catch (e) {
        info.setText(t('ieltsModals.previewFail', { msg: e instanceof Error ? e.message : String(e) }));
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

const EXPR_DRILL_CLOSE = 'The drill is over. Summarize the results of all expressions and output the exprResults JSON code block.';

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
    contentEl.createEl('h2', { text: t('drill.exprTitle', { n: this.rows.length }) });
    contentEl.createEl('p', {
      text: t('drill.exprDesc', { list: this.rows.map(r => r.expr).join('、') }),
      cls: 'asc-muted',
    });

    this.system = this.plugin.expressions.buildDrillPrompt(this.rows);
    this.chatEl = contentEl.createDiv({ cls: 'asc-chat asc-drill-chat' });
    const inputBar = contentEl.createDiv({ cls: 'asc-input-bar' });
    this.inputEl = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: t('drill.inputPlaceholder') } });
    this.sendBtn = inputBar.createEl('button', { text: t('drill.send'), cls: 'asc-btn asc-btn-cta' });
    this.sendBtn.addEventListener('click', () => this.doSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.doSend(); }
    });
    inputBar.createEl('button', { text: t('drill.finish'), cls: 'asc-btn' }).addEventListener('click', () => {
      if (!this.finished) void this.send(EXPR_DRILL_CLOSE);
    });

    void this.send(t('drill.start'));
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
      new Notice(t('drill.requestFail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
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
    this.sendBtn.setText(this.busy ? t('drill.sending') : t('drill.send'));
    this.sendBtn.disabled = this.busy || this.finished;
  }

  private async applyResults(reply: string): Promise<void> {
    const parsed = extractJson<{ exprResults?: { expr: string; pass: boolean }[] }>(reply);
    const results = parsed?.exprResults ?? [];
    if (!results.length) {
      new Notice(t('drill.noResult'));
      return;
    }
    const summary: string[] = [];
    for (const r of results) {
      const next = await this.plugin.expressions.applyResult(r.expr, r.pass);
      if (next) summary.push(t('drill.resultRow', { expr: r.expr, result: r.pass ? t('drill.passed') : t('drill.failed'), next: next.status === '已掌握' ? t('drill.mastered') : t('drill.next', { date: next.next }) }));
    }
    const el = this.contentEl.createDiv({ cls: 'asc-drill-summary' });
    el.createDiv( { text: t('drill.updated'), cls: 'asc-strong' });
    for (const s of summary) el.createDiv( { text: s, cls: 'asc-row' });
    new Notice(t('drill.done'));
  }

  onClose(): void {
    this.renderScope.dispose();
    this.contentEl.empty();
  }
}
