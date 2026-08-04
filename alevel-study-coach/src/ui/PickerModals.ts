import { App, Modal, TFile } from 'obsidian';

/** 历史会话列表：点击加载并继续 */
export class SessionHistoryModal extends Modal {
  constructor(app: App, private files: TFile[], private onPick: (f: TFile) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '历史会话' });
    if (!this.files.length) {
      contentEl.createEl('p', { text: '还没有存档的会话。结题或关闭会话时会自动存档到这里。' });
      return;
    }
    const filter = contentEl.createEl('input', { attr: { placeholder: '筛选……', type: 'text' } });
    filter.style.width = '100%';
    const list = contentEl.createDiv({ cls: 'asc-picker-list' });

    const draw = () => {
      list.empty();
      const kw = filter.value.trim().toLowerCase();
      for (const f of this.files) {
        if (kw && !f.path.toLowerCase().includes(kw)) continue;
        const item = list.createDiv({ cls: 'asc-picker-item' });
        item.createSpan({ text: f.basename });
        item.addEventListener('click', () => {
          this.onPick(f);
          this.close();
        });
      }
    };
    filter.addEventListener('input', draw);
    draw();
    filter.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** 引用文档选择器：从 vault 里选 Markdown 作为本轮会话上下文 */
export class AttachPickerModal extends Modal {
  constructor(app: App, private exclude: string[], private onPick: (f: TFile) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '引用文档' });
    contentEl.createEl('p', { text: '选择 vault 中的笔记，其内容将注入本轮会话的上下文（单篇最多 2 万字符）。' });

    const filter = contentEl.createEl('input', { attr: { placeholder: '搜索文件名……', type: 'text' } });
    filter.style.width = '100%';
    const list = contentEl.createDiv({ cls: 'asc-picker-list' });

    const draw = () => {
      list.empty();
      const kw = filter.value.trim().toLowerCase();
      const files = this.app.vault
        .getMarkdownFiles()
        .filter(f => !this.exclude.includes(f.path))
        .filter(f => !kw || f.path.toLowerCase().includes(kw))
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(0, 30);
      if (!files.length) {
        list.createDiv({ text: '没有匹配的笔记', cls: 'asc-empty' });
        return;
      }
      for (const f of files) {
        const item = list.createDiv({ cls: 'asc-picker-item' });
        item.createSpan({ text: f.path });
        item.addEventListener('click', () => {
          this.onPick(f);
          this.close();
        });
      }
    };
    filter.addEventListener('input', draw);
    draw();
    filter.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
