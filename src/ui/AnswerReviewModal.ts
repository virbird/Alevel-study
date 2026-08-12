import { App, Modal } from 'obsidian';
import { t } from '../i18n';
import { wordDiff } from '../utils/diff';

/** 英文复盘 before/after 对照：词级 diff（红色删除线=删掉，绿色高亮=新增）；纯展示不入台账 */
export class AnswerReviewModal extends Modal {
  constructor(app: App, private before: string, private after: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('answerReview.title') });
    contentEl.createDiv({ text: t('answerReview.legend'), cls: 'asc-muted' });
    const box = contentEl.createDiv({ cls: 'asc-diff' });
    for (const op of wordDiff(this.before, this.after)) {
      const sp = box.createSpan({ text: op.text + ' ' });
      if (op.type === 'del') sp.addClass('asc-diff-del');
      else if (op.type === 'add') sp.addClass('asc-diff-add');
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
