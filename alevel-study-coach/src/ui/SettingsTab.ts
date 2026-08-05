import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';

export class StudyCoachSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const llm = this.plugin.settings.llm;

    containerEl.createEl('h2', { text: 'LLM 连接' });
    containerEl.createEl('p', {
      text: 'API Key 只保存在本机 Obsidian 设置里，直接调用提供商接口。OpenAI 兼容端点同样适用于 DeepSeek、Qwen、OpenRouter、本地代理等。',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('接口类型')
      .addDropdown(d =>
        d
          .addOptions({ 'openai-compat': 'OpenAI 兼容（/v1/chat/completions）', anthropic: 'Anthropic 原生（/v1/messages）' })
          .setValue(llm.provider)
          .onChange(async v => {
            llm.provider = v as 'openai-compat' | 'anthropic';
            if (llm.provider === 'anthropic' && llm.baseUrl.includes('openai.com')) llm.baseUrl = 'https://api.anthropic.com';
            if (llm.provider === 'openai-compat' && llm.baseUrl.includes('anthropic.com')) llm.baseUrl = 'https://api.openai.com/v1';
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName('Base URL')
      .addText(t =>
        t
          .setPlaceholder(llm.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')
          .setValue(llm.baseUrl)
          .onChange(async v => {
            llm.baseUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API Key')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(llm.apiKey).onChange(async v => {
          llm.apiKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('模型')
      .setDesc('如 gpt-4o-mini / claude-sonnet-4-20250514 / deepseek-chat')
      .addText(t =>
        t.setValue(llm.model).onChange(async v => {
          llm.model = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('候选模型列表')
      .setDesc('英文逗号分隔；教练页签顶部可快捷切换（如 gpt-4o-mini, deepseek-chat, claude-sonnet-4-20250514）')
      .addText(t =>
        t.setValue(this.plugin.settings.modelCandidates).onChange(async v => {
          this.plugin.settings.modelCandidates = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('上下文窗口大小')
      .setDesc('token 数，用于教练会话的上下文展示与自动压缩阈值（超过 80% 自动压缩）')
      .addText(t =>
        t.setValue(String(this.plugin.settings.contextWindow)).onChange(async v => {
          const n = Number(v);
          if (n > 0) {
            this.plugin.settings.contextWindow = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl).setName('测试连接').addButton(b =>
      b.setButtonText('测试').onClick(async () => {
        b.setButtonText('测试中…').setDisabled(true);
        try {
          const reply = await this.plugin.llm.chat({
            messages: [{ role: 'user', content: '请只回复两个字：正常' }],
            maxTokens: 32,
          });
          new Notice(`连接成功：${reply.slice(0, 40)}`);
        } catch (e) {
          new Notice(`连接失败：${e instanceof Error ? e.message : String(e)}`, 10000);
        } finally {
          b.setButtonText('测试').setDisabled(false);
        }
      }),
    );

    containerEl.createEl('h2', { text: '数据与提示词' });
    containerEl.createEl('p', {
      text: '所有学习数据保存在 vault 的 StudyCoach/ 目录（纯 Markdown，可用 git / iCloud 同步）。提示词在 StudyCoach/prompts/ 下，可直接编辑。',
      cls: 'setting-item-description',
    });
  }
}
