import { App, Modal, TFile } from 'obsidian';
import { t } from '../i18n';

/** 历史会话列表：点击加载并继续 */
export class SessionHistoryModal extends Modal {
  constructor(app: App, private files: TFile[], private onPick: (f: TFile) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: t('modal.history') });
    if (!this.files.length) {
      contentEl.createEl('p', { text: t('modal.history.empty') });
      return;
    }
    const filter = contentEl.createEl('input', { attr: { placeholder: t('modal.history.filter'), type: 'text' } });
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
    contentEl.createEl('h2', { text: t('modal.attach') });
    contentEl.createEl('p', { text: t('modal.attach.desc') });

    const filter = contentEl.createEl('input', { attr: { placeholder: t('modal.attach.search'), type: 'text' } });
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
        list.createDiv({ text: t('modal.attach.none'), cls: 'asc-empty' });
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

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** 图片选择器：从 vault 选图片附加到教练会话的下一条消息 */
export class ImagePickerModal extends Modal {
  constructor(app: App, private exclude: string[], private onPick: (f: TFile) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: t('modal.image') });
    contentEl.createEl('p', { text: t('modal.image.desc') });

    const filter = contentEl.createEl('input', { attr: { placeholder: t('modal.image.search'), type: 'text' } });
    const list = contentEl.createDiv({ cls: 'asc-picker-list' });

    const draw = () => {
      list.empty();
      const kw = filter.value.trim().toLowerCase();
      const files = this.app.vault
        .getFiles()
        .filter(f => IMAGE_EXTS.includes(f.extension.toLowerCase()))
        .filter(f => !this.exclude.includes(f.path))
        .filter(f => !kw || f.path.toLowerCase().includes(kw))
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(0, 30);
      if (!files.length) {
        list.createDiv({ text: t('modal.image.none'), cls: 'asc-empty' });
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
