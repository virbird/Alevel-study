import { App, Modal, Setting } from 'obsidian';
import { t } from '../i18n';

/**
 * 单行输入弹窗（替代 window.prompt，符合 Obsidian UI 规范）。
 * 点「确认」时回调 onSubmit（值为空串表示未填写）；直接关闭则不回调。
 */
export class PromptModal extends Modal {
  constructor(app: App, private title: string, private placeholder: string, private onSubmit: (value: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: this.title });
    const input = contentEl.createEl('input', { type: 'text', attr: { placeholder: this.placeholder } });
    new Setting(contentEl)
      .addButton(b =>
        b
          .setButtonText(t('modal.prompt.confirm'))
          .setCta()
          .onClick(() => {
            const v = input.value.trim();
            this.close();
            this.onSubmit(v);
          }),
      )
      .addButton(b => b.setButtonText(t('common.cancel')).onClick(() => this.close()));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = input.value.trim();
        this.close();
        this.onSubmit(v);
      }
    });
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
